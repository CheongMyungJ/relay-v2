// [단위] 자동 대응 (docs/implementation.md M11, D154, D159, D169, D171, D183, D184, D208~D211). 새 설정과 Work 설정,
// 자동 시작의 판정(꺼짐, 기다림, 새 항목 없음, 멈춤, 시작)과 재시작 규칙, 대응 거리 알림, 사람 손 없이 이어진 라운드의
// 셈과 상한, PR 대응의 자동 승인 판정(4.3, 닫힌 PR)과 승인 화면 안내, 배지 차례, PR 패널의 자동 대응, context.md와
// 머리 띠를 본다.
import { describe, expect, it } from 'vitest'
import {
  AUTO_HOLD_LABEL,
  BADGE_ORDER,
  approvalMode,
  autoApproveNote,
  badge,
} from '../../src/core/approval'
import {
  applyConfigPatch,
  checkWorkSettings,
  mergeWorkSettings,
  normalizeConfig,
} from '../../src/core/config'
import { buildContext } from '../../src/core/context'
import {
  createWork,
  currentTask,
  transition,
  type Effect,
  type MachineEvent,
  type Transition,
} from '../../src/core/machine'
import { prBadgeKind } from '../../src/core/pr'
import {
  AUTO_LIMIT,
  autoPausedNotice,
  autoPlan,
  autoRespondView,
  autoRounds,
  autoStartNotice,
  autoStartOn,
  receivedNeedsNotice,
  wantsAutoStart,
} from '../../src/core/respond'
import { bandText } from '../../src/core/review'
import type { TaskCheck } from '../../src/core/validate'
import { DEFAULT_CONFIG, type AppConfig } from '../../src/shared/config'
import type { Handoff } from '../../src/shared/contracts'
import type { PrItem } from '../../src/shared/pr'
import type { TaskRecord, WorkState } from '../../src/shared/work'

// ---------- 도움 ----------

let clock = 0
const at = () => `2026-09-29T12:${String(clock++ % 60).padStart(2, '0')}:00+09:00`

const HANDOFF: Handoff = {
  status: 'awaiting_approval',
  blocked_reason: null,
  decisions: [{ what: 'CI 실패를 고침', why: '음수를 더하지 않아야 함', by: 'ai' }],
  assumptions: [],
  rejected: [],
  open_questions: [],
  intent_deviation: null,
  risks: [],
  recommended_next: null,
}

function valid(o: Partial<Handoff> = {}): TaskCheck {
  const handoff = { ...HANDOFF, ...o }
  return {
    handoff_present: true,
    formatVersion: 2,
    status: 'awaiting_approval',
    errors: [],
    warnings: [],
    handoff,
    handoffHeader: handoff,
  }
}

/** 자동 대응을 모두 켠 앱 설정: 대응 자동 시작, PR 대응 자동 승인(카운트다운 5초), 상한 2 */
const ON: AppConfig = {
  ...DEFAULT_CONFIG,
  respond_auto_start: true,
  respond_auto_round_max: 2,
  auto_approve: { ...DEFAULT_CONFIG.auto_approve, respond: true },
  auto_approve_countdown_sec: 5,
}

const apply = (work: WorkState, e: MachineEvent, config: AppConfig = ON) =>
  transition(work, e, config)

function launch(work: WorkState): WorkState {
  const task = currentTask(work)
  if (!task) throw new Error('task 없음')
  return apply(work, {
    type: 'session.started',
    taskId: task.id,
    at: at(),
    sessionId: `session-${task.id}`,
    pid: 3000 + task.seq,
    startCommit: `start-${task.id}`,
    skillHash: 'hash',
    claudeVersion: '2.1.284 (Claude Code)',
  }).work
}

function stop(work: WorkState, check: TaskCheck = valid(), config: AppConfig = ON): Transition {
  return apply(
    work,
    {
      type: 'Stop',
      taskId: currentTask(work)?.id ?? '',
      at: at(),
      stopHookActive: false,
      handoffChanged: true,
      check,
    },
    config,
  )
}

function approve(work: WorkState, check: TaskCheck = valid()): Transition {
  return apply(work, { type: 'approve', taskId: currentTask(work)?.id ?? '', at: at(), check })
}

const PR_URL = 'https://github.com/o/r/pull/7'
const HEAD = 'head0001'

/** intake → fix → verify를 지나 [PR 생성]까지 가 PR 진행이 된 Work (M9). 파이프라인의 단계는 자동 승인을 끈 설정으로 지난다 */
function inPr(settings: WorkState['settings'] = {}): WorkState {
  let work = createWork({
    type: 'bugfix',
    workId: 'w-20260929-011',
    baseBranch: 'main',
    baseCommit: 'base0001',
    at: at(),
  }).work
  for (const check of [valid(), valid()]) {
    work = approve(stop(launch(work), check, DEFAULT_CONFIG).work, check).work
  }
  work = stop(launch(work), valid(), DEFAULT_CONFIG).work
  work = apply(work, {
    type: 'deliver',
    at: at(),
    choice: 'pr',
    uncommitted: null,
    check: valid(),
  }).work
  work = apply(work, {
    type: 'delivery.succeeded',
    at: at(),
    compareUrl: null,
    prUrl: PR_URL,
    draft: false,
    pr: { number: 7, head: HEAD, ghVersion: '2.101.0' },
    check: valid(),
  }).work
  return { ...work, settings }
}

/** 대응 시작. auto면 앱의 자동 시작이다 */
function respond(
  work: WorkState,
  auto: boolean,
  items: string[] = ['ci:head0001:ci/test (pull_request)'],
  instruction = '',
  config: AppConfig = ON,
): Transition {
  return apply(
    work,
    { type: 'pr.respond', at: at(), items, instruction, ...(auto ? { auto: true } : {}) },
    config,
  )
}

const task = (work: WorkState) => currentTask(work) as TaskRecord
const types = (effects: Effect[]) =>
  effects.map((e) => (e.type === 'log' ? `log:${e.event.type}` : e.type))

/** 카운트다운이 끝나 자동 승인을 넣는다 */
function fire(work: WorkState, check: TaskCheck | null = valid(), config: AppConfig = ON) {
  return apply(
    work,
    {
      type: 'autoApprove',
      taskId: task(work).id,
      at: at(),
      startedAt: task(work).countdown?.started_at ?? '',
      check,
    },
    config,
  )
}

/** push와 답글 게시가 끝났다 */
function published(work: WorkState): Transition {
  const pushed = apply(work, {
    type: 'respond.pushed',
    at: at(),
    head: 'head0002',
    commits: ['head0002'],
  }).work
  return apply(pushed, { type: 'respond.published', at: at(), check: valid(), replies: [] })
}

/** 한 라운드를 자동으로 돈다: 자동 시작 → 턴 끝(카운트다운) → 자동 승인 → push와 게시 */
function autoRound(work: WorkState, items?: string[]): WorkState {
  const started = respond(work, true, items)
  if (started.rejected) throw new Error(started.rejected)
  const waiting = stop(launch(started.work)).work
  if (!task(waiting).countdown) throw new Error('카운트다운 중이 아님')
  return published(fire(waiting).work).work
}

function item(id: string, o: Partial<PrItem> = {}): PrItem {
  const kind = id.split(':')[0] as PrItem['kind']
  return { id, kind, status: 'new', first_seen_at: 'T0', ...o }
}

/** PR 기록을 바꾼 Work */
function withPr(work: WorkState, patch: Partial<NonNullable<WorkState['pr']>>): WorkState {
  if (!work.pr) throw new Error('PR 없음')
  return { ...work, pr: { ...work.pr, ...patch } }
}

function prRead(work: WorkState, state: 'OPEN' | 'CLOSED'): Transition {
  return apply(work, {
    type: 'pr.read',
    at: at(),
    number: 7,
    state,
    head: HEAD,
    received: [],
    notAccepted: [],
  })
}

// ---------- 설정 ----------

describe('자동 대응의 설정 (5.1.1, D72, D154, D169, D171)', () => {
  it('기본은 대응 자동 시작 끔, 라운드 상한 3, PR 대응 자동 승인 끔이다', () => {
    expect(DEFAULT_CONFIG.respond_auto_start).toBe(false)
    expect(DEFAULT_CONFIG.respond_auto_round_max).toBe(3)
    expect(DEFAULT_CONFIG.auto_approve.respond).toBe(false)
    const { config, warnings } = normalizeConfig({
      respond_auto_start: true,
      respond_auto_round_max: 5,
      auto_approve: { respond: true },
    })
    expect(warnings).toEqual([])
    expect(config).toMatchObject({
      respond_auto_start: true,
      respond_auto_round_max: 5,
      auto_approve: { ...DEFAULT_CONFIG.auto_approve, respond: true },
    })
  })

  it('config.json의 틀린 값은 기본값을 쓰고 경고한다. 라운드 상한은 1~20이다 (기본값)', () => {
    const { config, warnings } = normalizeConfig({
      respond_auto_start: 'yes',
      respond_auto_round_max: 0,
    })
    expect(config.respond_auto_start).toBe(false)
    expect(config.respond_auto_round_max).toBe(3)
    expect(warnings).toEqual([
      'config.json 자동 대응 라운드 상한: 1~20의 정수여야 함 (지금: 0). 기본값 3을 씀',
      'config.json respond_auto_start: true/false여야 함. 기본값을 씀',
    ])
    expect(normalizeConfig({ respond_auto_round_max: 21 }).warnings).toHaveLength(1)
    expect(normalizeConfig({ respond_auto_round_max: 20 }).config.respond_auto_round_max).toBe(20)
  })

  it('설정 화면에서 바꾼다. 값이 틀리면 아무것도 바꾸지 않는다 (D70)', () => {
    expect(
      applyConfigPatch(DEFAULT_CONFIG, {
        respond_auto_start: true,
        respond_auto_round_max: 1,
        auto_approve: { respond: true },
      }),
    ).toEqual({
      ok: true,
      value: {
        ...DEFAULT_CONFIG,
        respond_auto_start: true,
        respond_auto_round_max: 1,
        auto_approve: { ...DEFAULT_CONFIG.auto_approve, respond: true },
      },
    })
    expect(applyConfigPatch(DEFAULT_CONFIG, { respond_auto_start: 'on' })).toEqual({
      ok: false,
      error: '대응 자동 시작: true/false여야 함',
    })
    expect(applyConfigPatch(DEFAULT_CONFIG, { respond_auto_round_max: 0 }).ok).toBe(false)
    expect(applyConfigPatch(DEFAULT_CONFIG, { respond_auto_round_max: 2.5 }).ok).toBe(false)
  })

  it('Work 설정은 대응 자동 시작과 PR 대응 자동 승인을 덮어쓴다. null이나 빈 객체면 앱 설정을 따른다 (D72, D209)', () => {
    expect(checkWorkSettings({ respond_auto_start: true })).toEqual({
      ok: true,
      value: { respond_auto_start: true },
    })
    expect(checkWorkSettings({ respond_auto_start: null })).toEqual({
      ok: true,
      value: { respond_auto_start: null },
    })
    expect(checkWorkSettings({ auto_approve: { respond: false } })).toEqual({
      ok: true,
      value: { auto_approve: { respond: false } },
    })
    expect(checkWorkSettings({ respond_auto_start: 'on' })).toEqual({
      ok: false,
      error: '대응 자동 시작: true/false나 null이어야 함',
    })
    expect(checkWorkSettings({ respond_auto_round_max: 5 }).ok).toBe(false)

    const on = mergeWorkSettings({ auto_approve: { fix: true } }, { respond_auto_start: false })
    expect(on).toEqual({ auto_approve: { fix: true }, respond_auto_start: false })
    // 준 키만 바꾼다
    expect(mergeWorkSettings(on, { auto_approve: { respond: true } })).toEqual({
      auto_approve: { respond: true },
      respond_auto_start: false,
    })
    expect(mergeWorkSettings(on, {})).toEqual(on)
    expect(mergeWorkSettings(on, { respond_auto_start: null })).toEqual({
      auto_approve: { fix: true },
    })
  })

  it('켜져 있는지는 Work 설정, 앱 설정 차례로 본다', () => {
    expect(autoStartOn(DEFAULT_CONFIG, {})).toBe(false)
    expect(autoStartOn(DEFAULT_CONFIG, { respond_auto_start: true })).toBe(true)
    expect(autoStartOn(ON, { respond_auto_start: false })).toBe(false)
    expect(autoStartOn(ON, {})).toBe(true)
    // PR 대응의 자동 승인은 다른 단계와 같은 승인 방식이다 (D169). PR 패널도 이것으로 보인다
    expect(approvalMode(DEFAULT_CONFIG, {}, 'respond')).toBe('manual')
    expect(approvalMode(DEFAULT_CONFIG, { auto_approve: { respond: true } }, 'respond')).toBe(
      'auto',
    )
    expect(approvalMode(ON, { auto_approve: { respond: false } }, 'respond')).toBe('manual')
    expect(approvalMode(ON, { auto_approve: { fix: false } }, 'respond')).toBe('auto')
  })

  it('PR 진행 중에도 [Work 설정]을 받는다. 끝난 Work는 받지 않는다 (D209)', () => {
    const r = apply(inPr(), {
      type: 'settings.update',
      at: at(),
      settings: { respond_auto_start: true, auto_approve: { respond: true } },
    })
    expect(r.rejected).toBeUndefined()
    expect(r.work.settings).toEqual({
      respond_auto_start: true,
      auto_approve: { respond: true },
    })
    const done = { ...inPr(), status: 'completed' as const }
    expect(
      apply(done, { type: 'settings.update', at: at(), settings: { respond_auto_start: true } })
        .rejected,
    ).toBe('끝난 Work의 설정은 바꾸지 않음')
  })
})

// ---------- 자동 시작의 판정 ----------

describe('자동 시작의 판정 (D154, D159, D170, D171, D210)', () => {
  const NEW = [item('ci:head0001:ci/test (pull_request)'), item('convo:12')]

  it('앱이 PR을 읽어 받은 새 항목이 있고 그때 켜져 있을 때만 바란다. 앱을 켤 때 읽은 것은 아니다 (D159, D210)', () => {
    expect(wantsAutoStart({ quiet: false, received: 2, on: true })).toBe(true)
    // 앱을 켤 때의 읽기: 쌓인 항목만으로는 시작하지 않는다
    expect(wantsAutoStart({ quiet: true, received: 2, on: true })).toBe(false)
    // 받은 새 항목이 없다: 자동 시작을 켤 때와 [받기]·[다시 넣기]는 읽기가 아니라 여기로 오지 않는다
    expect(wantsAutoStart({ quiet: false, received: 0, on: true })).toBe(false)
    expect(wantsAutoStart({ quiet: false, received: 2, on: false })).toBe(false)
  })

  it('꺼짐, PR 진행이 아니거나 새 항목 없음, 기다림, 멈춤, 시작을 가른다', () => {
    const work = inPr()
    expect(autoPlan(work, NEW, DEFAULT_CONFIG)).toEqual({ kind: 'off' })
    expect(autoPlan({ ...work, settings: { respond_auto_start: false } }, NEW, ON)).toEqual({
      kind: 'off',
    })
    expect(autoPlan(work, NEW, ON)).toEqual({
      kind: 'start',
      items: ['ci:head0001:ci/test (pull_request)', 'convo:12'],
      round: 1,
    })
    // Work 설정으로만 켠 것도 시작한다
    expect(
      autoPlan({ ...work, settings: { respond_auto_start: true } }, NEW, DEFAULT_CONFIG).kind,
    ).toBe('start')
    // 제외, 받지 않음, 대응 중, 처리됨, 사라진 항목은 넣지 않는다 (D170)
    const others = [
      item('convo:1', { status: 'excluded' }),
      item('convo:2', { status: 'not_accepted' }),
      item('convo:3', { status: 'responding' }),
      item('convo:4', { status: 'done' }),
      item('convo:5', { gone: true }),
    ]
    expect(autoPlan(work, others, ON)).toEqual({ kind: 'none' })
    expect(autoPlan({ ...work, status: 'active' }, NEW, ON)).toEqual({ kind: 'none' })
    // 끝나지 않은 대응 task, 닫힌 PR, 진행 중 작업은 풀릴 때까지 기다린다 (D170, D179)
    const running = respond(work, false).work
    expect(autoPlan(running, NEW, ON)).toMatchObject({ kind: 'wait' })
    const closed = prRead(work, 'CLOSED').work
    expect(autoPlan(closed, NEW, ON)).toMatchObject({ kind: 'wait' })
    const cut = {
      ...work,
      operation: {
        kind: 'merge' as const,
        started_at: 'T',
        method: 'merge' as const,
        head: HEAD,
        interrupted_at: 'T',
      },
    }
    expect(autoPlan(cut, NEW, ON)).toMatchObject({ kind: 'wait' })
    // 사람 손 없이 이어진 라운드가 상한에 닿았다 (D171)
    const full = withPr(work, { auto_rounds: 2 })
    expect(autoPlan(full, NEW, ON)).toEqual({
      kind: 'paused',
      items: ['ci:head0001:ci/test (pull_request)', 'convo:12'],
      rounds: 2,
      max: 2,
    })
    // 새 항목이 없으면 상한이어도 멈춤이 아니다
    expect(autoPlan(full, others, ON)).toEqual({ kind: 'none' })
  })

  it('받은 새 항목은 자동 대응이 맡지 못하고 사람이 손대야 풀릴 때만 "대응 거리가 들어옴"으로 알린다 (D184, D211)', () => {
    const work = inPr()
    // 꺼져 있으면 알린다
    expect(receivedNeedsNotice(work, NEW, DEFAULT_CONFIG)).toBe(true)
    // 시작하거나 상한에서 멈추면 그것을 알린다
    expect(receivedNeedsNotice(work, NEW, ON)).toBe(false)
    expect(receivedNeedsNotice(withPr(work, { auto_rounds: 2 }), NEW, ON)).toBe(false)
    // 도는 라운드(대기열, 실행 중, 카운트다운, 사람의 승인 대기)는 끝나면 이어서 시작한다
    const started = respond(work, true).work
    const queued: WorkState = {
      ...started,
      tasks: started.tasks.map((t) => (t.node === 'respond' ? { ...t, status: 'queued' } : t)),
    }
    expect(receivedNeedsNotice(queued, NEW, ON)).toBe(false)
    const running = launch(started)
    expect(task(running).status).toBe('working')
    expect(receivedNeedsNotice(running, NEW, ON)).toBe(false)
    const counting = stop(running).work
    expect(task(counting).countdown).toBeDefined()
    expect(receivedNeedsNotice(counting, NEW, ON)).toBe(false)
    const manual = { ...ON, auto_approve: { ...ON.auto_approve, respond: false } }
    const waiting = stop(running, valid(), manual).work
    expect(task(waiting)).toMatchObject({ status: 'awaiting_approval' })
    expect(task(waiting).countdown).toBeUndefined()
    expect(receivedNeedsNotice(waiting, NEW, ON)).toBe(false)
    // 중단된 대응 task와 닫힌 PR은 사람이 손대야 풀린다: 알리지 않으면 새 항목이 조용히 쌓인다
    const quit = apply(running, {
      type: 'interrupt',
      taskId: task(running).id,
      at: at(),
      reason: 'app_quit',
    }).work
    expect(task(quit).status).toBe('interrupted')
    expect(autoPlan(quit, NEW, ON)).toMatchObject({ kind: 'wait' })
    expect(receivedNeedsNotice(quit, NEW, ON)).toBe(true)
    expect(receivedNeedsNotice(prRead(work, 'CLOSED').work, NEW, ON)).toBe(true)
  })

  it('알림 문구 (D184)', () => {
    expect(autoStartNotice(7, 2, 3)).toBe('PR #7: 자동 대응 시작 — 라운드 2, 새 항목 3개')
    expect(autoPausedNotice(7, 3, 1)).toBe(
      'PR #7: 자동 대응 멈춤 — 사람 손 없이 이어진 라운드가 상한(3)에 닿음. 새 항목 1개는 [대응 시작]으로 대응하세요 (누르면 다시 셈)',
    )
  })
})

// ---------- 라운드의 셈 ----------

describe('사람 손 없이 이어진 라운드의 셈과 상한 (D171, D191)', () => {
  it('자동 시작은 이유가 자동 대응인 대응 task를 시작하고 라운드를 하나 센다', () => {
    const r = respond(inPr(), true)
    expect(r.rejected).toBeUndefined()
    expect(task(r.work)).toMatchObject({
      node: 'respond',
      reason: 'auto_respond',
      respond: { round: 1, items: ['ci:head0001:ci/test (pull_request)'], instruction: null },
    })
    expect(r.effects).toEqual([
      { type: 'startTask', taskId: task(r.work).id, node: 'respond', reason: 'auto_respond' },
    ])
    expect(autoRounds(r.work)).toBe(1)
    expect(r.work.pr?.auto_rounds).toBe(1)
  })

  it('자동 승인은 셈을 두고, 상한에 닿으면 다음 자동 시작을 받지 않는다. 그래서 이어지는 라운드는 상한까지다', () => {
    const one = autoRound(inPr())
    expect(autoRounds(one)).toBe(1)
    const two = autoRound(one, ['convo:20'])
    expect(autoRounds(two)).toBe(2)
    expect(two.tasks.filter((t) => t.node === 'respond').map((t) => t.approved_by)).toEqual([
      'auto',
      'auto',
    ])
    const third = respond(two, true, ['convo:21'])
    expect(third.rejected).toBe(AUTO_LIMIT)
    expect(third.work).toBe(two)
    expect(autoPlan(two, [item('convo:21')], ON)).toMatchObject({ kind: 'paused', rounds: 2 })
    // 상한을 올리면 다시 시작한다
    const raised = { ...ON, respond_auto_round_max: 3 }
    expect(respond(two, true, ['convo:21'], '', raised).rejected).toBeUndefined()
  })

  it('사람이 [대응 시작]이나 대응 task의 승인을 누르면 다시 센다', () => {
    const two = autoRound(autoRound(inPr()), ['convo:20'])
    expect(autoRounds(two)).toBe(2)
    // 사람의 [대응 시작]
    const human = respond(two, false, ['convo:21'])
    expect(task(human.work).reason).toBe('respond')
    expect(autoRounds(human.work)).toBe(0)
    // 자동으로 시작했어도 사람이 승인하면(카운트다운 중 [승인]) 다시 센다
    const auto = respond(two, true, ['convo:21'], '', { ...ON, respond_auto_round_max: 3 }).work
    expect(autoRounds(auto)).toBe(3)
    const waiting = stop(launch(auto)).work
    expect(task(waiting).countdown).toBeDefined()
    const approved = approve(waiting)
    expect(approved.rejected).toBeUndefined()
    expect(autoRounds(approved.work)).toBe(0)
    expect(approved.work.operation).toMatchObject({ kind: 'respond', stage: 'push' })
    expect(approved.work.operation).not.toHaveProperty('by')
    const done = published(approved.work)
    expect(task(done.work).approved_by).toBe('human')
    expect(done.effects[0]).toMatchObject({ event: { payload: { by: 'human' } } })
  })

  it('자동 시작이 꺼져 있으면 자동 시작을 받지 않는다. 사람의 [대응 시작]은 받는다', () => {
    const off = { ...ON, respond_auto_start: false }
    expect(respond(inPr(), true, undefined, '', off).rejected).toBe('대응 자동 시작이 꺼져 있음')
    expect(respond(inPr(), false, undefined, '', off).rejected).toBeUndefined()
  })

  it('셈이 없는 M11 전의 Work는 사람의 [대응 시작]으로 셈을 적지 않는다', () => {
    const r = respond(inPr(), false)
    expect(r.work.pr).not.toHaveProperty('auto_rounds')
  })

  it('상한에 닿아 시작하지 않으면 pr.auto_paused를 남긴다. 멈춤은 따로 적지 않는다 (5.5)', () => {
    const two = autoRound(autoRound(inPr()), ['convo:20'])
    const r = apply(two, { type: 'pr.autoPaused', at: at(), items: ['convo:21'] })
    expect(r.work).toBe(two)
    expect(r.effects).toEqual([
      expect.objectContaining({
        type: 'log',
        event: expect.objectContaining({
          type: 'pr.auto_paused',
          payload: { reason: 'round_limit', rounds: 2, max: 2, items: ['convo:21'] },
        }),
      }),
    ])
    const active = createWork({
      type: 'bugfix',
      workId: 'w-20260929-012',
      baseBranch: 'main',
      baseCommit: 'b',
      at: at(),
    }).work
    expect(apply(active, { type: 'pr.autoPaused', at: at(), items: [] }).effects).toEqual([])
  })
})

// ---------- PR 대응의 자동 승인 ----------

describe('PR 대응의 자동 승인 (4.3, D128~D131, D169, D179)', () => {
  it('켜져 있으면 턴이 끝날 때 카운트다운하고, 끝나면 자동 승인해 push와 답글 게시를 맡긴다', () => {
    const running = launch(respond(inPr(), true).work)
    const stopped = stop(running)
    expect(task(stopped.work)).toMatchObject({
      status: 'awaiting_approval',
      countdown: { seconds: 5 },
    })
    expect(types(stopped.effects)).toEqual(['log:task.awaiting_approval', 'startCountdown'])
    const r = fire(stopped.work)
    expect(r.rejected).toBeUndefined()
    expect(types(r.effects)).toEqual(['stopCountdown', 'endSession', 'respond'])
    expect(r.work.operation).toEqual({
      kind: 'respond',
      stage: 'push',
      started_at: expect.any(String),
      task_id: task(stopped.work).id,
      rounds: [task(stopped.work).id],
      from: HEAD,
      by: 'auto',
    })
    // 승인은 push와 게시가 끝난 뒤 자동으로 남는다 (5.4, 5.5)
    expect(task(r.work)).toMatchObject({ status: 'awaiting_approval', session: { alive: false } })
    expect(task(r.work).countdown).toBeUndefined()
    const done = published(r.work)
    expect(task(done.work)).toMatchObject({ status: 'approved', approved_by: 'auto' })
    expect(types(done.effects)).toEqual(['log:task.approved', 'appendDecisions'])
    expect(done.effects[0]).toMatchObject({ event: { payload: { by: 'auto' } } })
    expect(done.effects[1]).toMatchObject({ by: 'auto', decisions: HANDOFF.decisions })
  })

  it('꺼져 있으면 카운트다운하지 않는다. Work 설정이 앱 설정을 덮어쓴다', () => {
    const manual = { ...ON, auto_approve: { ...ON.auto_approve, respond: false } }
    const off = stop(launch(respond(inPr(), true).work), valid(), manual)
    expect(task(off.work).countdown ?? task(off.work).auto_hold).toBeUndefined()
    const byWork = inPr({ auto_approve: { respond: true } })
    const on = stop(launch(respond(byWork, true).work), valid(), manual)
    expect(task(on.work).countdown).toBeDefined()
  })

  it('4.3의 조건을 어기면 카운트다운하지 않고 까닭을 적는다', () => {
    const r = stop(launch(respond(inPr(), true).work), valid({ open_questions: ['어느 쪽?'] }))
    expect(task(r.work).countdown).toBeUndefined()
    expect(task(r.work).auto_hold?.reasons).toEqual(['open_questions'])
  })

  it('PR이 닫혀 있으면 카운트다운하지 않고, 카운트다운 중에 닫힘을 읽으면 멈춘다 (D179)', () => {
    const running = launch(respond(inPr(), true).work)
    const closedFirst = stop(prRead(running, 'CLOSED').work)
    expect(task(closedFirst.work).countdown).toBeUndefined()
    expect(task(closedFirst.work).auto_hold?.reasons).toEqual(['pr_closed'])
    const counting = stop(running).work
    const read = prRead(counting, 'CLOSED')
    expect(task(read.work).countdown).toBeUndefined()
    expect(task(read.work).auto_hold?.reasons).toEqual(['pr_closed'])
    expect(types(read.effects)).toEqual(['stopCountdown', 'log:pr.closed'])
    // 늦게 온 타이머는 받지 않는다
    const late = apply(read.work, {
      type: 'autoApprove',
      taskId: task(counting).id,
      at: at(),
      startedAt: task(counting).countdown?.started_at ?? '',
      check: valid(),
    })
    expect(late.work.operation).toBeUndefined()
    // 까닭은 알림에 쓴다
    expect(AUTO_HOLD_LABEL.pr_closed).toBe('PR이 닫혀 있음 (닫힌 PR은 승인을 받지 않음, D179)')
    expect(autoApproveNote(read.work, task(read.work), ON)).toEqual({
      on: true,
      hold: '자동 승인하지 않음: PR이 닫혀 있음 (닫힌 PR은 승인을 받지 않음, D179). 다음 턴이 끝날 때 다시 판정합니다.',
    })
  })

  it('카운트다운이 끝날 때 PR이 닫혀 있으면 자동 승인하지 않는다', () => {
    const counting = stop(launch(respond(inPr(), true).work)).work
    const closed = withPr(counting, { closed_at: at() })
    const r = fire(closed)
    expect(r.work.operation).toBeUndefined()
    expect(task(r.work).auto_hold?.reasons).toEqual(['pr_closed'])
  })

  it('카운트다운 중에 [Work 설정]으로 자동 승인을 끄면 바로 멈춘다 (D128, D209)', () => {
    const counting = stop(launch(respond(inPr(), true).work)).work
    const r = apply(counting, {
      type: 'settings.update',
      at: at(),
      settings: { auto_approve: { respond: false } },
    })
    expect(task(r.work).countdown).toBeUndefined()
    expect(task(r.work).auto_hold?.reasons).toEqual(['settings'])
    expect(types(r.effects)).toContain('stopCountdown')
  })

  it('재시작 경로는 자동 승인하지 않는다 (D75, D127)', () => {
    const counting = stop(launch(respond(inPr(), true).work)).work
    const r = apply(counting, { type: 'app.restarted', at: at(), check: valid() })
    expect(task(r.work).countdown).toBeUndefined()
    expect(task(r.work).auto_hold?.reasons).toEqual(['restart'])
  })

  it('승인한 뒤 push나 게시가 실패해 승인 대기로 남으면 자동 승인 안내를 보이지 않는다: 판정할 턴이 없고, 실패와 [다시 시도]는 강조 영역이 보인다', () => {
    const counting = stop(launch(respond(inPr(), true).work)).work
    const failed = apply(fire(counting).work, {
      type: 'respond.failed',
      at: at(),
      error: 'HTTP 502',
    }).work
    expect(task(failed)).toMatchObject({
      status: 'awaiting_approval',
      respond: { failure: { stage: 'push', error: 'HTTP 502' } },
    })
    expect(task(failed).countdown).toBeUndefined()
    expect(task(failed).auto_hold).toBeUndefined()
    expect(autoApproveNote(failed, task(failed), ON)).toEqual({ on: true, hold: null })
    // 실패가 없고 까닭도 없는 승인 대기는 자동 승인을 켜기 전에 끝난 턴이다 (D128)
    const before = stop(launch(respond(inPr(), false).work), valid(), {
      ...ON,
      auto_approve: { ...ON.auto_approve, respond: false },
    }).work
    expect(task(before).auto_hold).toBeUndefined()
    expect(autoApproveNote(before, task(before), ON).hold).toBe(
      '자동 승인은 턴이 끝날 때 판정합니다. 이 결과는 사람이 승인합니다. 다음 턴이 끝날 때 다시 판정합니다.',
    )
  })
})

// ---------- 배지와 패널 ----------

describe('배지 "자동 대응 멈춤"과 PR 패널 (D171, D183)', () => {
  const on = { enabled: true, reasons: [] }

  it('멈춤은 멈춤 다음, 대응 거리 있음 앞이다', () => {
    const i = BADGE_ORDER.indexOf('auto_paused')
    expect(BADGE_ORDER[i - 1]).toBe('stopped')
    expect(BADGE_ORDER[i + 1]).toBe('pr_items')
    expect(prBadgeKind([item('convo:1')], true, on, true)).toBe('auto_paused')
    expect(prBadgeKind([item('convo:1')], true, on)).toBe('pr_items')
    const two = autoRound(autoRound(inPr()), ['convo:20'])
    expect(badge(two, 'auto_paused')).toMatchObject({
      kind: 'auto_paused',
      label: '자동 대응 멈춤',
    })
  })

  it('패널은 설정과 어디서 정했는지, 이어진 라운드와 상한, 멈춤을 보인다', () => {
    // PR 패널(core/pr prView)처럼 자동 승인은 승인 방식으로 정해 넘긴다
    const panel = (w: WorkState, items: PrItem[], config: AppConfig) =>
      autoRespondView(w, items, config, approvalMode(config, w.settings, 'respond') === 'auto')
    const work = inPr()
    expect(panel(work, [], DEFAULT_CONFIG)).toEqual({
      start: false,
      startFromWork: false,
      approve: false,
      approveFromWork: false,
      rounds: 0,
      max: 3,
      paused: false,
      text: '대응 자동 시작 꺼짐(앱 설정): 새 항목은 [대응 시작]으로 대응합니다 · 자동 승인 꺼짐(앱 설정)',
    })
    const byWork = { ...work, settings: { respond_auto_start: true } }
    expect(panel(byWork, [], DEFAULT_CONFIG).text).toBe(
      '대응 자동 시작 켜짐(이 Work) · 자동 승인 꺼짐(앱 설정) · 사람 손 없이 이어진 라운드 0/3',
    )
    const two = autoRound(autoRound(inPr()), ['convo:20'])
    const paused = panel(two, [item('convo:21')], ON)
    expect(paused).toMatchObject({ start: true, approve: true, rounds: 2, max: 2, paused: true })
    expect(paused.text).toContain('자동 대응 멈춤')
    // 새 항목이 없으면 멈춤이 아니다
    expect(panel(two, [], ON).paused).toBe(false)
  })
})

// ---------- context.md와 머리 띠 ----------

describe('자동 대응 task의 context.md와 머리 띠 (시나리오 2-4, 2-5)', () => {
  it('머리 띠의 이유는 "자동 대응"이다', () => {
    const work = respond(inPr(), true).work
    expect(bandText(task(work))).toBe('04 PR 대응 · 새 세션 · 이유: 자동 대응')
  })

  it('사람 지시가 없는 까닭과 설정을 따른 승인 방식을 적는다 (D154, D169)', () => {
    const work = respond(inPr(), true).work
    const text = buildContext({
      work,
      task: task(work),
      config: ON,
      taskDir: '/w/tasks/05-respond',
      request: { path: '/w/request.md', text: '요청' },
      intent: '# intent',
      decisionLog: '',
      rejected: [],
      previousHandoff: null,
      artifacts: [],
      respond: {
        round: 1,
        auto: true,
        instruction: null,
        pr: { number: 7, url: PR_URL, head: HEAD },
        branch: 'relay/w-20260929-011',
        remote: { base: 'base0001', branch: HEAD },
        items: [item('convo:12', { body: '고쳐 주세요', url: `${PR_URL}#c12` })],
        previous: [],
      },
    })
    expect(text).toContain('없음: 앱이 받은 새 항목으로 자동으로 시작한 라운드다 (D154)')
    expect(text).toContain(
      '자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다. 승인하면 앱이 push하고 답글을 게시한다)',
    )
  })
})
