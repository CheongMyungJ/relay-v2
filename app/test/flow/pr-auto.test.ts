// [흐름] 자동 대응 (docs/implementation.md M11, D154, D159, D169, D171, D184, D208~D210).
// 가짜 gh(8.2)와 로컬 bare 원격, 가짜 claude로 돈다.
// 1. 자동 시작 → 자동 승인 → push → 새 항목 → 다음 라운드 → 상한에서 멈추고 알림. 사람이 [대응 시작]을 누르면 다시
//    센다. 자동 승인한 라운드의 답글 게시가 실패하면 알린다(D184).
// 2. 켜기 전에 받은 항목, 자동 시작을 켬(PR 진행 중의 [Work 설정], D209), [받기]·[다시 넣기], 재시작 뒤 쌓인 항목으로는
//    시작하지 않고, 다음 읽기에 들어온 항목과 함께 시작한다(D159, D210). 도는 동안 들어온 항목은 라운드가 끝나면 바로
//    시작한다.
// 3. 닫힌 PR에는 push·게시하지 않는다(D208): 앱이 닫힘을 읽기 전의 사람 승인과 자동 승인 모두.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, type AppConfig } from '../../src/shared/config'
import type { RoundView, TaskView } from '../../src/shared/views'
import { CART_FILES, FakeGitHub, FakeWorld } from './github'
import { git, harness, makeRepo, register, settle, sleep, type Harness } from './harness'
import {
  HEAD_CODE,
  currentUntil,
  openPrWork,
  prItems,
  respondClaude,
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

/** 한 조건을 기다리는 한도. 자동 대응은 읽기, fetch, 가짜 claude, 카운트다운, push와 게시를 지난다 */
const WAIT = 60_000

interface Setup {
  ctx: PrContext
  gh: FakeGitHub
  world: FakeWorld
}

async function setup(config: Partial<AppConfig>): Promise<Setup> {
  h = await harness({ config })
  const { repo, remote } = makeRepo(h.root, 'cart', CART_FILES)
  const projectId = await register(h, repo)
  const scratch = path.join(h.root, 'outside')
  fs.mkdirSync(scratch)
  const gh = new FakeGitHub(path.join(h.root, 'record'), remote, scratch)
  const world = new FakeWorld(gh)
  return { ctx: { h, world, projectId, repo, note: () => undefined, created: [] }, gh, world }
}

/** 대응 자동 시작과 PR 대응 자동 승인을 켠 앱 설정. 상한은 2, 카운트다운은 1초다 */
const AUTO: Partial<AppConfig> = {
  respond_auto_start: true,
  respond_auto_round_max: 2,
  auto_approve: { ...DEFAULT_CONFIG.auto_approve, respond: true },
  auto_approve_countdown_sec: 1,
}

const CART = CART_FILES['src/cart.mjs'] ?? ''

/** 대응 task의 단계: 라운드마다 파일 하나를 커밋하고 코멘트 항목에 답글 초안을 쓴다. wait면 Enter를 기다린 뒤 한다 */
function answer(round: number, wait = false): Step[] {
  return [
    { do: 'prompt' },
    ...(wait ? [{ do: 'waitEnter' } as Step] : []),
    {
      do: 'commit',
      files: { [`notes/round-${round}.md`]: `relay M11 흐름 시험 라운드 ${round}\n` },
      message: `docs: relay M11 라운드 ${round}`,
    },
    { do: 'respond', text: '{id}: relay M11 흐름 시험 답글입니다.' },
    { do: 'write', file: 'handoff.md', text: handoff({ summary: `라운드 ${round}에 대응했다.` }) },
    { do: 'stop' },
  ]
}

/**
 * 대응할 PR 진행 Work: 파일 끝에 함수를 더하고 ci-fail을 둔다. 첫 대응 task(t-05)는 ci-fail을 지워 커밋한다
 * (respondClaude). tasks로 다음 대응 task의 단계를 정한다
 */
function openWork(s: Setup, tasks: Record<string, Step[]>): Promise<PrWork> {
  const claude = respondClaude(
    { 'src/cart.mjs': CART + HEAD_CODE, 'ci-fail': 'relay M11 흐름 시험\n' },
    'relay M11 흐름 시험',
  )
  return openPrWork(
    s.ctx,
    { ...claude, tasks: { ...claude.tasks, ...tasks } },
    'relay M11 흐름 시험',
  )
}

/** [새로 고침]을 한 번 누르고 반영을 기다린다 */
async function refresh(s: Setup, w: PrWork): Promise<void> {
  expect(await s.ctx.h.relay.prRefresh(w.key)).toEqual({ ok: true })
  await settle(s.ctx.h, w.key)
}

/** 대응 라운드 기록이 조건을 만족할 때까지 */
function roundUntil(
  s: Setup,
  w: PrWork,
  taskId: string,
  pred: (r: RoundView) => boolean,
  label: string,
): Promise<RoundView> {
  return s.ctx.h.ui.until(
    () => view(s.ctx, w).pr?.rounds.find((r) => r.taskId === taskId && pred(r)),
    `${taskId}: ${label}`,
    WAIT,
  )
}

/** 대응 라운드가 게시될 때까지 기다리고 처리 줄이 빌 때까지 */
async function published(s: Setup, w: PrWork, taskId: string): Promise<RoundView> {
  const r = await roundUntil(s, w, taskId, (x) => x.state === 'published', '게시함')
  await settle(s.ctx.h, w.key)
  return r
}

/** 이 Work의 알림 본문 */
const notices = (s: Setup, w: PrWork) =>
  s.ctx.h.ui.notices.filter((n) => n.workKey === w.key).map((n) => n.body)

const respondTasks = (w: PrWork) => workState(w).tasks.filter((t) => t.node === 'respond')
const task = (w: PrWork, id: string) => workState(w).tasks.find((t) => t.id === id)
const replies = (s: Setup, w: PrWork) =>
  s.gh.comments(w.pr).filter((c) => c.body.includes('<!-- relay:'))
const newIds = (w: PrWork) =>
  prItems(w)
    .items.filter((i) => i.status === 'new')
    .map((i) => i.id)
const bandOf = (s: Setup, w: PrWork, id: string): string =>
  view(s.ctx, w).tasks.find((t: TaskView) => t.id === id)?.band ?? ''

/** 자동 시작을 기다리게 하는 것이 없을 때, 시작하지 않았는지 본다: 판정은 처리 줄에서 곧바로 끝난다 */
async function notStarted(s: Setup, w: PrWork, count: number): Promise<void> {
  await sleep(300)
  await settle(s.ctx.h, w.key)
  expect(respondTasks(w)).toHaveLength(count)
  expect(notices(s, w).filter((n) => n.includes('자동 대응 시작'))).toHaveLength(
    respondTasks(w).filter((t) => t.reason === 'auto_respond').length,
  )
}

describe('[흐름] 자동 대응 (M11, 가짜 gh)', () => {
  it('자동 시작 → 자동 승인 → push → 새 항목 → 다음 라운드 → 상한에서 멈추고 알림. 사람의 [대응 시작]은 다시 센다. 자동 승인한 라운드의 게시 실패를 알린다 (D154, D169, D171, D184)', async () => {
    const s = await setup(AUTO)
    const { h: app } = s.ctx
    const w = await openWork(s, { 't-06': answer(2), 't-07': answer(3), 't-08': answer(4) })
    const head1 = workState(w).pr?.head ?? ''

    // ---------- 라운드 1: CI 실패로 자동 시작, 자동 승인, push ----------
    s.gh.runCi(w.pr, head1)
    await refresh(s, w)
    const r1 = await published(s, w, 't-05')
    const t5 = task(w, 't-05')
    expect(t5).toMatchObject({ reason: 'auto_respond', approved_by: 'auto', respond: { round: 1 } })
    expect(r1.items.map((i) => i.id)).toEqual([`ci:${head1}:ci/test (pull_request)`])
    expect(bandOf(s, w, 't-05')).toContain('이유: 자동 대응')
    const events = workEvents(w)
    expect(
      events.find((e) => e.type === 'task.started' && e.task_id === 't-05')?.payload,
    ).toMatchObject({ reason: 'auto_respond' })
    expect(events.find((e) => e.type === 'task.approved' && e.task_id === 't-05')?.payload).toEqual(
      {
        by: 'auto',
      },
    )
    expect(workState(w).pr?.auto_rounds).toBe(1)
    const head2 = git(w.tree, 'rev-parse', 'HEAD')
    expect(await s.world.branchTip(w.branch)).toBe(head2)
    expect(r1.pushed?.commits).toEqual([head2])
    // 자동 시작이 켜져 있으면 "대응 거리가 들어옴" 대신 자동 대응 시작을 알린다 (D184)
    expect(notices(s, w)).toContain(`PR #${w.pr}: 자동 대응 시작 — 라운드 1, 새 항목 1개`)
    expect(notices(s, w).some((n) => n.includes('대응 거리'))).toBe(false)
    // context.md의 사람 지시와 승인 방식
    const context = fs.readFileSync(path.join(w.dir, 'tasks', '05-respond', 'context.md'), 'utf8')
    expect(context).toContain('없음: 앱이 받은 새 항목으로 자동으로 시작한 라운드다 (D154)')
    expect(context).toContain('자동 승인 (task를 시작할 때의 설정.')

    // ---------- 라운드 2: CI 통과 뒤 새 코멘트로 다음 라운드 ----------
    s.gh.runCi(w.pr, head2)
    const c2 = s.gh.convo(w.pr, 'relay M11 흐름 시험: 라운드 2 코멘트')
    await refresh(s, w)
    const r2 = await published(s, w, 't-06')
    expect(r2.items.map((i) => i.id)).toEqual([`convo:${c2}`])
    expect(task(w, 't-06')).toMatchObject({ reason: 'auto_respond', approved_by: 'auto' })
    expect(workState(w).pr?.auto_rounds).toBe(2)
    expect(replies(s, w)).toHaveLength(1)
    expect(notices(s, w)).toContain(`PR #${w.pr}: 자동 대응 시작 — 라운드 2, 새 항목 1개`)
    expect(view(s.ctx, w).pr?.auto).toMatchObject({ start: true, approve: true, rounds: 2, max: 2 })

    // ---------- 상한: 다음 코멘트로는 시작하지 않고 멈추고 알린다 (D171) ----------
    const c3 = s.gh.convo(w.pr, 'relay M11 흐름 시험: 상한 뒤 코멘트')
    await refresh(s, w)
    await app.ui.until(() => view(s.ctx, w).badge.kind === 'auto_paused', '자동 대응 멈춤', WAIT)
    await settle(app, w.key)
    expect(respondTasks(w)).toHaveLength(2)
    const paused = workEvents(w).filter((e) => e.type === 'pr.auto_paused')
    expect(paused.map((e) => e.payload)).toEqual([
      { reason: 'round_limit', rounds: 2, max: 2, items: [`convo:${c3}`] },
    ])
    expect(notices(s, w)).toContain(
      `PR #${w.pr}: 자동 대응 멈춤 — 사람 손 없이 이어진 라운드가 상한(2)에 닿음. 새 항목 1개는 [대응 시작]으로 대응하세요 (누르면 다시 셈)`,
    )
    const panel = view(s.ctx, w).pr
    expect(panel?.auto.paused).toBe(true)
    expect(panel?.auto.text).toContain('자동 대응 멈춤')
    expect(panel?.respond).toMatchObject({ enabled: true, items: [`convo:${c3}`] })
    // 새 항목 없이 다시 읽으면 또 멈춤을 남기지도 알리지도 않는다
    await refresh(s, w)
    await notStarted(s, w, 2)
    expect(workEvents(w).filter((e) => e.type === 'pr.auto_paused')).toHaveLength(1)
    expect(notices(s, w).filter((n) => n.includes('자동 대응 멈춤'))).toHaveLength(1)

    // ---------- 사람의 [대응 시작]은 다시 센다 ----------
    expect(await app.relay.prRespond(w.key, { items: [`convo:${c3}`], instruction: '' })).toEqual({
      ok: true,
    })
    await settle(app, w.key)
    expect(workState(w).pr?.auto_rounds).toBe(0)
    await published(s, w, 't-07')
    // 사람이 시작한 라운드도 자동 승인은 설정을 따른다. 자동 승인은 셈을 늘리지 않는다
    expect(task(w, 't-07')).toMatchObject({ reason: 'respond', approved_by: 'auto' })
    expect(bandOf(s, w, 't-07')).toContain('이유: 대응 시작')
    expect(workState(w).pr?.auto_rounds).toBe(0)
    expect(view(s.ctx, w).badge.kind).not.toBe('auto_paused')

    // ---------- 다시 센 뒤의 자동 시작. 자동 승인한 라운드의 게시가 실패하면 알린다 (D184) ----------
    s.gh.postFaults(['error'])
    const c4 = s.gh.convo(w.pr, 'relay M11 흐름 시험: 다시 센 뒤의 코멘트')
    await refresh(s, w)
    const failed = await roundUntil(s, w, 't-08', (r) => r.state === 'failed', '게시 실패')
    await settle(app, w.key)
    expect(failed.items.map((i) => i.id)).toEqual([`convo:${c4}`])
    expect(task(w, 't-08')).toMatchObject({
      reason: 'auto_respond',
      status: 'awaiting_approval',
      respond: { round: 4, failure: { stage: 'reply' } },
    })
    expect(workState(w).pr?.auto_rounds).toBe(1)
    expect(notices(s, w)).toContain(`PR #${w.pr}: 자동 대응 시작 — 라운드 4, 새 항목 1개`)
    expect(
      notices(s, w).filter((n) =>
        n.startsWith(
          `PR #${w.pr}: 08 PR 대응 자동 승인한 대응의 답글 게시 실패 — 승인 화면에서 [다시 시도]를 누르세요 (`,
        ),
      ),
    ).toHaveLength(1)
    // 사람이 [다시 시도](승인)하면 이어서 게시하고 다시 센다
    expect(await app.relay.approve(w.key, 't-08', {})).toEqual({ ok: true })
    await published(s, w, 't-08')
    expect(task(w, 't-08')?.approved_by).toBe('human')
    expect(workState(w).pr?.auto_rounds).toBe(0)
    expect(replies(s, w)).toHaveLength(3)
  })

  it('켜기 전에 받은 항목, 자동 시작을 켬, [받기]·[다시 넣기], 재시작 뒤 쌓인 항목으로는 시작하지 않고 다음에 들어온 항목과 함께 시작한다. 도는 동안 들어온 항목은 라운드가 끝나면 바로 시작한다 (D159, D209, D210)', async () => {
    const s = await setup({ auto_approve_countdown_sec: 1 })
    const w = await openWork(s, { 't-06': answer(2) })
    const head1 = workState(w).pr?.head ?? ''
    const ci = `ci:${head1}:ci/test (pull_request)`

    // 꺼진 동안 받은 항목은 알리기만 한다 (D184)
    s.gh.runCi(w.pr, head1)
    await refresh(s, w)
    expect(newIds(w)).toEqual([ci])
    expect(notices(s, w)).toContain(`PR #${w.pr}: 대응 거리 1개가 들어옴`)
    expect(view(s.ctx, w).pr?.auto).toMatchObject({ start: false, startFromWork: false })

    // PR 진행 중에 [Work 설정]으로 켠다 (D209). 켤 때 쌓인 항목으로는 시작하지 않는다 (D210)
    expect(
      await s.ctx.h.relay.updateWorkSettings(w.key, {
        respond_auto_start: true,
        auto_approve: { respond: false },
      }),
    ).toEqual({ ok: true })
    await notStarted(s, w, 0)
    expect(workState(w).settings).toEqual({
      respond_auto_start: true,
      auto_approve: { respond: false },
    })
    expect(view(s.ctx, w).pr?.auto).toMatchObject({
      start: true,
      startFromWork: true,
      approve: false,
      approveFromWork: true,
    })

    // [제외] 뒤 [다시 넣기], 받지 않은 봇 코멘트의 [받기]로 새 항목이 생겨도 시작하지 않는다
    expect(await s.ctx.h.relay.prItem(w.key, ci, 'exclude')).toEqual({ ok: true })
    expect(await s.ctx.h.relay.prItem(w.key, ci, 'include')).toEqual({ ok: true })
    const bot = s.gh.convo(w.pr, 'relay M11 흐름 시험: 봇 코멘트', 'bot')
    await refresh(s, w)
    expect(prItems(w).items.find((i) => i.id === `convo:${bot}`)?.status).toBe('not_accepted')
    await notStarted(s, w, 0)
    expect(await s.ctx.h.relay.prItem(w.key, `convo:${bot}`, 'accept')).toEqual({ ok: true })
    await notStarted(s, w, 0)
    expect(newIds(w).sort()).toEqual([ci, `convo:${bot}`].sort())

    // 앱이 꺼진 동안 들어온 코멘트: 켤 때 읽어 보이기만 한다 (D159)
    await s.ctx.h.relay.close()
    const c1 = s.gh.convo(w.pr, 'relay M11 흐름 시험: 꺼진 동안의 코멘트')
    await s.ctx.h.reopen()
    await s.ctx.h.ui.until(
      () => view(s.ctx, w).pr?.items.some((i) => i.id === `convo:${c1}`),
      '켤 때의 읽기',
      WAIT,
    )
    await notStarted(s, w, 0)
    expect(notices(s, w)).toEqual([])

    // 다음 읽기에 새 항목이 들어오면 쌓인 것과 함께 시작한다
    const c2 = s.gh.convo(w.pr, 'relay M11 흐름 시험: 켠 뒤의 코멘트')
    await refresh(s, w)
    const t5 = await currentUntil(
      s.ctx,
      w,
      (t) => t.id === 't-05' && t.status === 'awaiting_approval',
      '자동 시작한 대응 task의 승인 대기',
    )
    await settle(s.ctx.h, w.key)
    expect(t5.band).toContain('이유: 자동 대응')
    const items = [ci, `convo:${bot}`, `convo:${c1}`, `convo:${c2}`]
    expect([...(task(w, 't-05')?.respond?.items ?? [])].sort()).toEqual(items.sort())
    expect(notices(s, w)).toContain(`PR #${w.pr}: 자동 대응 시작 — 라운드 1, 새 항목 4개`)
    // 자동 승인은 이 Work에서 꺼 두었다: 카운트다운하지 않는다
    expect(task(w, 't-05')?.countdown).toBeUndefined()

    // 도는 동안 들어온 항목은 기다린다. 다음 라운드로 미룰 때는 알리지 않는다 (D184)
    const c3 = s.gh.convo(w.pr, 'relay M11 흐름 시험: 도는 동안의 코멘트')
    await refresh(s, w)
    expect(newIds(w)).toEqual([`convo:${c3}`])
    const before = notices(s, w).length
    await notStarted(s, w, 1)
    expect(notices(s, w)).toHaveLength(before)

    // 라운드가 끝나면(사람의 승인, push와 게시) 바로 시작한다
    expect(await s.ctx.h.relay.approve(w.key, 't-05', {})).toEqual({ ok: true })
    const t6 = await currentUntil(
      s.ctx,
      w,
      (t) => t.id === 't-06' && t.status === 'awaiting_approval',
      '라운드가 끝난 뒤 자동 시작한 대응 task',
    )
    await settle(s.ctx.h, w.key)
    expect(t6.band).toContain('이유: 자동 대응')
    expect(task(w, 't-05')).toMatchObject({ status: 'approved', approved_by: 'human' })
    expect(task(w, 't-06')?.respond).toMatchObject({ round: 2, items: [`convo:${c3}`] })
    // 사람의 승인이 다시 셌고, 이어서 자동 시작이 하나 셌다
    expect(workState(w).pr?.auto_rounds).toBe(1)
    expect(notices(s, w)).toContain(`PR #${w.pr}: 자동 대응 시작 — 라운드 2, 새 항목 1개`)
  })

  it('닫힌 PR에는 push·게시하지 않는다: 앱이 닫힘을 읽기 전의 사람 승인과 자동 승인 모두 (D179, D208)', async () => {
    const s = await setup({ respond_auto_start: true, auto_approve_countdown_sec: 1 })
    const w = await openWork(s, { 't-06': answer(2, true) })
    const head1 = workState(w).pr?.head ?? ''
    s.gh.runCi(w.pr, head1)
    await refresh(s, w)
    await currentUntil(
      s.ctx,
      w,
      (t) => t.id === 't-05' && t.status === 'awaiting_approval',
      '자동 시작한 대응 task의 승인 대기',
    )
    await settle(s.ctx.h, w.key)

    // 사람 승인: 앱은 아직 열린 PR로 알고 있다
    s.gh.close(w.pr)
    const refused = await s.ctx.h.relay.approve(w.key, 't-05', {})
    expect(refused).toEqual({
      ok: false,
      error: 'PR 대응의 push 실패: PR이 열려 있지 않아(닫힘) push·게시하지 않음 (D179, D208)',
    })
    await settle(s.ctx.h, w.key)
    expect(await s.world.branchTip(w.branch)).toBe(head1)
    expect(task(w, 't-05')).toMatchObject({
      status: 'awaiting_approval',
      respond: { failure: { stage: 'push' } },
    })
    expect(workEvents(w).some((e) => e.type === 'pr.pushed')).toBe(false)

    // 다시 열리면 [다시 시도]로 push한다. 자동 승인을 이 Work에서 켠다 (D209)
    s.gh.reopen(w.pr)
    expect(await s.ctx.h.relay.approve(w.key, 't-05', {})).toEqual({ ok: true })
    await published(s, w, 't-05')
    const head2 = git(w.tree, 'rev-parse', 'HEAD')
    expect(await s.world.branchTip(w.branch)).toBe(head2)
    expect(
      await s.ctx.h.relay.updateWorkSettings(w.key, { auto_approve: { respond: true } }),
    ).toEqual({ ok: true })

    // 자동 승인: 대응 task가 도는 동안 밖에서 닫혔고 앱은 아직 읽지 않았다
    s.gh.runCi(w.pr, head2)
    s.gh.convo(w.pr, 'relay M11 흐름 시험: 닫히기 전의 코멘트')
    await refresh(s, w)
    await s.ctx.h.ui.until(
      () => (s.ctx.h.ui.output.get(`${w.key}/t-06`) ?? '').includes('입력 대기'),
      't-06의 입력 대기',
      WAIT,
    )
    s.gh.close(w.pr)
    s.ctx.h.relay.terminalWrite(`${w.key}/t-06`, '\r')
    await roundUntil(s, w, 't-06', (r) => r.state === 'failed', 'push 실패')
    await settle(s.ctx.h, w.key)
    expect(await s.world.branchTip(w.branch)).toBe(head2)
    expect(replies(s, w)).toHaveLength(0)
    expect(task(w, 't-06')).toMatchObject({
      reason: 'auto_respond',
      status: 'awaiting_approval',
      respond: { failure: { stage: 'push' } },
    })
    expect(notices(s, w)).toContain(
      `PR #${w.pr}: 06 PR 대응 자동 승인한 대응의 push 실패 — 승인 화면에서 [다시 시도]를 누르세요 (PR이 열려 있지 않아(닫힘) push·게시하지 않음 (D179, D208))`,
    )
    // 닫힘을 읽으면 PR 닫힘이고, 대응 task의 승인을 받지 않는다 (D179)
    await refresh(s, w)
    expect(view(s.ctx, w).pr?.state).toBe('CLOSED')
    const closed = await s.ctx.h.relay.approve(w.key, 't-06', {})
    expect(closed.ok).toBe(false)
  })
})
