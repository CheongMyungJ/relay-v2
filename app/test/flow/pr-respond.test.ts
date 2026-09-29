// [흐름] PR 대응 (docs/implementation.md M10, 시나리오 10-3~10-8, D168~D207).
// 가짜 gh(8.2)와 로컬 bare 원격으로 [실제]와 같은 공통 시나리오(pr-scenario.ts의 runRespondScenario)를 돌고, 가짜로만 만들
// 수 있는 경우를 더 본다: 게시가 실패하거나 끊긴 뒤의 [다시 시도](D123, D194), 게시하고도 오류를 돌려준 요청(D194),
// push가 원격의 새 커밋 때문에 거절된 라운드(D193), 없어진 코멘트(D205), 대응 task가 도는 동안의 재시작(시나리오 9-7)과
// fast-forward(D193), 사람 지시만의 라운드(D182), 기존 테스트 변경(D202), replies.md의 오류(D204).
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { jsonText } from '../../src/adapters/store'
import { GONE_SKIP } from '../../src/core/respond'
import type { TaskView } from '../../src/shared/views'
import type { WorkState } from '../../src/shared/work'
import { CART_FILES, FakeGitHub, FakeWorld } from './github'
import { git, harness, makeRepo, register, settle, type Harness } from './harness'
import {
  HEAD_CODE,
  currentUntil,
  openPrWork,
  prItems,
  refreshUntil,
  respondClaude,
  runRespondScenario,
  view,
  workEvents,
  workState,
  type PrContext,
  type PrWork,
} from './pr-scenario'
import { handoff, type Step } from './scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

interface Setup {
  ctx: PrContext
  gh: FakeGitHub
  world: FakeWorld
  repo: string
  remote: string
}

async function setup(o: { env?: Record<string, string>; config?: object } = {}): Promise<Setup> {
  h = await harness({ config: o.config ?? {}, env: o.env ?? {} })
  const { repo, remote } = makeRepo(h.root, 'cart', CART_FILES)
  const projectId = await register(h, repo)
  const scratch = path.join(h.root, 'outside')
  fs.mkdirSync(scratch)
  const gh = new FakeGitHub(path.join(h.root, 'record'), remote, scratch)
  const world = new FakeWorld(gh)
  return {
    ctx: { h, world, projectId, repo, note: () => undefined, created: [] },
    gh,
    world,
    repo,
    remote,
  }
}

const CART = CART_FILES['src/cart.mjs'] ?? ''

/**
 * 대응할 PR 진행 Work: 파일 끝에 함수를 더하고 ci-fail을 둔다. 대응 task는 ci-fail을 지워 커밋하고 답글 초안을 쓴다
 * (respondClaude). tasks로 task id별 단계를 바꾼다(대응 task는 t-05부터)
 */
function openWork(s: Setup, tasks: Record<string, Step[]> = {}): Promise<PrWork> {
  const claude = respondClaude(
    { 'src/cart.mjs': CART + HEAD_CODE, 'ci-fail': 'relay M10 흐름 시험\n' },
    'relay M10 흐름 시험',
  )
  return openPrWork(
    s.ctx,
    { ...claude, tasks: { ...claude.tasks, ...tasks } },
    'relay M10 흐름 시험',
  )
}

/** 대응 task의 시나리오를 더한다 (이미 연 Work의 다음 라운드) */
function addTasks(s: Setup, tasks: Record<string, Step[]>): void {
  const file = path.join(s.ctx.h.root, 'scenario.json')
  const scenario = JSON.parse(fs.readFileSync(file, 'utf8')) as { tasks: Record<string, Step[]> }
  fs.writeFileSync(file, JSON.stringify({ ...scenario, tasks: { ...scenario.tasks, ...tasks } }))
}

/** 새 항목이 count개가 될 때까지 읽고, 모두 넣어 [대응 시작]한 뒤 대응 task가 pred(기본: 승인 대기)가 될 때까지 */
async function startRound(
  s: Setup,
  w: PrWork,
  count: number,
  o: { instruction?: string; until?: (t: TaskView) => boolean } = {},
): Promise<TaskView> {
  const p = await refreshUntil(
    s.ctx,
    w,
    (x) => x.respond.enabled && x.respond.items.length === count,
    `새 항목 ${count}개와 [대응 시작]`,
  )
  expect(
    await s.ctx.h.relay.prRespond(w.key, {
      items: p.respond.items,
      instruction: o.instruction ?? '',
    }),
  ).toEqual({ ok: true })
  const t = await currentUntil(
    s.ctx,
    w,
    (x) => x.node === 'respond' && (o.until ? o.until(x) : x.status === 'awaiting_approval'),
    '대응 task',
  )
  await settle(s.ctx.h, w.key)
  return t
}

/** 소유자의 코멘트 셋: 대화 코멘트, 리뷰 본문, 인라인 코멘트 */
function threeComments(s: Setup, w: PrWork): { convo: number; review: number; inline: number } {
  const head = workState(w).pr?.head ?? ''
  const convo = s.gh.convo(w.pr, '대화 코멘트')
  const review = s.gh.review(w.pr, { body: '리뷰 본문', commit: head })
  const inline = s.gh.inline(w.pr, { body: '인라인 코멘트', path: 'src/cart.mjs', line: 3, review })
  return { convo, review, inline }
}

const posts = (s: Setup) => s.ctx.h.ghRecords().filter((r) => r['type'] === 'api post')
const replies = (s: Setup, w: PrWork) =>
  s.gh.comments(w.pr).filter((c) => c.body.includes('<!-- relay:'))

describe('[흐름] PR 대응 (M10, 가짜 gh)', () => {
  it('공통 시나리오: 다시 실행, [대응 시작], 승인 뒤 push와 답글 게시, 처리됨, 판정표 경고, 머지 (runRespondScenario)', async () => {
    const s = await setup()
    await runRespondScenario(s.ctx)
  })

  it('게시가 실패하면 승인 대기로 남아 오류를 보인다. [다시 시도]는 게시한 답글을 건너뛰고, 게시하고도 오류를 돌려준 요청은 원격의 표시를 찾아 다시 게시하지 않는다 (D194)', async () => {
    const s = await setup()
    const w = await openWork(s)
    threeComments(s, w)
    const t = await startRound(s, w, 3)
    // 첫 답글은 게시하고, 둘째는 게시하고도 오류를 돌려주고, 셋째는 시도하지 않는다
    s.gh.postFaults(['ok', 'posted'])
    const r = await s.ctx.h.relay.approve(w.key, t.id, {})
    expect(r).toMatchObject({
      ok: false,
      error: expect.stringContaining('PR 대응의 답글 게시 실패'),
    })
    await settle(s.ctx.h, w.key)
    const failed = workState(w)
    expect(failed.operation).toBeUndefined()
    const task = failed.tasks.find((x) => x.id === t.id)
    expect(task).toMatchObject({
      status: 'awaiting_approval',
      respond: { failure: { stage: 'reply' } },
    })
    const round = prItems(w).rounds[0]
    expect(
      round?.replies.map((x) => [x.comment_id !== undefined, x.attempted_at !== undefined]),
    ).toEqual([
      [true, true],
      [false, true],
      [false, false],
    ])
    expect(replies(s, w)).toHaveLength(2)
    const review = await s.ctx.h.relay.review(w.key, t.id)
    expect(review?.emphasis[0]).toMatchObject({ kind: 'respond_failed', title: '답글 게시 실패' })
    expect(review?.respond?.failure).toMatchObject({ stage: '답글 게시' })
    // 대응 task가 끝나지 않아 [머지]와 [대응 시작]은 꺼져 있고, 배지는 승인 대기다
    expect(view(s.ctx, w).badge.kind).toBe('awaiting_approval')
    expect(view(s.ctx, w).pr?.respond.enabled).toBe(false)
    const before = posts(s).length
    expect(await s.ctx.h.relay.approve(w.key, t.id, {})).toEqual({ ok: true })
    await settle(s.ctx.h, w.key)
    // 둘째는 원격에서 표시를 찾아 id만 적고, 셋째만 게시한다. push는 다시 하지 않는다
    expect(posts(s).length).toBe(before + 1)
    expect(replies(s, w)).toHaveLength(3)
    const done = prItems(w).rounds[0]
    expect(done?.replies.every((x) => x.comment_id !== undefined)).toBe(true)
    expect(new Set(done?.replies.map((x) => x.comment_id)).size).toBe(3)
    expect(workEvents(w).filter((e) => e.type === 'pr.pushed')).toHaveLength(1)
    const after = workState(w).tasks.find((x) => x.id === t.id)
    expect(after?.status).toBe('approved')
    expect(after?.respond?.failure).toBeUndefined()
    expect(prItems(w).items.filter((i) => i.status === 'done')).toHaveLength(3)
  })

  it('push·게시가 끊기면 끊긴 작업이다. [다시 시도]는 이미 원격에 있는 커밋을 다시 보내지 않고 끊긴 곳부터 게시한다. [무시]는 실패로 남긴다 (시나리오 9-7, D123, D194)', async () => {
    for (const mode of ['push', 'reply', 'ignore'] as const) {
      const s = await setup()
      const w = await openWork(s)
      threeComments(s, w)
      const t = await startRound(s, w, 3)
      let cut: WorkState
      if (mode === 'reply') {
        // 첫 답글을 게시하고 둘째에서 끊겼다: 둘째는 시도했지만 게시되지 않았다
        s.gh.postFaults(['ok', 'error'])
        await s.ctx.h.relay.approve(w.key, t.id, {})
        await settle(s.ctx.h, w.key)
        const state = workState(w)
        const task = state.tasks.find((x) => x.id === t.id)
        if (!task?.respond) throw new Error('대응 task 없음')
        const { failure: _f, ...respond } = task.respond
        cut = {
          ...state,
          tasks: state.tasks.map((x) => (x.id === t.id ? { ...x, respond } : x)),
          operation: {
            kind: 'respond',
            stage: 'reply',
            started_at: state.pr?.started_at ?? '',
            task_id: t.id,
            rounds: [t.id],
            from: state.pr?.head ?? '',
          },
        }
      } else {
        // push하다 끊겼다: 커밋은 이미 원격에 올라갔고 답글은 아직이다
        git(w.tree, 'push', '-q', 'origin', w.branch)
        const state = workState(w)
        cut = {
          ...state,
          operation: {
            kind: 'respond',
            stage: 'push',
            started_at: state.pr?.started_at ?? '',
            task_id: t.id,
            rounds: [t.id],
            from: state.pr?.head ?? '',
          },
        }
      }
      await s.ctx.h.relay.close()
      fs.writeFileSync(path.join(w.dir, 'work.json'), jsonText(cut))
      await s.ctx.h.reopen()
      await settle(s.ctx.h, w.key)
      const v = view(s.ctx, w)
      expect(v.operation).toMatchObject({
        kind: 'respond',
        title: 'PR 대응의 push와 답글 게시가 끊겼습니다',
      })
      expect(v.badge.kind).toBe('recovery')
      if (mode === 'ignore') {
        expect(await s.ctx.h.relay.ignoreOperation(w.key)).toEqual({ ok: true })
        await settle(s.ctx.h, w.key)
        const task = workState(w).tasks.find((x) => x.id === t.id)
        expect(task).toMatchObject({
          status: 'awaiting_approval',
          respond: { failure: { stage: 'push', error: '앱이 꺼져 끊김' } },
        })
        expect(workState(w).operation).toBeUndefined()
        expect(replies(s, w)).toHaveLength(0)
      } else {
        expect(await s.ctx.h.relay.retryOperation(w.key)).toEqual({ ok: true })
        await settle(s.ctx.h, w.key)
        const done = workState(w)
        expect(done.operation).toBeUndefined()
        expect(done.tasks.find((x) => x.id === t.id)?.status).toBe('approved')
        expect(replies(s, w)).toHaveLength(3)
        expect(prItems(w).rounds[0]?.pushed?.commits).toEqual([git(w.tree, 'rev-parse', 'HEAD')])
        expect(await s.world.branchTip(w.branch)).toBe(git(w.tree, 'rev-parse', 'HEAD'))
      }
      await h?.close()
      h = undefined
    }
  })

  it('push가 원격의 새 커밋 때문에 거절되면 라운드를 승인된 채 미루고 갈라짐 항목이 생긴다. 다음 라운드가 원격을 병합해 함께 push하고 앞 라운드의 답글도 게시한다 (D193)', async () => {
    const s = await setup()
    const w = await openWork(s)
    s.gh.convo(w.pr, '대화 코멘트')
    const t1 = await startRound(s, w, 1)
    // 대응 task가 도는 동안 relay 밖에서 PR 브랜치에 커밋했다
    const outside = await s.world.commit(w.branch, { 'outside.txt': '밖\n' }, '밖의 커밋')
    expect(await s.ctx.h.relay.approve(w.key, t1.id, {})).toEqual({ ok: true })
    await settle(s.ctx.h, w.key)
    const deferred = workState(w).tasks.find((x) => x.id === t1.id)
    expect(deferred).toMatchObject({ status: 'approved' })
    expect(deferred?.respond?.deferred_at).toBeDefined()
    expect(deferred?.respond?.published_at).toBeUndefined()
    expect(replies(s, w)).toHaveLength(0)
    expect(await s.world.branchTip(w.branch)).toBe(outside)
    const diverged = await refreshUntil(
      s.ctx,
      w,
      (p) => p.items.some((i) => i.kind === 'diverged' && i.status === 'new'),
      '갈라짐 항목',
    )
    // 미룬 라운드의 항목은 게시하기 전까지 대응 중이라 머지를 막는다
    expect(diverged.items.find((i) => i.kind === 'convo')?.status).toBe('responding')
    expect(diverged.rounds[0]).toMatchObject({ state: 'deferred' })
    addTasks(s, {
      't-06': [
        { do: 'prompt' },
        { do: 'merge', from: 'remote' },
        { do: 'respond' },
        { do: 'write', file: 'handoff.md', text: handoff({ summary: '원격을 병합했다.' }) },
        { do: 'stop' },
      ],
    })
    const t2 = await startRound(s, w, 1)
    const review = await s.ctx.h.relay.review(w.key, t2.id)
    expect(review?.respond?.deferred).toEqual([expect.stringContaining('PR 대응')])
    expect(await s.ctx.h.relay.approve(w.key, t2.id, {})).toEqual({ ok: true })
    await settle(s.ctx.h, w.key)
    const state = workState(w)
    expect(state.tasks.filter((x) => x.respond?.published_at).map((x) => x.id)).toEqual([
      t1.id,
      t2.id,
    ])
    const head = git(w.tree, 'rev-parse', 'HEAD')
    expect(await s.world.branchTip(w.branch)).toBe(head)
    expect(git(w.tree, 'merge-base', '--is-ancestor', outside, head)).toBe('')
    const file = prItems(w)
    expect(file.rounds.find((r) => r.task_id === t1.id)?.pushed_with).toBe(t2.id)
    expect(file.rounds.find((r) => r.task_id === t2.id)?.pushed?.commits).toContain(head)
    expect(
      file.items
        .filter((i) => i.status === 'done')
        .map((i) => i.kind)
        .sort(),
    ).toEqual(['convo', 'diverged'])
    // 앞 라운드(1)의 답글이 게시됐다
    expect(replies(s, w).map((c) => /\/(\d+) -->/.exec(c.body)?.[1])).toEqual(['1'])
  })

  it('GitHub에서 없어진 코멘트의 답글은 게시하지 않고 건너뛰며 그 항목은 처리됨이다 (D205)', async () => {
    const s = await setup()
    const w = await openWork(s)
    const c = threeComments(s, w)
    const t = await startRound(s, w, 3)
    // 대화 코멘트는 지운 것을 읽었고, 인라인 코멘트는 읽기 전에 지웠다(게시가 404로 실패한 뒤 다시 읽어도 없음)
    s.gh.remove(w.pr, 'convo', c.convo)
    await refreshUntil(
      s.ctx,
      w,
      (p) => p.items.some((i) => i.id === `convo:${c.convo}` && i.gone),
      '지운 대화 코멘트',
    )
    s.gh.remove(w.pr, 'inline', c.inline)
    expect(await s.ctx.h.relay.approve(w.key, t.id, {})).toEqual({ ok: true })
    await settle(s.ctx.h, w.key)
    const round = prItems(w).rounds[0]
    expect(
      round?.replies.map((x) => [x.item.split(':')[0], x.skipped ?? x.comment_id !== undefined]),
    ).toEqual([
      ['review', true],
      ['inline', GONE_SKIP],
      ['convo', GONE_SKIP],
    ])
    expect(replies(s, w)).toHaveLength(1)
    expect(prItems(w).items.filter((i) => i.status === 'done')).toHaveLength(3)
    expect(workEvents(w).find((e) => e.type === 'pr.replied')?.payload).toMatchObject({
      skipped: [`inline:${c.inline}`, `convo:${c.convo}`],
    })
  })

  it('대응 task가 도는 동안에는 원격만 앞서도 fast-forward하지 않는다. 재시작하면 다른 task처럼 조정하고 [재개]만 남는다 (D193, 시나리오 9-7)', async () => {
    const s = await setup()
    const w = await openWork(s, { 't-05': [{ do: 'prompt' }, { do: 'waitEnter' }] })
    s.gh.convo(w.pr, '대화 코멘트')
    const t = await startRound(s, w, 1, { until: (x) => x.status === 'working' && x.live })
    const local = git(w.tree, 'rev-parse', 'HEAD')
    const outside = await s.world.commit(w.branch, { 'outside.txt': '밖\n' }, '밖의 커밋')
    const p = await refreshUntil(s.ctx, w, (x) => x.head === outside, '원격만 앞섬')
    expect(p.sync).toBe('ff')
    expect(git(w.tree, 'rev-parse', 'HEAD')).toBe(local)
    expect(p.gate.reasons).toContain('돌거나 기다리는 PR 대응 task가 있음')
    expect(view(s.ctx, w).actions).toMatchObject({ interrupt: true, resume: false, abandon: false })
    await s.ctx.h.relay.close()
    await s.ctx.h.reopen()
    await settle(s.ctx.h, w.key)
    const task = workState(w).tasks.find((x) => x.id === t.id)
    expect(task).toMatchObject({ status: 'interrupted', session: { alive: false } })
    expect(view(s.ctx, w).actions).toMatchObject({ interrupt: false, resume: true })
    expect(view(s.ctx, w).badge.kind).toBe('interrupted')
    // 켤 때 읽어도 받지 않는다
    await refreshUntil(s.ctx, w, (x) => x.head === outside, '켠 뒤 읽기')
    expect(git(w.tree, 'rev-parse', 'HEAD')).toBe(local)
  })

  it('사람 지시만으로 시작한 라운드는 답글 없이 push한다 (D182)', async () => {
    const s = await setup()
    const w = await openWork(s)
    const t = await startRound(s, w, 0, { instruction: '로그 문구를 다듬어 주세요' })
    const context = fs.readFileSync(path.join(w.dir, 'tasks', '05-respond', 'context.md'), 'utf8')
    expect(context).toContain('로그 문구를 다듬어 주세요')
    expect(context).toContain('없음: 사람 지시만으로 시작한 라운드다 (D182)')
    expect(await s.ctx.h.relay.approve(w.key, t.id, {})).toEqual({ ok: true })
    await settle(s.ctx.h, w.key)
    expect(workState(w).tasks.find((x) => x.id === t.id)?.respond?.published_at).toBeDefined()
    expect(posts(s)).toHaveLength(0)
    expect(await s.world.branchTip(w.branch)).toBe(git(w.tree, 'rev-parse', 'HEAD'))
  })

  it('이번 라운드가 기존 테스트를 고치면 승인 화면의 강조 영역에 보인다 (D180, D202)', async () => {
    const s = await setup()
    const test = CART_FILES['test/cart.test.mjs'] ?? ''
    const w = await openWork(s, {
      't-05': [
        { do: 'prompt' },
        {
          do: 'commit',
          files: {
            'test/cart.test.mjs': `${test}// 약하게 고침\n`,
            'test/new.test.mjs': '// 새 시험\n',
          },
          message: '시험을 고침',
        },
        { do: 'respond' },
        { do: 'write', file: 'handoff.md', text: handoff() },
        { do: 'stop' },
      ],
    })
    s.gh.convo(w.pr, '대화 코멘트')
    const t = await startRound(s, w, 1)
    const review = await s.ctx.h.relay.review(w.key, t.id)
    const tests = review?.emphasis.find((e) => e.kind === 'existing_tests')
    expect(tests?.lines[0]).toBe('test/cart.test.mjs')
    expect(tests?.lines).not.toContain('test/new.test.mjs')
  })

  it('replies.md의 오류(코멘트 항목의 절 없음)는 [오류 무시하고 승인]으로도 넘길 수 없다 (D190, D204)', async () => {
    const s = await setup()
    const w = await openWork(s)
    const c = threeComments(s, w)
    addTasks(s, {
      't-05': [
        { do: 'prompt' },
        { do: 'respond', skip: [`convo:${c.convo}`] },
        { do: 'write', file: 'handoff.md', text: handoff() },
        { do: 'stop' },
      ],
    })
    const t = await startRound(s, w, 3, { until: (x) => x.status === 'idle' })
    const review = await s.ctx.h.relay.review(w.key, t.id)
    expect(review?.gates.none).toMatchObject({ approve: false, force: false })
    expect(review?.gates.none.blocking.map((e) => e.file)).toEqual(['replies.md'])
    const r = await s.ctx.h.relay.approve(w.key, t.id, { force: true })
    expect(r).toMatchObject({
      ok: false,
      error: expect.stringContaining('오류를 무시하고 승인할 수 없음'),
    })
    expect(posts(s)).toHaveLength(0)
  })

  it('[실패한 체크 다시 실행]이 실패하면 오류를 돌려주고 남기지 않는다 (D203)', async () => {
    const s = await setup({ env: { FAKE_GH_FAIL: 'rerun' } })
    const w = await openWork(s)
    s.gh.runCi(w.pr, workState(w).pr?.head ?? '')
    await refreshUntil(s.ctx, w, (p) => p.rerun !== null, '[실패한 체크 다시 실행]')
    const r = await s.ctx.h.relay.prRerun(w.key)
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('cannot be rerun') })
    expect(workEvents(w).some((e) => e.type === 'pr.checks_rerun')).toBe(false)
    expect(s.gh.reruns()).toEqual([])
  })
})
