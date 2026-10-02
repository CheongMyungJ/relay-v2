// [흐름] 지식 관리의 PR 진행 (docs/implementation.md M17, I83). 가짜 gh(8.2)와 로컬 bare 원격으로 [PR 생성]의 지식 커밋(I73),
// 실패한 전달의 다시 시도, PR 대응 task의 지식 파일 고침과 머리글 검사(D309, D310, I79), push 전의 해시 갱신(D323), 지운 항목의
// 공유 대기 사본, 머지와 [머지 없이 끝내기]의 공유 대기(D288, D310 (4))를 본다. 파일 이름이 pr*라 windows-pr 작업에서 돈다(I56).
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseEntry } from '../../src/core/knowledge'
import type { KnowledgeCandidateField } from '../../src/shared/contracts'
import type { KnowledgeIndex } from '../../src/shared/knowledge'
import type { WorkState } from '../../src/shared/work'
import { drive } from './driver'
import { CART_FILES, FakeGitHub, FakeWorld } from './github'
import { git, harness, settle, makeRepo, register, type Harness } from './harness'
import {
  HEAD_CODE,
  currentUntil,
  openPrWork,
  prClaude,
  refreshUntil,
  view,
  workEvents,
  workState,
  type PrContext,
  type PrWork,
} from './pr-scenario'
import { handoff, steps, type Scenario, type Step } from './scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')
const DIR = 'docs/knowledge/'
const CART = CART_FILES['src/cart.mjs'] ?? ''

/** intake가 남긴 제약: src/cart.mjs에 묶여 대응이 그 파일을 고치면 해시가 바뀐다 (D323) */
const RULE = '합계는 정수 센트로 계산한다'
const CONSTRAINT: KnowledgeCandidateField = {
  kind: 'constraint',
  rule: RULE,
  paths: ['src/cart.mjs'],
  terms: ['합계'],
  why: '리뷰어가 부동소수 오차를 지적함',
  not_in_code: '지금 시험은 정수 가격만 씀',
  incentive: '가격을 소수로 더한다',
}

interface Setup {
  ctx: PrContext
  gh: FakeGitHub
  store: string
}

async function setup(o: { env?: Record<string, string> } = {}): Promise<Setup> {
  h = await harness({ config: {}, env: o.env ?? {} })
  const { repo } = makeRepo(h.root, 'cart', CART_FILES)
  const projectId = await register(h, repo)
  const scratch = path.join(h.root, 'outside')
  fs.mkdirSync(scratch)
  const gh = new FakeGitHub(path.join(h.root, 'record'), path.join(h.root, 'cart.git'), scratch)
  const world = new FakeWorld(gh)
  return {
    ctx: { h, world, projectId, repo, note: () => undefined, created: [] },
    gh,
    store: path.join(h.home, 'projects', projectId, 'knowledge'),
  }
}

/** intake가 후보를 남기고, fix가 CI를 통과하는 코드를 커밋하는 Work의 가짜 claude */
function claude(candidates: KnowledgeCandidateField[] = [CONSTRAINT]): Scenario {
  const base = prClaude({ 'src/cart.mjs': CART + HEAD_CODE }, 'relay M17 시험: 지식')
  const intake = steps('intake').map((st) =>
    st.do === 'write' && st.file === 'handoff.md'
      ? { ...st, text: handoff({ knowledge_candidates: candidates }) }
      : st,
  )
  return { ...base, tasks: { ...base.tasks, 'work-start': intake } }
}

function setTasks(s: Setup, tasks: Record<string, Step[]>): void {
  const file = path.join(s.ctx.h.root, 'scenario.json')
  const scenario = JSON.parse(read(file)) as Scenario
  fs.writeFileSync(file, JSON.stringify({ ...scenario, tasks: { ...scenario.tasks, ...tasks } }))
}

function index(s: Setup): KnowledgeIndex {
  const f = path.join(s.store, 'knowledge.json')
  return fs.existsSync(f)
    ? (JSON.parse(read(f)) as KnowledgeIndex)
    : { schema_version: 1, carried: {} }
}

function pendingFile(s: Setup, id: string): string | null {
  const f = path.join(s.store, 'pending', id.split('-')[0] ?? '', `${id}.md`)
  return fs.existsSync(f) ? read(f) : null
}

/** worktree의 지식 파일 (레포 상대 경로) */
function knowledgeFiles(w: PrWork): string[] {
  const dir = path.join(w.tree, DIR)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.md') && f.includes(path.sep))
    .map((f) => `${DIR}${f.split(path.sep).join('/')}`)
}

function entryIdOf(rel: string): string {
  return rel.split('/').pop()?.replace(/\.md$/, '') ?? ''
}

/** 대응 task를 시작하고 승인 대기까지 */
async function startRound(s: Setup, w: PrWork, count: number) {
  const p = await refreshUntil(
    s.ctx,
    w,
    (x) => x.respond.enabled && x.respond.items.length === count,
    `새 항목 ${count}개`,
  )
  expect(await s.ctx.h.relay.prRespond(w.key, { items: p.respond.items, instruction: '' })).toEqual(
    { ok: true },
  )
  const t = await currentUntil(
    s.ctx,
    w,
    (x) => x.node === 'respond' && x.status === 'awaiting_approval',
    '대응 task',
  )
  await settle(s.ctx.h, w.key)
  return t
}

/** 대응을 승인하고 게시를 마칠 때까지 */
async function approveRound(s: Setup, w: PrWork, taskId: string): Promise<void> {
  expect(await s.ctx.h.relay.approve(w.key, taskId, {})).toEqual({ ok: true })
  await settle(s.ctx.h, w.key)
  await s.ctx.h.ui.until(
    () => (workState(w).tasks.find((t) => t.id === taskId)?.respond?.published_at ? true : null),
    '대응 게시',
  )
}

describe('[흐름] 지식 관리의 PR 진행 (M17)', () => {
  it('[PR 생성]의 PR에 지식 폴더만 담은 지식 커밋이 실리고, 대응 task가 지식 파일을 고치면 머리글을 검사하고 강조하고 사본을 맞춘다', async () => {
    const s = await setup()
    const w = await openPrWork(s.ctx, claude(), 'relay M17 시험')
    const subjects = git(w.tree, 'log', '--format=%s', `${workState(w).base_commit}..HEAD`)
    expect(subjects.split('\n')[0]).toBe(`relay(${w.workId}): 지식 1건`)
    const changed = git(w.tree, 'show', '--name-only', '--format=', 'HEAD').split('\n')
    expect(changed.every((f) => f.startsWith(DIR))).toBe(true)
    expect(changed).toContain(`${DIR}README.md`)
    const [rel] = knowledgeFiles(w)
    if (!rel) throw new Error('지식 파일이 없음')
    const id = entryIdOf(rel)
    // 원격 PR 브랜치에도 있다
    expect(git(s.ctx.repo, 'ls-tree', '-r', '--name-only', `origin/${w.branch}`)).toContain(rel)
    // PR에 실린 것도 공유 대기 사본으로 남고 실린 곳을 적는다 (D310 (4))
    expect(pendingFile(s, id)).toBe(read(path.join(w.tree, rel)))
    expect(index(s).carried[id]).toMatchObject({ work: w.workId, pr: w.pr })
    expect(workState(w).delivery?.knowledge).toMatchObject({
      team: 1,
      commit: git(w.tree, 'rev-parse', 'HEAD'),
    })

    // 지식 파일에 리뷰 코멘트 (D309): 대응 task가 머리글을 깨뜨렸다가 되돌림을 받고 고친다. 지식이 가리키는 코드도 고친다
    s.gh.inline(w.pr, { body: '규칙을 더 구체적으로 써 주세요', path: rel, line: 1 })
    const original = read(path.join(w.tree, rel))
    const fixed = original.replace(`# ${RULE}`, `# ${RULE} (반올림은 마지막에)`)
    const broken = fixed.replace('status: active', 'status: maybe')
    setTasks(s, {
      'pr-respond': [
        { do: 'prompt' },
        { do: 'edit', files: { [rel]: broken } },
        {
          do: 'commit',
          files: { 'src/cart.mjs': `${CART + HEAD_CODE}// 센트 단위\n` },
          message: 'fix: 센트 주석',
        },
        { do: 'respond', text: '{id}: 규칙을 고쳤습니다.' },
        { do: 'write', file: 'handoff.md', text: handoff({ summary: '지식 파일을 고쳤다.' }) },
        {
          do: 'stop',
          onBlock: [{ do: 'commit', files: { [rel]: fixed }, message: 'docs: 지식 규칙을 고침' }],
        },
      ],
    })
    const t = await startRound(s, w, 1)
    // 머리글이 틀린 지식 파일은 Stop 때 되돌린다 (D310 (2), I79)
    const bounced = workEvents(w).filter((e) => e.type === 'task.bounced' && e.task_id === t.id)
    expect(bounced).toHaveLength(1)
    // 같은 Work의 대응 task를 시작해도 그 PR에 실린 공유 대기는 지우지 않는다 (I74)
    expect(pendingFile(s, id)).not.toBeNull()
    const review = await s.ctx.h.relay.review(w.key, t.id)
    expect(review?.emphasis.find((e) => e.kind === 'knowledge_files')?.lines[0]).toBe(
      `고침: ${rel}`,
    )
    // PR 대응 task의 설정 파일에는 worktree 지식 폴더의 deny가 없고, 앱 저장소의 deny는 있다 (I78)
    const tasks = path.join(w.dir, 'tasks')
    const respondDir = fs.readdirSync(tasks).find((d) => d.endsWith('-respond')) ?? ''
    const respondSettings = read(path.join(tasks, respondDir, 'task.settings.json'))
    expect(respondSettings).not.toContain(`${DIR}**`)
    expect(respondSettings).toContain('/knowledge/**')
    expect(read(path.join(tasks, '01-intake', 'task.settings.json'))).toContain(`${DIR}**`)

    await approveRound(s, w, t.id)
    // push 전에 해시를 이 head로 다시 적어 커밋하고 공유 대기 사본도 맞춘다 (D323, I79)
    const log = git(w.tree, 'log', '--format=%s', '-3').split('\n')
    expect(log[0]).toBe(`relay(${w.workId}): 지식 해시 1건`)
    const now = read(path.join(w.tree, rel))
    const parsed = parseEntry(now, rel)
    if (!parsed.ok) throw new Error('지식 파일을 읽지 못함')
    expect(parsed.entry.rule).toContain('반올림은 마지막에')
    expect(parsed.entry.hashes['src/cart.mjs']).toBe(git(w.tree, 'rev-parse', 'HEAD:src/cart.mjs'))
    expect(pendingFile(s, id)).toBe(now)
    expect(git(s.ctx.repo, 'rev-parse', `origin/${w.branch}`)).toBe(
      git(w.tree, 'rev-parse', 'HEAD'),
    )
  })

  it('대응 task가 지식 파일을 지우면 공유 대기 사본도 지우고, 머지 없이 끝내도 다시 싣지 않는다', async () => {
    const s = await setup()
    const w = await openPrWork(s.ctx, claude(), 'relay M17 시험 (지움)')
    const [rel] = knowledgeFiles(w)
    if (!rel) throw new Error('지식 파일이 없음')
    const id = entryIdOf(rel)
    s.gh.inline(w.pr, { body: '이 규칙은 틀렸습니다. 지워 주세요', path: rel, line: 1 })
    setTasks(s, {
      'pr-respond': [
        { do: 'prompt' },
        { do: 'git', args: ['rm', '-q', rel] },
        { do: 'git', args: ['commit', '-q', '-m', 'docs: 지식 지움'] },
        { do: 'respond', text: '{id}: 지웠습니다.' },
        { do: 'write', file: 'handoff.md', text: handoff({ summary: '지식 파일을 지웠다.' }) },
        { do: 'stop' },
      ],
    })
    const t = await startRound(s, w, 1)
    const review = await s.ctx.h.relay.review(w.key, t.id)
    expect(review?.emphasis.find((e) => e.kind === 'knowledge_files')?.lines[0]).toBe(
      `지움: ${rel}`,
    )
    await approveRound(s, w, t.id)
    expect(pendingFile(s, id)).toBeNull()
    expect(index(s).carried[id]).toBeUndefined()
    expect(await s.ctx.h.relay.prEnd(w.key)).toEqual({ ok: true })
    await settle(s.ctx.h, w.key)
    // 다음 Work의 PR에 다시 실리지 않는다
    const w2 = await openPrWork(s.ctx, claude([]), 'relay M17 시험 (다음)')
    expect(knowledgeFiles(w2)).toEqual([])
  })

  it('머지 없이 끝내면 공유 대기가 다음 PR에 다시 실리고, 머지하면 공유 대기에서 빠진다 (D288, D310 (4))', async () => {
    const s = await setup()
    const w = await openPrWork(s.ctx, claude(), 'relay M17 시험 (끝냄)')
    const [rel] = knowledgeFiles(w)
    const id = entryIdOf(rel ?? '')
    expect(await s.ctx.h.relay.prEnd(w.key)).toEqual({ ok: true })
    await settle(s.ctx.h, w.key)
    expect(index(s).carried[id]).toBeUndefined()
    expect(pendingFile(s, id)).not.toBeNull()

    const w2 = await openPrWork(s.ctx, claude([]), 'relay M17 시험 (다시 실음)')
    expect(knowledgeFiles(w2)).toEqual([rel])
    expect(index(s).carried[id]).toMatchObject({ work: w2.workId, pr: w2.pr })
    // CI가 통과하면 머지한다
    await s.ctx.world.runCi(w2.pr, workState(w2).pr?.head ?? '')
    await refreshUntil(s.ctx, w2, (p) => p.gate.enabled, '머지 조건')
    const info = await s.ctx.h.relay.prMergeInfo(w2.key)
    if (!info.ok || !info.info.preferred) throw new Error('머지 창')
    expect(
      await s.ctx.h.relay.prMerge(w2.key, { method: info.info.preferred, head: info.info.head }),
    ).toEqual({ ok: true })
    await settle(s.ctx.h, w2.key)
    expect(view(s.ctx, w2).status).toBe('completed')
    expect(pendingFile(s, id)).toBeNull()
    expect(index(s).carried[id]).toBeUndefined()
  })

  it('PR 생성이 지식 커밋 뒤에 실패하면, 다시 누른 [PR 생성]은 지식 커밋을 두 번 만들지 않는다 (I73)', async () => {
    const s = await setup()
    fs.writeFileSync(path.join(s.ctx.h.root, 'scenario.json'), JSON.stringify(claude()))
    const created = await s.ctx.h.relay.createWork(s.ctx.projectId, {
      request: 'relay M17 시험 (다시 시도)',
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'remote',
    })
    if (!created.ok) throw new Error(created.error)
    const key = created.workKey
    const r = await drive(s.ctx.h.relay, s.ctx.h.ui, key, {
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    expect(r.status).toBe('paused')
    await settle(s.ctx.h, key)
    s.ctx.h.env['FAKE_GH_FAIL'] = 'create'
    const failed = await s.ctx.h.relay.deliver(key, { choice: 'pr', uncommitted: null })
    expect(failed.ok).toBe(false)
    s.ctx.h.env['FAKE_GH_FAIL'] = ''
    expect(await s.ctx.h.relay.deliver(key, { choice: 'pr', uncommitted: null })).toEqual({
      ok: true,
    })
    await settle(s.ctx.h, key)
    const workId = key.split('/')[1] ?? ''
    const tree = path.join(s.ctx.h.home, 'projects', s.ctx.projectId, 'worktrees', workId)
    const subjects = git(tree, 'log', '--format=%s', '-5').split('\n')
    expect(subjects.filter((x) => x.includes('지식'))).toEqual([`relay(${workId}): 지식 1건`])
  })

  it('지식 커밋 뒤에 끊긴 전달의 [다시 시도]는 기록한 채택 결과로 이어 하고 지식 커밋을 두 번 만들지 않는다 (I73, D123)', async () => {
    const s = await setup()
    fs.writeFileSync(path.join(s.ctx.h.root, 'scenario.json'), JSON.stringify(claude()))
    const created = await s.ctx.h.relay.createWork(s.ctx.projectId, {
      request: 'relay M17 시험 (끊긴 전달)',
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'remote',
    })
    if (!created.ok) throw new Error(created.error)
    const key = created.workKey
    const r = await drive(s.ctx.h.relay, s.ctx.h.ui, key, {
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    expect(r.status).toBe('paused')
    await settle(s.ctx.h, key)
    // 지식 커밋과 push를 마치고 PR을 만들다 앱이 꺼진 것을 만든다: 실패한 전달의 기록을 진행 중 작업으로 되돌린다
    s.ctx.h.env['FAKE_GH_FAIL'] = 'create'
    expect((await s.ctx.h.relay.deliver(key, { choice: 'pr', uncommitted: null })).ok).toBe(false)
    s.ctx.h.env['FAKE_GH_FAIL'] = ''
    await settle(s.ctx.h, key)
    const workId = key.split('/')[1] ?? ''
    const dir = path.join(s.ctx.h.home, 'projects', s.ctx.projectId, 'works', workId)
    const tree = path.join(s.ctx.h.home, 'projects', s.ctx.projectId, 'worktrees', workId)
    const failed = JSON.parse(read(path.join(dir, 'work.json'))) as WorkState
    const plan = failed.delivery?.knowledge_plan
    if (!plan) throw new Error('실패한 전달에 채택 결과가 없음')
    const cut: WorkState = {
      ...failed,
      operation: {
        kind: 'deliver',
        stage: 'pr',
        started_at: failed.delivery?.at ?? '',
        choice: 'pr',
        task_id: 't-03',
        uncommitted: null,
        branch: `relay/${workId}`,
        base: 'main',
        knowledge: plan,
      },
    }
    await s.ctx.h.relay.close()
    await settle(s.ctx.h, key)
    fs.writeFileSync(path.join(dir, 'work.json'), `${JSON.stringify(cut, null, 2)}\n`)
    await s.ctx.h.reopen()
    await settle(s.ctx.h, key)
    expect(s.ctx.h.ui.works.get(key)?.operation?.kind).toBe('deliver')
    expect(await s.ctx.h.relay.retryOperation(key)).toEqual({ ok: true })
    await settle(s.ctx.h, key)
    const subjects = git(tree, 'log', '--format=%s', '-5').split('\n')
    expect(subjects.filter((x) => x.includes('지식'))).toEqual([`relay(${workId}): 지식 1건`])
    const done = JSON.parse(read(path.join(dir, 'work.json'))) as WorkState
    expect(done.status).toBe('pr')
    expect(done.delivery?.knowledge).toMatchObject({
      team: 1,
      commit: git(tree, 'rev-parse', 'HEAD'),
    })
  })

  it('채택한 것이 없던 끊긴 전달의 [다시 시도]는 기본 선택으로 다시 계산하지 않는다 (I73, D123)', async () => {
    const s = await setup()
    fs.writeFileSync(path.join(s.ctx.h.root, 'scenario.json'), JSON.stringify(claude()))
    const created = await s.ctx.h.relay.createWork(s.ctx.projectId, {
      request: 'relay M17 시험 (모두 버리고 끊긴 전달)',
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'remote',
    })
    if (!created.ok) throw new Error(created.error)
    const key = created.workKey
    const r = await drive(s.ctx.h.relay, s.ctx.h.ui, key, {
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    expect(r.status).toBe('paused')
    await settle(s.ctx.h, key)
    const workId = key.split('/')[1] ?? ''
    const dir = path.join(s.ctx.h.home, 'projects', s.ctx.projectId, 'works', workId)
    const tree = path.join(s.ctx.h.home, 'projects', s.ctx.projectId, 'worktrees', workId)
    // 사람이 후보를 모두 버리고 [PR 생성]을 눌렀고, push 도중 앱이 꺼졌다: 쓸 것이 없어 진행 중 작업에 계획이 없다
    await s.ctx.h.relay.close()
    await settle(s.ctx.h, key)
    const paused = JSON.parse(read(path.join(dir, 'work.json'))) as WorkState
    const cut: WorkState = {
      ...paused,
      operation: {
        kind: 'deliver',
        stage: 'push',
        started_at: new Date().toISOString(),
        choice: 'pr',
        task_id: 't-03',
        uncommitted: null,
        branch: `relay/${workId}`,
        base: 'main',
      },
    }
    fs.writeFileSync(path.join(dir, 'work.json'), `${JSON.stringify(cut, null, 2)}\n`)
    await s.ctx.h.reopen()
    await settle(s.ctx.h, key)
    expect(s.ctx.h.ui.works.get(key)?.operation?.kind).toBe('deliver')
    expect(await s.ctx.h.relay.retryOperation(key)).toEqual({ ok: true })
    await settle(s.ctx.h, key)
    const subjects = git(tree, 'log', '--format=%s', '-5').split('\n')
    expect(subjects.filter((x) => x.includes('지식'))).toEqual([])
    const done = JSON.parse(read(path.join(dir, 'work.json'))) as WorkState
    expect(done.status).toBe('pr')
    expect(done.delivery?.knowledge).toBeUndefined()
    expect(fs.existsSync(path.join(s.store, 'pending'))).toBe(false)
  })

  it('[머지 없이 끝내기]는 PR 대응 task의 후보를 거른 대로 공유 대기에 쓰고 다시 묻지 않는다 (I76, D310 (5))', async () => {
    const s = await setup()
    const w = await openPrWork(s.ctx, claude([]), 'relay M17 시험 (대응 후보)')
    s.gh.convo(w.pr, '합계에 세금을 넣지 마세요')
    const rule = '합계에는 세금을 넣지 않는다'
    setTasks(s, {
      'pr-respond': [
        { do: 'prompt' },
        { do: 'respond', text: '{id}: 반영했습니다.' },
        {
          do: 'write',
          file: 'handoff.md',
          text: handoff({
            summary: '코멘트에 대응했다.',
            knowledge_candidates: [{ ...CONSTRAINT, rule, terms: ['세금'] }],
          }),
        },
        { do: 'stop' },
      ],
    })
    const t = await startRound(s, w, 1)
    await approveRound(s, w, t.id)
    const r = await s.ctx.h.relay.respondKnowledge(w.key)
    if (!r.ok || !r.review) throw new Error('대응 후보가 없음')
    expect(r.review.candidates.map((c) => [c.taskId, c.rule])).toEqual([[t.id, rule]])
    expect(await s.ctx.h.relay.prEnd(w.key, {})).toEqual({ ok: true })
    await settle(s.ctx.h, w.key)
    const pendingDir = path.join(s.store, 'pending', 'constraint')
    const files = fs.readdirSync(pendingDir).map((f) => read(path.join(pendingDir, f)))
    expect(files.some((f) => f.includes(rule))).toBe(true)
    expect(workState(w).pr?.knowledge_at).toBeDefined()
    expect(await s.ctx.h.relay.respondKnowledge(w.key)).toEqual({ ok: true, review: null })
  })
})
