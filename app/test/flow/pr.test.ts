// [흐름] PR 진행 (docs/implementation.md M9, 시나리오 10, D152~D200).
// 가짜 gh(8.2)와 로컬 bare 원격으로 [실제]와 같은 공통 시나리오(pr-scenario.ts)를 돌고, 가짜로만 만들 수 있는 경우를
// 더 본다: 재시작(D159), 로컬만 앞섬과 원격과 갈라짐, worktree가 깨끗하지 않음(D193), gh가 실패함, 끊긴 머지(D77, D123),
// [머지 없이 끝내기](D179), 고친 코멘트와 지운 코멘트, 본문이 빈 리뷰와 스레드 답글(S7), 로그를 아직 줄 수 없는
// CI 실패와 취소된 체크, push와 pull_request로 두 번 돈 작업과 실행의 이벤트(D201, I52), 머지 방식(D177),
// gh 버전이 낮으면 [PR 생성]을 끔(D198).
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { jsonText } from '../../src/adapters/store'
import type { WorkState } from '../../src/shared/work'
import { drive } from './driver'
import { CART_FILES, FakeGitHub, FakeWorld } from './github'
import { git, harness, makeRepo, register, settle, writeFiles, type Harness } from './harness'
import {
  HEAD_CODE,
  openPrWork,
  prClaude,
  refreshUntil,
  runPrScenario,
  view,
  workEvents,
  workState,
  type PrContext,
  type PrWork,
} from './pr-scenario'

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

/** ci-fail 없이 파일 끝에 함수를 더하는 Work를 PR 진행까지 */
function openWork(s: Setup, files?: Record<string, string>): Promise<PrWork> {
  const cart = CART_FILES['src/cart.mjs'] ?? ''
  return openPrWork(
    s.ctx,
    prClaude(files ?? { 'src/cart.mjs': cart + HEAD_CODE }, 'relay M9 흐름 시험'),
    'relay M9 흐름 시험',
  )
}

/** CI를 통과시키고 [머지]가 켜질 때까지 */
async function toMergeable(s: Setup, w: PrWork): Promise<void> {
  s.gh.runCi(w.pr, workState(w).pr?.head ?? '')
  await refreshUntil(s.ctx, w, (p) => p.gate.enabled, '[머지] 켜짐')
}

/** 실패한 스텝의 로그 한 줄 (gh run view --log-failed의 모양, S7 관찰 2) */
const CI_LOG_LINE = 'test\tRun npm test\t2026-09-29T00:00:01.0000000Z ##[error]실패\n'

const ghCalls = (s: Setup, type: string) =>
  s.ctx.h.ghRecords().filter((r) => r['type'] === type) as { args: string[] }[]

describe('[흐름] PR 진행 (M9, 시나리오 10)', () => {
  it('공통 시나리오: 읽기, 거르기, 제외와 relay 밖의 수정, 충돌, 머지, 밖에서 닫힘·다시 열림·머지 (8.4의 PR 진행 1~6)', async () => {
    const s = await setup()
    await runPrScenario(s.ctx)
    // 앱이 부른 gh 명령의 모양 (S7, I50): PR 주소의 레포와 --hostname
    const view1 = ghCalls(s, 'pr view')[0]?.args ?? []
    expect(view1.slice(0, 5)).toEqual(['pr', 'view', '1', '--repo', 'github.test/local/cart'])
    expect(
      ghCalls(s, 'api').map((c) => c.args.slice(0, 5).concat(c.args.at(-1) ?? '')),
    ).toContainEqual([
      'api',
      '--hostname',
      'github.test',
      '--paginate',
      '--slurp',
      'repos/local/cart/pulls/1/reviews?per_page=100',
    ])
    const merge = ghCalls(s, 'pr merge')
    expect(merge).toHaveLength(2)
    expect(merge[1]?.args).toEqual([
      'pr',
      'merge',
      '1',
      '--repo',
      'github.test/local/cart',
      '--merge',
      '--match-head-commit',
      expect.stringMatching(/^[0-9a-f]{40}$/),
    ])
    expect(ghCalls(s, 'run view')[0]?.args).toEqual([
      'run',
      'view',
      '--job',
      expect.stringMatching(/^\d+$/),
      '--repo',
      'github.test/local/cart',
      '--log-failed',
    ])
    // 머지는 --delete-branch를 쓰지 않는다 (S7 관찰 6)
    expect(merge.every((c) => !c.args.includes('--delete-branch'))).toBe(true)
  }, 300_000)

  it('앱을 다시 켜면 항목을 바로 보이고 PR을 한 번 읽는다. 꺼진 동안 쌓인 항목은 보이기만 하고 알리지 않는다 (D159)', async () => {
    const s = await setup()
    const w = await openWork(s)
    s.gh.convo(w.pr, '끄기 전 코멘트')
    await refreshUntil(s.ctx, w, (p) => p.items.length === 1, '끄기 전 코멘트')
    await s.ctx.h.relay.close()
    s.gh.convo(w.pr, '꺼진 동안 코멘트')
    s.gh.runCi(w.pr, workState(w).pr?.head ?? '')
    const before = s.ctx.h.ui.notices.length
    await s.ctx.h.reopen()
    // pr-items.json의 항목을 읽어 둔 채 켠다
    expect(s.ctx.h.relay.snapshot().works[0]?.pr?.items.map((i) => i.title)).toEqual([
      'relay-owner: 끄기 전 코멘트',
    ])
    const p = await s.ctx.h.ui.until(
      () => {
        const v = s.ctx.h.ui.works.get(w.key)?.pr
        return v && v.items.length === 2 && !v.reading ? v : null
      },
      '켠 뒤의 첫 읽기',
      10_000,
    )
    expect(p.items.map((i) => i.status)).toEqual(['new', 'new'])
    expect(p.ci).toBe('pass')
    // 켤 때 읽은 것은 알리지 않는다 (D159, D121). 새 FakeUi라 앞의 알림은 없다
    expect(s.ctx.h.ui.notices.filter((n) => n.workKey === w.key)).toEqual([])
    expect(before).toBeGreaterThan(0)
    expect(view(s.ctx, w).badge.kind).toBe('pr_items')
  })

  it('로컬만 앞서면 받지 않고 [머지]를 막는다. 원격과 갈라지면 git을 건드리지 않고 갈라짐 항목을 만들고, 풀면 해소됨이다 (D193, D199)', async () => {
    const s = await setup()
    const w = await openWork(s)
    await toMergeable(s, w)
    // 로컬 Work 브랜치에만 커밋이 있다
    writeFiles(w.tree, { 'local.txt': '로컬만\n' })
    git(w.tree, 'add', '-A')
    git(w.tree, 'commit', '-q', '-m', '로컬 커밋')
    const local = git(w.tree, 'rev-parse', 'HEAD')
    let p = await refreshUntil(s.ctx, w, (x) => x.sync === 'local_ahead', '로컬만 앞섬')
    expect(p.items.filter((i) => i.kind === 'diverged')).toEqual([])
    expect(
      p.gate.reasons.some((r) => r.includes('로컬 Work 브랜치에 push하지 않은 커밋이 있음')),
    ).toBe(true)
    // 원격에도 다른 커밋이 생겼다
    const remote = await s.world.commit(w.branch, { 'remote.txt': '원격만\n' }, '원격 커밋')
    p = await refreshUntil(s.ctx, w, (x) => x.sync === 'diverged', '갈라짐')
    const item = p.items.find((i) => i.kind === 'diverged')
    expect(item).toMatchObject({ id: `diverged:${remote}`, status: 'new' })
    expect(item?.title).toBe(`원격 ${remote.slice(0, 8)}, 로컬 ${local.slice(0, 8)}`)
    expect(git(w.tree, 'rev-parse', 'HEAD')).toBe(local)
    expect(p.gate.enabled).toBe(false)
    expect(view(s.ctx, w).badge.kind).toBe('pr_items')
    // 사람이 relay 밖에서 로컬 커밋을 버리고 원격에 맞춘다
    git(s.repo, 'fetch', '-q', 'origin', w.branch)
    git(w.tree, 'reset', '-q', '--hard', remote)
    p = await refreshUntil(s.ctx, w, (x) => x.sync === 'same', '같음')
    expect(p.items.find((i) => i.id === `diverged:${remote}`)?.status).toBe('resolved')
  })

  it('원격만 앞섰는데 worktree에 커밋 안 된 변경이 있으면 받지 않고 갈라짐 항목이다. 깨끗해지면 받는다 (D193)', async () => {
    const s = await setup()
    const w = await openWork(s)
    const before = git(w.tree, 'rev-parse', 'HEAD')
    writeFiles(w.tree, { 'scratch.txt': '메모\n' })
    const remote = await s.world.commit(w.branch, { 'remote.txt': '원격만\n' }, '원격 커밋')
    let p = await refreshUntil(s.ctx, w, (x) => x.sync === 'dirty', '깨끗하지 않음')
    expect(p.items.find((i) => i.kind === 'diverged')?.id).toBe(`diverged:${remote}`)
    expect(git(w.tree, 'rev-parse', 'HEAD')).toBe(before)
    fs.rmSync(path.join(w.tree, 'scratch.txt'))
    p = await refreshUntil(s.ctx, w, (x) => x.synced.length === 1, '받음')
    expect(git(w.tree, 'rev-parse', 'HEAD')).toBe(remote)
    expect(p.items.find((i) => i.id === `diverged:${remote}`)?.status).toBe('resolved')
    expect(
      workEvents(w)
        .filter((e) => e.type === 'pr.synced')
        .map((e) => e.payload),
    ).toEqual([{ commits: [remote] }])
  })

  it('gh가 실패하면 읽기 오류를 보이고 상태는 그대로다. 다시 읽으면 오류가 사라진다', async () => {
    const s = await setup()
    const w = await openWork(s)
    const before = workState(w)
    s.ctx.h.env['FAKE_GH_FAIL'] = 'api'
    const r = await s.ctx.h.relay.prRefresh(w.key)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(
      /^PR을 읽지 못함: gh api repos\/local\/cart\/(pulls|issues)\/1\/(reviews|comments)/,
    )
    await settle(s.ctx.h, w.key)
    expect(view(s.ctx, w).pr?.error).toMatch(/^PR을 읽지 못함/)
    expect(workState(w).pr).toEqual(before.pr)
    delete s.ctx.h.env['FAKE_GH_FAIL']
    expect(await s.ctx.h.relay.prRefresh(w.key)).toEqual({ ok: true })
    await settle(s.ctx.h, w.key)
    expect(view(s.ctx, w).pr?.error).toBeNull()
  })

  it('머지하다 끊기면 끊긴 작업이다. [다시 시도]는 이미 머지됐으면 머지하지 않고 완료하고, 아니면 머지한다 (D77, D123)', async () => {
    for (const mergedMeanwhile of [true, false]) {
      const s = await setup()
      const w = await openWork(s)
      await toMergeable(s, w)
      const work = workState(w)
      const head = work.pr?.head ?? ''
      const cut: WorkState = {
        ...work,
        operation: { kind: 'merge', started_at: work.pr?.started_at ?? '', method: 'squash', head },
      }
      await s.ctx.h.relay.close()
      fs.writeFileSync(path.join(w.dir, 'work.json'), jsonText(cut))
      if (mergedMeanwhile) s.gh.mergeOutside(w.pr)
      await s.ctx.h.reopen()
      await settle(s.ctx.h, w.key)
      const v = view(s.ctx, w)
      expect(v.operation).toMatchObject({ kind: 'merge', title: '머지가 끊겼습니다' })
      expect(v.badge.kind).toBe('recovery')
      // 끊긴 작업이 있는 동안은 읽지 않는다 (I51, D122)
      expect(await s.ctx.h.relay.prRefresh(w.key)).toMatchObject({ ok: false })
      const merges = ghCalls(s, 'pr merge').length
      expect(await s.ctx.h.relay.retryOperation(w.key)).toEqual({ ok: true })
      await settle(s.ctx.h, w.key)
      const done = workState(w)
      expect(done.status).toBe('completed')
      expect(done.operation).toBeUndefined()
      expect(done.pr?.merged).toMatchObject({ head, method: 'squash', outside: false })
      expect(ghCalls(s, 'pr merge')).toHaveLength(merges + (mergedMeanwhile ? 0 : 1))
      expect(s.gh.pr(w.pr).state).toBe('merged')
      await h?.close()
      h = undefined
    }
  })

  it('끊긴 머지의 [무시]는 기록만 지우고 PR 진행으로 남는다 (D123)', async () => {
    const s = await setup()
    const w = await openWork(s)
    const work = workState(w)
    await s.ctx.h.relay.close()
    fs.writeFileSync(
      path.join(w.dir, 'work.json'),
      jsonText({
        ...work,
        operation: {
          kind: 'merge',
          started_at: work.pr?.started_at ?? '',
          method: 'merge',
          head: work.pr?.head ?? '',
        },
      }),
    )
    await s.ctx.h.reopen()
    await settle(s.ctx.h, w.key)
    expect(await s.ctx.h.relay.ignoreOperation(w.key)).toEqual({ ok: true })
    await settle(s.ctx.h, w.key)
    expect(workState(w)).toMatchObject({ status: 'pr' })
    expect(workState(w).operation).toBeUndefined()
    expect(await s.ctx.h.relay.prRefresh(w.key)).toEqual({ ok: true })
    expect(s.gh.pr(w.pr).state).toBe('open')
  })

  it('[머지 없이 끝내기]는 Work를 완료(머지 없이)로 바꾸고 GitHub의 PR은 건드리지 않는다. 더 읽지 않는다 (D179)', async () => {
    const s = await setup()
    const w = await openWork(s)
    expect(await s.ctx.h.relay.prEnd(w.key)).toEqual({ ok: true })
    await settle(s.ctx.h, w.key)
    const done = workState(w)
    expect(done.status).toBe('completed')
    expect(done.pr?.ended_at).toEqual(expect.any(String))
    expect(done.pr?.merged).toBeUndefined()
    expect(workEvents(w).at(-1)).toMatchObject({
      type: 'work.completed',
      payload: { delivery: 'pr', merged: false },
    })
    expect(s.gh.pr(w.pr).state).toBe('open')
    expect(view(s.ctx, w).pr).toMatchObject({ ended: done.pr?.ended_at, offerClean: false })
    expect(await s.ctx.h.relay.prRefresh(w.key)).toEqual({
      ok: false,
      error: 'PR 진행인 Work가 아님',
    })
    // 머지하지 않았으니 원격 브랜치 삭제는 고를 수 없다 (D178)
    const p = await s.ctx.h.relay.cleanPreview(w.key)
    expect(p.ok && p.preview).toMatchObject({ merged: false, remote: null })
  })

  it('고친 코멘트는 새 항목이 아니고 본문만 바뀐다. 지운 코멘트는 해소됨이다. 본문이 빈 리뷰와 제출하지 않은 리뷰는 항목이 아니다 (S7 관찰 3)', async () => {
    const s = await setup()
    const w = await openWork(s)
    const convo = s.gh.convo(w.pr, '처음 본문')
    const review = s.gh.review(w.pr, { body: '' })
    const thread = s.gh.inline(w.pr, { body: '스레드 시작', path: 'src/cart.mjs', line: 3, review })
    s.gh.inline(w.pr, { body: '스레드 답글', path: 'src/cart.mjs', line: 3, reply_to: thread })
    s.gh.review(w.pr, { body: '아직 제출하지 않음', state: 'PENDING' })
    s.gh.convo(w.pr, '지나가는 사람', 'outsider')
    let p = await refreshUntil(s.ctx, w, (x) => x.items.length === 4, '코멘트 넷')
    // 리뷰, 인라인 코멘트, 대화 코멘트 차례로 모으고 새 항목을 앞에 보인다
    expect(p.items.map((i) => [i.id, i.status])).toEqual([
      [`inline:${thread}`, 'new'],
      [expect.stringMatching(/^inline:/), 'new'],
      [`convo:${convo}`, 'new'],
      [expect.stringMatching(/^convo:/), 'not_accepted'],
    ])
    expect(p.items[1]?.where).toBe(`src/cart.mjs:3 (스레드 inline:${thread}의 답글)`)
    expect(p.items[3]?.why).toBe('작성자 관계 NONE: 소유자·조직 구성원·협업자만 받음 (D160)')
    const received = workEvents(w).filter((e) => e.type === 'pr.items_received')
    s.gh.edit(w.pr, 'convo', convo, '고친 본문')
    p = await refreshUntil(
      s.ctx,
      w,
      (x) => x.items.some((i) => i.title.endsWith('고친 본문')),
      '고친 본문',
    )
    expect(p.items.find((i) => i.title.endsWith('고친 본문'))).toMatchObject({
      id: `convo:${convo}`,
      status: 'new',
    })
    expect(workEvents(w).filter((e) => e.type === 'pr.items_received')).toEqual(received)
    s.gh.remove(w.pr, 'convo', convo)
    p = await refreshUntil(s.ctx, w, (x) => x.items.some((i) => i.gone), '지운 코멘트')
    expect(p.items.find((i) => i.id === `convo:${convo}`)).toMatchObject({
      status: 'resolved',
      gone: true,
    })
    expect(await s.ctx.h.relay.prItem(w.key, `convo:${convo}`, 'exclude')).toEqual({
      ok: false,
      error: 'GitHub에서 없어진 코멘트임',
    })
    // 받지 않은 코멘트를 [받기]하면 새 항목이고, 사람이 정한 것은 규칙으로 되돌리지 않는다
    const outsider = p.items.find((i) => i.status === 'not_accepted')?.id ?? ''
    expect(await s.ctx.h.relay.prItem(w.key, outsider, 'accept')).toEqual({ ok: true })
    p = await refreshUntil(s.ctx, w, (x) => !x.reading, '다시 읽기')
    expect(p.items.find((i) => i.id === outsider)?.status).toBe('new')
    const items = JSON.parse(fs.readFileSync(path.join(w.dir, 'pr-items.json'), 'utf8')) as {
      items: { id: string; by_human?: boolean }[]
    }
    expect(items.items.find((i) => i.id === outsider)?.by_human).toBe(true)
  })

  it('실행이 끝나지 않아 로그를 줄 수 없는 CI 실패는 까닭을 보이고 다음 읽기에서 로그를 채운다. 취소된 체크는 항목이 아니지만 머지를 막는다', async () => {
    const s = await setup()
    const w = await openWork(s)
    const head = workState(w).pr?.head ?? ''
    const failing = s.gh.checkRun(w.pr, { conclusion: 'FAILURE', pending: true })
    s.gh.setChecks(w.pr, head, [failing])
    let p = await refreshUntil(s.ctx, w, (x) => x.ci === 'fail', 'CI 실패')
    expect(p.items[0]).toMatchObject({
      kind: 'ci',
      text: null,
      note: '실행이 아직 끝나지 않아 로그를 읽지 못함. 다음 읽기에서 다시 봄',
    })
    const job = Number(/\/job\/(\d+)$/.exec((failing as { detailsUrl: string }).detailsUrl)?.[1])
    s.gh.logReady(job, 'test\tRun npm test\t2026-09-29T00:00:01.0000000Z ##[error]실패한 까닭\n')
    p = await refreshUntil(s.ctx, w, (x) => x.items[0]?.text !== null, '로그')
    expect(p.items[0]).toMatchObject({ text: '##[error]실패한 까닭', note: null })
    // 같은 head의 로그는 다시 읽지 않는다
    const logs = ghCalls(s, 'run view').length
    await s.ctx.h.relay.prRefresh(w.key)
    expect(ghCalls(s, 'run view')).toHaveLength(logs)
    // 취소된 체크
    s.gh.setChecks(w.pr, head, [s.gh.checkRun(w.pr, { conclusion: 'CANCELLED' })])
    p = await refreshUntil(s.ctx, w, (x) => x.ci === 'cancel', '취소')
    expect(p.items.filter((i) => i.status === 'new')).toEqual([])
    expect(p.gate.reasons).toContain('취소된 체크가 있음: ci / test (pull_request)')
  })

  it('같은 작업이 push와 pull_request로 두 번 돌면 따로 본다. 늦게 시작한 쪽이 통과해도 다른 쪽의 실패는 CI 실패 항목이고 머지를 막는다. 실행의 이벤트는 한 번만 읽는다 (D201)', async () => {
    const s = await setup()
    const w = await openWork(s)
    const head = workState(w).pr?.head ?? ''
    const push = s.gh.checkRun(w.pr, {
      event: 'push',
      conclusion: 'FAILURE',
      log: 'test\tRun npm test\t2026-09-29T00:00:01.0000000Z ##[error]push에서 실패\n',
      startedAt: '2026-09-29T00:00:00Z',
    })
    const pull = s.gh.checkRun(w.pr, {
      event: 'pull_request',
      conclusion: 'SUCCESS',
      startedAt: '2026-09-29T00:00:30Z',
    })
    s.gh.setChecks(w.pr, head, [push, pull])
    const p = await refreshUntil(s.ctx, w, (x) => x.ci === 'fail', 'CI 실패')
    expect(p.checks.map((c) => [c.label, c.bucket])).toEqual([
      ['ci / test (pull_request)', 'pass'],
      ['ci / test (push)', 'fail'],
    ])
    expect(p.items).toEqual([
      expect.objectContaining({
        id: `ci:${head}:ci/test (push)`,
        status: 'new',
        title: `ci / test (push): FAILURE, head ${head.slice(0, 8)}`,
        text: '##[error]push에서 실패',
      }),
    ])
    expect(p.gate.enabled).toBe(false)
    expect(p.gate.reasons).toContain('CI 실패: ci / test (push)')
    // 실행 둘의 이벤트를 한 번씩 읽었고 다시 읽지 않는다
    expect(ghCalls(s, 'api run')).toHaveLength(2)
    await s.ctx.h.relay.prRefresh(w.key)
    await settle(s.ctx.h, w.key)
    expect(ghCalls(s, 'api run')).toHaveLength(2)
  })

  it('실행의 이벤트를 읽지 못하면 경고를 보이고 그 체크는 실행 id로 가린다. 다음 읽기에서 다시 읽는다. 다시 켜면 CI 실패 항목에 적힌 이벤트를 쓴다 (I52)', async () => {
    const s = await setup()
    const w = await openWork(s)
    const head = workState(w).pr?.head ?? ''
    s.gh.setChecks(w.pr, head, [s.gh.checkRun(w.pr, { conclusion: 'SUCCESS' })])
    s.ctx.h.env['FAKE_GH_FAIL'] = 'event'
    expect(await s.ctx.h.relay.prRefresh(w.key)).toEqual({ ok: true })
    await settle(s.ctx.h, w.key)
    let p = view(s.ctx, w).pr
    expect(p?.checks.map((c) => c.label)).toEqual([
      expect.stringMatching(/^ci \/ test \(실행 \d+\)$/),
    ])
    expect(p?.error).toMatch(
      /^실행 \d+의 이벤트를 읽지 못함: gh api repos\/local\/cart\/actions\/runs\/\d+\?exclude_pull_requests=true 실패/,
    )
    delete s.ctx.h.env['FAKE_GH_FAIL']
    expect(await s.ctx.h.relay.prRefresh(w.key)).toEqual({ ok: true })
    await settle(s.ctx.h, w.key)
    p = view(s.ctx, w).pr
    expect(p?.checks.map((c) => c.label)).toEqual(['ci / test (pull_request)'])
    expect(p?.error).toBeNull()
    // 실패한 실행의 이벤트는 CI 실패 항목에 남아, 다시 켠 뒤 읽지 못해도 항목의 id가 그대로다
    s.gh.setChecks(w.pr, head, [s.gh.checkRun(w.pr, { conclusion: 'FAILURE', log: CI_LOG_LINE })])
    const failed = await refreshUntil(s.ctx, w, (x) => x.ci === 'fail', 'CI 실패')
    expect(failed.items.map((i) => i.id)).toEqual([`ci:${head}:ci/test (pull_request)`])
    const calls = ghCalls(s, 'api run').length
    await s.ctx.h.relay.close()
    s.ctx.h.env['FAKE_GH_FAIL'] = 'event'
    await s.ctx.h.reopen()
    const after = await s.ctx.h.ui.until(
      () => {
        const v = s.ctx.h.ui.works.get(w.key)?.pr
        return v && v.checks.length === 1 && !v.reading ? v : null
      },
      '켠 뒤의 첫 읽기',
      10_000,
    )
    expect(after.checks.map((c) => c.label)).toEqual(['ci / test (pull_request)'])
    expect(after.items.map((i) => [i.id, i.status])).toEqual([
      [`ci:${head}:ci/test (pull_request)`, 'new'],
    ])
    expect(after.error).toBeNull()
    expect(ghCalls(s, 'api run')).toHaveLength(calls)
  })

  it('머지 창은 레포가 허용하는 방식만 보이고 기본은 프로젝트 설정이다. GitHub가 막으면 그 오류를 보이고 PR 진행에 남는다 (D176, D177)', async () => {
    const s = await setup()
    const w = await openWork(s)
    await toMergeable(s, w)
    s.gh.setMethods({ merge: false, squash: true, rebase: true })
    let info = await s.ctx.h.relay.prMergeInfo(w.key)
    expect(info.ok && info.info).toMatchObject({
      methods: ['squash', 'rebase'],
      preferred: 'squash',
    })
    expect(
      await s.ctx.h.relay.updateProjectSettings(s.ctx.projectId, {
        allowed_bots: [],
        merge_method: 'rebase',
      }),
    ).toEqual({ ok: true })
    info = await s.ctx.h.relay.prMergeInfo(w.key)
    expect(info.ok && info.info.preferred).toBe('rebase')
    expect(s.ctx.h.ui.projectList[0]).toMatchObject({ mergeMethod: 'rebase', allowedBots: [] })
    // 브랜치 보호로 막힘: gh가 GitHub에 묻기 전에 멈춘다
    s.gh.setMergeable(w.pr, 'MERGEABLE', 'BLOCKED')
    const head = workState(w).pr?.head ?? ''
    const r = await s.ctx.h.relay.prMerge(w.key, { method: 'rebase', head })
    expect(!r.ok && r.error).toContain(
      'is not mergeable: the base branch policy prohibits the merge',
    )
    await settle(s.ctx.h, w.key)
    expect(workState(w)).toMatchObject({ status: 'pr' })
    expect(workState(w).operation).toBeUndefined()
    // 잘못된 설정은 받지 않는다
    expect(
      await s.ctx.h.relay.updateProjectSettings(s.ctx.projectId, {
        allowed_bots: 'github-actions',
        merge_method: 'fast',
      }),
    ).toMatchObject({ ok: false })
  })

  it('머지가 "not mergeable"로 거절돼도 그사이 head가 바뀌었으면 새 커밋 때문이라고 알리고 다시 읽는다 (D176, M9 [실제])', async () => {
    const s = await setup()
    const w = await openWork(s)
    await toMergeable(s, w)
    const head = workState(w).pr?.head ?? ''
    // head가 그대로인 거절은 GitHub의 오류를 그대로 보인다
    s.ctx.h.env['FAKE_GH_FAIL'] = 'merge'
    const same = await s.ctx.h.relay.prMerge(w.key, { method: 'merge', head })
    expect(same).toEqual({
      ok: false,
      error: '머지 실패: 종료 코드 1: GraphQL: Pull Request is not mergeable (mergePullRequest)',
    })
    // 머지 창을 연 뒤 새 커밋이 생겼고, GitHub는 "not mergeable"로 거절한다
    const moved = await s.world.commit(w.branch, { 'late.txt': '늦은 커밋\n' }, '늦은 커밋')
    const r = await s.ctx.h.relay.prMerge(w.key, { method: 'merge', head })
    expect(!r.ok && r.error).toMatch(/^그사이 PR에 새 커밋이 생겨 머지하지 않음/)
    delete s.ctx.h.env['FAKE_GH_FAIL']
    // 곧 다시 읽어 새 head를 받는다
    await s.ctx.h.ui.until(() => view(s.ctx, w).pr?.head === moved, '다시 읽기', 10_000)
    expect(workState(w)).toMatchObject({ status: 'pr' })
    expect(s.gh.pr(w.pr).state).toBe('open')
  })

  it('gh가 2.48.0보다 낮으면 등록 점검이 경고하고 [PR 생성]을 끈다. 올리고 [다시 점검]하면 켜진다 (D198)', async () => {
    h = await harness({ env: { FAKE_GH_VERSION: '2.40.1' } })
    const { repo } = makeRepo(h.root, 'cart', CART_FILES)
    const inspection = await h.relay.inspectProject(repo)
    expect(inspection.checks.find((c) => c.id === 'gh')).toMatchObject({
      ok: false,
      blocking: false,
      label: 'gh auth status가 성공하고 gh가 2.48.0 이상인가',
    })
    const projectId = await register(h, repo)
    const project = JSON.parse(
      fs.readFileSync(path.join(h.home, 'projects', projectId, 'project.json'), 'utf8'),
    ) as { checks: object }
    expect(project.checks).toMatchObject({ gh: true, gh_version: '2.40.1' })
    fs.writeFileSync(
      path.join(h.root, 'scenario.json'),
      JSON.stringify(prClaude({ 'a.txt': 'a\n' }, '낮은 gh')),
    )
    const created = await h.relay.createWork(projectId, {
      request: '낮은 gh',
      baseBranch: 'main',
      baseLocation: 'local',
    })
    if (!created.ok) throw new Error(created.error)
    await drive(h.relay, h.ui, created.workKey, {
      size: 'S',
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    const taskId = h.ui.works.get(created.workKey)?.current ?? ''
    let review = await h.relay.review(created.workKey, taskId)
    expect(review?.completion?.buttons.pr).toEqual({
      enabled: false,
      reason: 'gh 2.48.0 이상이 필요함 (지금 2.40.1)',
    })
    expect(await h.relay.deliver(created.workKey, { choice: 'pr', uncommitted: null })).toEqual({
      ok: false,
      error: '[PR 생성]을 쓸 수 없음: gh 2.48.0 이상이 필요함 (지금 2.40.1)',
    })
    h.env['FAKE_GH_VERSION'] = '2.101.0'
    expect(await h.relay.recheckWork(created.workKey)).toEqual({ ok: true })
    review = await h.relay.review(created.workKey, taskId)
    expect(review?.completion?.buttons.pr).toEqual({ enabled: true, reason: null })
    expect(h.ui.projectList[0]).toMatchObject({ ghVersion: '2.101.0' })
  })
})
