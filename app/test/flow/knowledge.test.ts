// [흐름] 지식 관리 (docs/implementation.md M17, I83). 가짜 claude가 handoff에 지식 후보와 사람 결정, knowledge_feedback을
// 남기고, Work 완료 화면의 거르기와 전달이 앱 저장소(나만, 공유 대기)와 레포의 지식 폴더에 쓰고, 다음 Work의 context.md에
// `참고 지식`으로 들어가는지 본다. PR 진행이 드는 경우는 pr-knowledge.test.ts가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { renderEntry } from '../../src/core/knowledge'
import type { KnowledgeCandidateField } from '../../src/shared/contracts'
import type { KnowledgeChoices, KnowledgeEntry } from '../../src/shared/knowledge'
import type { ReviewView } from '../../src/shared/views'
import type { WorkState } from '../../src/shared/work'
import { drive } from './driver'
import { git, harness, makeRepo, register, settle, writeFiles, type Harness } from './harness'
import {
  REPO_FILES,
  REQUEST,
  handoff,
  scenario,
  steps,
  type Scenario,
  type Step,
} from './scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')
const DIR = 'docs/knowledge/'

/** intake가 사람에게 물어 정한 도메인 규칙. 경로가 있어도 용어(평균)로 다음 Work의 intake에 들어간다 (D311) */
const RULE = '빈 배열의 평균은 0이다'
const DOMAIN: KnowledgeCandidateField = {
  kind: 'domain',
  rule: RULE,
  paths: ['src/avg.js'],
  terms: ['평균', '빈 배열'],
  why: '사람이 답함: 화면에 NaN 대신 0을 보인다',
  not_in_code: '사람이 정함',
  incentive: '빈 배열에서 예외를 던지게 바꾼다',
  decision: RULE,
}
const RECIPE: KnowledgeCandidateField = {
  kind: 'recipe',
  rule: '재현은 node -e로 avg([])를 찍는다',
  paths: [],
  terms: ['재현'],
  why: '테스트 러너 없이 바로 확인됨',
  not_in_code: '레포에 재현 스크립트가 없음',
  incentive: '새 테스트 파일부터 만든다',
}

const intakeSteps = (h: Parameters<typeof handoff>[0]): Step[] =>
  steps('intake').map((st) =>
    st.do === 'write' && st.file === 'handoff.md' ? { ...st, text: handoff(h) } : st,
  )

const fixSteps = (h: Parameters<typeof handoff>[0]): Step[] =>
  steps('fix').map((st) =>
    st.do === 'write' && st.file === 'handoff.md' ? { ...st, text: handoff(h) } : st,
  )

/** Work 1: intake가 사람 결정과 다듬은 후보, 레시피 후보를 남긴다 */
const WORK1: Scenario = scenario({
  'work-start': intakeSteps({
    decisions: [
      { what: RULE, why: '사람이 질문에 답함', by: 'human' },
      { what: '이번 수정은 avg만', why: '사람이 범위를 정함', by: 'human' },
    ],
    knowledge_candidates: [DOMAIN, RECIPE],
  }),
})

interface Setup {
  h: Harness
  repo: string
  remote: string
  projectId: string
  store: string
  create(): Promise<string>
  dir(key: string): string
  tree(key: string): string
}

async function setup(
  s: Scenario,
  o: { env?: Record<string, string>; files?: Record<string, string> } = {},
): Promise<Setup> {
  h = await harness({ scenario: s, ...(o.env ? { env: o.env } : {}) })
  const hh = h
  const { repo, remote } = makeRepo(hh.root, 'sample', { ...REPO_FILES, ...o.files })
  const projectId = await register(hh, repo)
  const id = (key: string) => key.split('/')[1] ?? ''
  return {
    h: hh,
    repo,
    remote,
    projectId,
    store: path.join(hh.home, 'projects', projectId, 'knowledge'),
    create: async () => {
      const r = await hh.relay.createWork(projectId, {
        request: REQUEST,
        type: 'bugfix',
        baseBranch: 'main',
        baseLocation: 'local',
      })
      if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
      return r.workKey
    },
    dir: (key) => path.join(hh.home, 'projects', projectId, 'works', id(key)),
    tree: (key) => path.join(hh.home, 'projects', projectId, 'worktrees', id(key)),
  }
}

function work(dir: string): WorkState {
  return JSON.parse(read(path.join(dir, 'work.json'))) as WorkState
}

/** verify가 승인 대기가 될 때까지 가고 Work 완료 화면을 읽는다 */
async function toCompletion(s: Setup, key: string): Promise<ReviewView> {
  const r = await drive(s.h.relay, s.h.ui, key, {
    pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
  })
  expect(r, s.h.ui.dump()).toMatchObject({ status: 'paused' })
  await settle(s.h, key)
  const verify = s.h.ui.works.get(key)?.current ?? ''
  const review = await s.h.relay.review(key, verify)
  if (!review) throw new Error('Work 완료 화면이 없음')
  return review
}

/** 앱 저장소의 항목 파일 (scope/<kind>/<id>.md) */
function storeFiles(s: Setup, scope: 'mine' | 'pending'): string[] {
  const dir = path.join(s.store, scope)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.md'))
    .map((f) => read(path.join(dir, f)))
}

function context(s: Setup, key: string, task: string): string {
  const dir = path.join(s.dir(key), 'tasks')
  const name = fs.readdirSync(dir).find((d) => d.startsWith(task.replace('t-', '')))
  return read(path.join(dir, name ?? '', 'context.md'))
}

function entry(over: Partial<KnowledgeEntry>): KnowledgeEntry {
  return {
    id: 'failure-0000000a',
    kind: 'failure',
    subkind: null,
    status: 'active',
    superseded_by: null,
    paths: ['src/avg.js'],
    terms: ['나눗셈'],
    hashes: {},
    source: { work: 'w-0', task: 't-02', by: 'ai' },
    rule: '길이로 나누기 전에 0을 확인한다',
    why: '지난 Work에서 NaN',
    not_in_code: '테스트가 빈 배열을 다루지 않음',
    incentive: '나눗셈을 그대로 둔다',
    ...over,
  }
}

describe('[흐름] 지식 관리 (M17)', () => {
  it('Work 1의 [완료만]이 나만과 공유 대기에 쓰고, Work 2의 intake에 도메인 규칙이 용어로 들어간다', async () => {
    const s = await setup(WORK1)
    const key = await s.create()
    const review = await toCompletion(s, key)
    const k = review.completion?.knowledge
    expect(k?.candidates.map((c) => [c.key, c.unrefined, c.by, c.kind])).toEqual([
      ['t-01#k1', false, 'human', 'domain'],
      ['t-01#k2', false, 'ai', 'recipe'],
      ['t-01#d2', true, 'human', null],
    ])
    const choices: KnowledgeChoices = {
      candidates: { 't-01#k2': { adopt: true, share: 'mine', replace: null } },
    }
    expect(await s.h.relay.approve(key, review.taskId, { knowledge: choices })).toEqual({
      ok: true,
    })
    await settle(s.h, key)
    expect(work(s.dir(key)).status).toBe('completed')
    const pending = storeFiles(s, 'pending')
    expect(pending).toHaveLength(1)
    expect(pending[0]).toContain(`# ${RULE}`)
    // 해시는 Work 완료 때의 HEAD로 적는다 (I72)
    expect(pending[0]).toContain(`src/avg.js: ${git(s.tree(key), 'rev-parse', 'HEAD:src/avg.js')}`)
    const mine = storeFiles(s, 'mine')
    expect(mine.map((t) => t.includes(RECIPE.rule))).toEqual([true])
    const approved = read(path.join(s.dir(key), 'events.jsonl'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { type: string; payload: Record<string, unknown> })
      .find((e) => e.type === 'task.approved' && e.payload['knowledge'])
    expect(approved?.payload['knowledge']).toEqual({ team: 1, mine: 1, pending: 1 })

    // Work 2: 같은 영역의 다음 Work. intake의 context.md에 경로가 있는 도메인 규칙이 용어로 들어간다 (D311)
    const key2 = await s.create()
    await s.h.ui.until(
      () => (fs.existsSync(path.join(s.dir(key2), 'tasks')) ? true : null),
      'Work 2의 task 디렉터리',
    )
    await drive(s.h.relay, s.h.ui, key2, { pauseAt: (t) => t.node === 'intake' })
    const ctx = context(s, key2, 't-01')
    expect(ctx).toContain('## 참고 지식')
    expect(ctx).toContain(`- [도메인 규칙] ${RULE} (src/avg.js) — `)
    // 나만 쓰는 레시피도 넣는다. 공유 대기와 나만은 재확인 표시가 없다 (D316)
    expect(ctx).toContain(RECIPE.rule)
    expect(ctx).not.toContain('재확인 필요')
    // 파이프라인 task의 설정 파일에는 지식 폴더의 deny 규칙이 있다 (I78)
    const settings = read(path.join(s.dir(key2), 'tasks', '01-intake', 'task.settings.json'))
    expect(settings).toContain(`${DIR}**`)
    expect(settings).toContain('/knowledge/**')
  })

  it('되감기로 폐기한 task의 후보는 완료 화면에 없다 (D283, 5.4)', async () => {
    const base = scenario()
    const s = await setup({
      ...base,
      tasks: {
        ...base.tasks,
        't-02': fixSteps({ knowledge_candidates: [{ ...RECIPE, rule: '폐기될 후보' }] }),
        't-04': fixSteps({ knowledge_candidates: [{ ...RECIPE, rule: '남을 후보' }] }),
      },
    })
    const key = await s.create()
    const first = await toCompletion(s, key)
    expect(first.completion?.knowledge?.candidates.map((c) => c.rule)).toEqual(['폐기될 후보'])
    const p = await s.h.relay.stepPreview(key, 'fix', false)
    if (!p.ok) throw new Error(p.error)
    expect(
      await s.h.relay.selectStep(key, {
        node: 'fix',
        keepCode: false,
        instruction: '',
        expect: p.preview.expect,
      }),
    ).toEqual({ ok: true })
    const again = await toCompletion(s, key)
    expect(again.completion?.knowledge?.candidates.map((c) => c.rule)).toEqual(['남을 후보'])
  })

  it('[push]로 끝내면 push한 브랜치에 지식 커밋이 없고 팀 지식은 공유 대기에 남는다 (D287)', async () => {
    const s = await setup(WORK1)
    const key = await s.create()
    await toCompletion(s, key)
    expect(await s.h.relay.deliver(key, { choice: 'push', uncommitted: null })).toEqual({
      ok: true,
    })
    await settle(s.h, key)
    const branch = `relay/${key.split('/')[1] ?? ''}`
    const log = git(s.remote, 'log', '--format=%s', branch)
    expect(log).not.toContain('지식')
    expect(git(s.remote, 'ls-tree', '-r', '--name-only', branch)).not.toContain(DIR)
    expect(storeFiles(s, 'pending').some((t) => t.includes(RULE))).toBe(true)
    expect(work(s.dir(key)).delivery?.knowledge).toEqual({ team: 2, mine: 0, pending: 2 })
  })

  it('기준 브랜치의 팀 지식 경로를 바꾸면 다음 task에 재확인 필요로 들어가고 완료 화면에 보인다 (D316, D317)', async () => {
    const s = await setup(scenario())
    // 기준 브랜치에 팀 지식을 머지해 둔다: src/avg.js의 지금 해시로 적은 실패 부류
    const hash = git(s.repo, 'rev-parse', 'HEAD:src/avg.js')
    writeFiles(s.repo, {
      [`${DIR}failure/failure-0000000a.md`]: renderEntry(entry({ hashes: { 'src/avg.js': hash } })),
    })
    git(s.repo, 'add', '-A')
    git(s.repo, 'commit', '-qm', 'docs: 지식')
    // 공유 대기의 같은 경로 항목은 해시가 달라도 표시가 없다
    fs.mkdirSync(path.join(s.store, 'pending', 'failure'), { recursive: true })
    fs.writeFileSync(
      path.join(s.store, 'pending', 'failure', 'failure-0000000b.md'),
      renderEntry(
        entry({
          id: 'failure-0000000b',
          rule: '공유 대기의 실패 부류',
          hashes: { 'src/avg.js': 'x' },
        }),
      ),
    )
    const key = await s.create()
    const review = await toCompletion(s, key)
    const ctx = context(s, key, 't-03')
    expect(ctx).toContain('길이로 나누기 전에 0을 확인한다 (src/avg.js) — ')
    expect(ctx).toMatch(/failure-0000000a\.md \(재확인 필요\)/)
    expect(ctx).toMatch(/공유 대기의 실패 부류 \(src\/avg\.js\) — .*failure-0000000b\.md\n/)
    expect(review.completion?.knowledge?.stale.map((x) => x.id)).toEqual(['failure-0000000a'])
    // [그대로 맞음]은 해시를 새로 적어 공유 대기로 둔다 (D320 (4))
    expect(
      await s.h.relay.approve(key, review.taskId, {
        knowledge: { stale: { 'failure-0000000a': { action: 'confirm' } } },
      }),
    ).toEqual({ ok: true })
    await settle(s.h, key)
    const confirmed = storeFiles(s, 'pending').find((t) => t.includes('id: failure-0000000a'))
    expect(confirmed).toContain(`src/avg.js: ${git(s.tree(key), 'rev-parse', 'HEAD:src/avg.js')}`)
  })

  it('knowledge_feedback은 대체·버림 후보이고, supersedes를 적은 후보는 옛 규칙의 대체가 기본이다 (D313, D318)', async () => {
    const old = entry({
      id: 'domain-0000000c',
      kind: 'domain',
      paths: [],
      terms: ['평균'],
      rule: '빈 배열의 평균은 NaN이다',
    })
    const s = await setup(
      scenario({
        'work-start': intakeSteps({
          decisions: [{ what: RULE, why: '사람이 옛 규칙을 고침', by: 'human' }],
          knowledge_candidates: [{ ...DOMAIN, paths: [], supersedes: old.id }],
          knowledge_feedback: [
            { id: old.id, note: '사람이 0으로 바꿈' },
            { id: 'recipe-0000000d', note: '명령이 바뀜' },
          ],
        }),
      }),
      { files: { [`${DIR}domain/domain-0000000c.md`]: renderEntry(old) } },
    )
    const key = await s.create()
    const review = await toCompletion(s, key)
    expect(context(s, key, 't-01')).toContain('빈 배열의 평균은 NaN이다')
    const k = review.completion?.knowledge
    const c = k?.candidates[0]
    expect(c?.supersedes?.id).toBe(old.id)
    expect(c?.feedback).toEqual(['사람이 0으로 바꿈'])
    expect(k?.feedback.map((f) => [f.id, f.entry])).toEqual([['recipe-0000000d', null]])
    expect(await s.h.relay.approve(key, review.taskId, {})).toEqual({ ok: true })
    await settle(s.h, key)
    // 머지된 팀 지식의 대체는 옛 항목을 대체됨으로 고쳐 함께 공유 대기에 둔다 (D302)
    const files = storeFiles(s, 'pending')
    const superseded = files.find((t) => t.includes(`id: ${old.id}`))
    expect(superseded).toContain('status: superseded')
    expect(files.find((t) => t.includes(RULE))).toContain('status: active')
    // 다음 Work는 옛 규칙 대신 새 규칙을 받는다 (I74: 공유 대기가 머지된 팀 지식보다 앞)
    const key2 = await s.create()
    await drive(s.h.relay, s.h.ui, key2, { pauseAt: (t) => t.node === 'intake' })
    const ctx = context(s, key2, 't-01')
    expect(ctx).toContain(RULE)
    expect(ctx).not.toContain('빈 배열의 평균은 NaN이다')
  })

  it('팀 공유를 끈 프로젝트는 [PR 생성]에도 지식 커밋이 없고 채택은 나만이다 (D322)', async () => {
    const s = await setup(WORK1)
    expect(
      await s.h.relay.updateProjectSettings(s.projectId, {
        allowed_bots: [],
        merge_method: null,
        knowledge_share: false,
      }),
    ).toEqual({ ok: true })
    const key = await s.create()
    const review = await toCompletion(s, key)
    expect(review.completion?.knowledge?.share).toBe(false)
    expect(await s.h.relay.deliver(key, { choice: 'pr', uncommitted: null })).toEqual({ ok: true })
    await settle(s.h, key)
    expect(git(s.tree(key), 'log', '--format=%s', '-3')).not.toContain('지식')
    expect(storeFiles(s, 'pending')).toEqual([])
    expect(storeFiles(s, 'mine').some((t) => t.includes(RULE))).toBe(true)
  })

  it('RELAY_KNOWLEDGE=off면 `참고 지식` 절과 지식 칸이 없고 저장하지 않는다 (I84)', async () => {
    const s = await setup(WORK1, { env: { RELAY_KNOWLEDGE: 'off' } })
    const key = await s.create()
    const review = await toCompletion(s, key)
    expect(review.completion?.knowledge).toBeNull()
    expect(context(s, key, 't-01')).not.toContain('참고 지식')
    expect(read(path.join(s.dir(key), 'tasks', '01-intake', 'task.settings.json'))).not.toContain(
      '/knowledge/**',
    )
    expect(await s.h.relay.approve(key, review.taskId, {})).toEqual({ ok: true })
    await settle(s.h, key)
    expect(fs.existsSync(s.store)).toBe(false)
    expect(s.h.ui.projectList[0]?.knowledgeOff).toBe(true)
  })
})
