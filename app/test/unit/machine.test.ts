import { describe, expect, it } from 'vitest'
import {
  actions,
  createWork,
  currentTask,
  permissionWarning,
  taskDirName,
  taskId,
  transition,
  type Effect,
  type MachineEvent,
  type Transition,
} from '../../src/core/machine'
import { badge } from '../../src/core/approval'
import { OPERATION_BLOCKS } from '../../src/core/recovery'
import type { TaskCheck } from '../../src/core/validate'
import { DEFAULT_CONFIG, type AppConfig } from '../../src/shared/config'
import type { Handoff, NodeName, Size, TaskNode } from '../../src/shared/contracts'
import type {
  AutoHoldReason,
  FormatIssue,
  TaskRecord,
  TaskStatus,
  WorkState,
} from '../../src/shared/work'

// ---------- 도움 ----------

let clock = 0
const at = () => `2026-09-26T10:${String(clock++ % 60).padStart(2, '0')}:00+09:00`

const HANDOFF: Handoff = {
  status: 'awaiting_approval',
  blocked_reason: null,
  decisions: [{ what: '원인은 타임존 불일치', why: 'UTC/KST 9시간 차이', by: 'ai' }],
  assumptions: [],
  rejected: [],
  open_questions: [],
  intent_deviation: null,
  risks: [],
  recommended_next: null,
}

/** 유효한 awaiting_approval handoff의 검사 결과 */
function valid(handoff: Partial<Handoff> = {}, draftSize?: Size): TaskCheck {
  return {
    handoff_present: true,
    status: 'awaiting_approval',
    errors: [],
    warnings: [],
    handoff: { ...HANDOFF, ...handoff },
    handoffHeader: { ...HANDOFF, ...handoff },
    intentDraft: draftSize ? { type: 'bugfix', size: draftSize } : null,
    reviewFindings: null,
  }
}

const BLOCKED: TaskCheck = {
  ...valid({ status: 'blocked', blocked_reason: '운영 로그가 없음' }),
  status: 'blocked',
}

const MISSING: TaskCheck = {
  handoff_present: false,
  status: null,
  errors: [],
  warnings: [],
  handoff: null,
  handoffHeader: null,
  intentDraft: null,
  reviewFindings: null,
}

const ERROR: FormatIssue = {
  file: 'handoff.md',
  part: 'header',
  field: 'blocked_reason',
  message: '`blocked_reason` 없음: `status: blocked`일 때 필수',
}

const INVALID: TaskCheck = { ...MISSING, handoff_present: true, status: 'blocked', errors: [ERROR] }

function newWork(): WorkState {
  return createWork({
    workId: 'w-20260926-001',
    baseBranch: 'main',
    baseCommit: 'base0001',
    at: at(),
  }).work
}

/**
 * 시험의 기본 설정: 자동 승인을 모두 끈다. 사람이 승인하는 길을 기본으로 보고, 자동 승인은 켠 시험에서 본다.
 * 앱의 기본값(수정과 지적 없는 리뷰는 켬, D213, D214)은 DEFAULT_CONFIG로 따로 본다
 */
const MANUAL: AppConfig = {
  ...DEFAULT_CONFIG,
  auto_approve: {
    investigate: false,
    evidence: false,
    rca: false,
    fix: false,
    review: false,
    respond: false,
  },
}

function apply(work: WorkState, event: MachineEvent, config: AppConfig = MANUAL) {
  return transition(work, event, config)
}

function launch(work: WorkState): WorkState {
  const task = currentTask(work)
  if (!task) throw new Error('task 없음')
  return apply(work, {
    type: 'session.started',
    taskId: task.id,
    at: at(),
    sessionId: `session-${task.id}`,
    pid: 1000 + task.seq,
    startCommit: `start-${task.id}`,
    skillHash: 'skillhash',
    claudeVersion: '2.1.283 (Claude Code)',
  }).work
}

/** 세션이 살아 있고 표시가 status인 t-01 */
function running(status: TaskStatus = 'working'): WorkState {
  const work = launch(newWork())
  return { ...work, tasks: work.tasks.map((t) => ({ ...t, status })) }
}

function stop(
  work: WorkState,
  check: TaskCheck,
  opts: { active?: boolean; changed?: boolean } = {},
  config?: AppConfig,
): Transition {
  const task = currentTask(work)
  return apply(
    work,
    {
      type: 'Stop',
      taskId: task?.id ?? '',
      at: at(),
      stopHookActive: opts.active ?? false,
      handoffChanged: opts.changed ?? true,
      check,
    },
    config,
  )
}

function approve(work: WorkState, check: TaskCheck, size?: Size): Transition {
  const task = currentTask(work)
  return apply(work, {
    type: 'approve',
    taskId: task?.id ?? '',
    at: at(),
    check,
    ...(size ? { size } : {}),
  })
}

const status = (work: WorkState) => currentTask(work)?.status
const types = (effects: Effect[]) =>
  effects.map((e) => (e.type === 'log' ? `log:${e.event.type}` : e.type))

// ---------- 시험 ----------

describe('Work 만들기와 task 시작 (시나리오 1, 2)', () => {
  it('Work를 만들면 intake task를 시작한다', () => {
    const r = createWork({
      workId: 'w-20260926-001',
      baseBranch: 'main',
      baseCommit: 'base0001',
      at: '2026-09-26T10:00:00+09:00',
    })
    expect(r.work).toMatchObject({
      schema_version: 1,
      work_id: 'w-20260926-001',
      status: 'active',
      base_branch: 'main',
      base_commit: 'base0001',
      intent: null,
      settings: {},
    })
    expect(r.work.tasks).toEqual([
      {
        id: 't-01',
        seq: 1,
        node: 'intake',
        status: 'working',
        reason: 'default',
        format_version: 1,
        created_at: '2026-09-26T10:00:00+09:00',
        session: null,
        bounce_count: 0,
        check: null,
      },
    ])
    expect(r.effects).toEqual([
      {
        type: 'log',
        event: {
          ts: '2026-09-26T10:00:00+09:00',
          work_id: 'w-20260926-001',
          type: 'work.created',
          payload: { base_branch: 'main', base_commit: 'base0001' },
        },
      },
      { type: 'startTask', taskId: 't-01', node: 'intake', reason: 'default' },
    ])
  })

  it('task id와 디렉터리 이름 (5.1)', () => {
    expect(taskId(1)).toBe('t-01')
    expect(taskId(12)).toBe('t-12')
    expect(taskDirName({ seq: 3, node: 'rca' })).toBe('03-rca')
  })

  it('세션을 띄우면 세션, 시작 커밋, 스킬 해시, claude 버전을 기록한다 (D76, D103, D105)', () => {
    const work = newWork()
    const r = apply(work, {
      type: 'session.started',
      taskId: 't-01',
      at: '2026-09-26T10:01:00+09:00',
      sessionId: 'uuid-1',
      pid: 4321,
      processStartedAt: '2026-09-26T10:00:59.1234567+09:00',
      startCommit: 'base0001',
      skillHash: 'sha256:abc',
      claudeVersion: '2.1.283 (Claude Code)',
    })
    expect(r.rejected).toBeUndefined()
    expect(currentTask(r.work)).toMatchObject({
      status: 'working',
      start_commit: 'base0001',
      skill_hash: 'sha256:abc',
      claude_version: '2.1.283 (Claude Code)',
      session: {
        id: 'uuid-1',
        pid: 4321,
        process_started_at: '2026-09-26T10:00:59.1234567+09:00',
        started_at: '2026-09-26T10:01:00+09:00',
        alive: true,
      },
    })
    expect(r.effects).toEqual([
      {
        type: 'log',
        event: {
          ts: '2026-09-26T10:01:00+09:00',
          work_id: 'w-20260926-001',
          task_id: 't-01',
          type: 'task.started',
          payload: { reason: 'default', session_id: 'uuid-1' },
        },
      },
    ])
  })

  it('띄우지 못하면 중단됨으로 남긴다', () => {
    const r = apply(newWork(), {
      type: 'session.failed',
      taskId: 't-01',
      at: at(),
      error: 'spawn 실패',
    })
    expect(currentTask(r.work)).toMatchObject({ status: 'interrupted', error: 'spawn 실패' })
    expect(types(r.effects)).toEqual(['log:task.interrupted'])
  })

  it('이미 띄운 task를 다시 시작한다는 알림은 받지 않는다', () => {
    const work = launch(newWork())
    const again = apply(work, {
      type: 'session.started',
      taskId: 't-01',
      at: at(),
      sessionId: 'other',
      pid: 1,
      startCommit: 'x',
      skillHash: 'x',
      claudeVersion: 'x',
    })
    expect(again.rejected).toBeDefined()
    expect(again.work).toBe(work)
  })
})

describe('시나리오 3의 신호 표: 신호마다 표시 상태', () => {
  const T = 't-01'
  const rows: [string, TaskStatus, MachineEvent, TaskStatus][] = [
    ['UserPromptSubmit', 'idle', { type: 'UserPromptSubmit', taskId: T, at: 'x' }, 'working'],
    [
      'PreToolUse(AskUserQuestion)',
      'working',
      { type: 'PreToolUse', taskId: T, at: 'x', toolName: 'AskUserQuestion' },
      'asking',
    ],
    [
      'PostToolUse(AskUserQuestion)',
      'asking',
      { type: 'PostToolUse', taskId: T, at: 'x', toolName: 'AskUserQuestion' },
      'working',
    ],
    [
      'Stop + 유효한 handoff 없음',
      'working',
      {
        type: 'Stop',
        taskId: T,
        at: 'x',
        stopHookActive: false,
        handoffChanged: false,
        check: MISSING,
      },
      'idle',
    ],
    [
      'Stop + 유효한 handoff 있음(awaiting_approval)',
      'working',
      {
        type: 'Stop',
        taskId: T,
        at: 'x',
        stopHookActive: false,
        handoffChanged: true,
        check: valid(),
      },
      'awaiting_approval',
    ],
    [
      'Stop + 유효한 handoff 있음(blocked)',
      'working',
      {
        type: 'Stop',
        taskId: T,
        at: 'x',
        stopHookActive: false,
        handoffChanged: true,
        check: BLOCKED,
      },
      'blocked',
    ],
    [
      'Notification(permission_prompt)',
      'working',
      { type: 'Notification', taskId: T, at: 'x', notificationType: 'permission_prompt' },
      'input_needed',
    ],
    [
      'SessionEnd(reason이 clear, resume이 아님)',
      'working',
      { type: 'SessionEnd', taskId: T, at: 'x', reason: 'prompt_input_exit' },
      'session_ended',
    ],
    ['PTY 종료', 'idle', { type: 'pty.exit', taskId: T, at: 'x' }, 'session_ended'],
  ]

  it.each(rows)('%s: %s → %s', (_name, before, event, after) => {
    const r = apply(running(before), event)
    expect(r.rejected).toBeUndefined()
    expect(status(r.work)).toBe(after)
  })

  it('UserPromptSubmit은 작업 중으로 바꾸고 새 요청의 때를 남긴다', () => {
    const r = apply(running('awaiting_approval'), {
      type: 'UserPromptSubmit',
      taskId: 't-01',
      at: '2026-09-26T11:00:00+09:00',
    })
    expect(currentTask(r.work)).toMatchObject({
      status: 'working',
      last_prompt_at: '2026-09-26T11:00:00+09:00',
    })
  })

  it('첫 UserPromptSubmit의 permission_mode를 기록하고, bypassPermissions가 아니면 경고한다 (D94)', () => {
    const prompt = (work: WorkState, mode: string) =>
      apply(work, { type: 'UserPromptSubmit', taskId: 't-01', at: at(), permissionMode: mode }).work

    const warned = (work: WorkState) => {
      const task = currentTask(work)
      return task ? permissionWarning(task) : undefined
    }

    const bypass = prompt(running(), 'bypassPermissions')
    expect(currentTask(bypass)?.permission_mode).toBe('bypassPermissions')
    expect(warned(bypass)).toBe(false)

    const auto = prompt(running(), 'auto')
    expect(warned(auto)).toBe(true)
    // 사람이 뒤에 모드를 바꿔도 첫 신호의 값을 둔다
    expect(currentTask(prompt(auto, 'bypassPermissions'))?.permission_mode).toBe('auto')
  })

  it('AskUserQuestion이 아닌 도구와 permission_prompt가 아닌 알림은 표시를 바꾸지 않는다', () => {
    const work = running('working')
    expect(
      apply(work, { type: 'PreToolUse', taskId: 't-01', at: at(), toolName: 'Bash' }).work,
    ).toBe(work)
    expect(
      apply(work, {
        type: 'Notification',
        taskId: 't-01',
        at: at(),
        notificationType: 'idle_prompt',
      }).work,
    ).toBe(work)
  })

  it('Stop으로 승인 대기가 되면 task.awaiting_approval을 기록하고 검사 결과를 둔다', () => {
    const r = stop(running(), valid())
    expect(types(r.effects)).toEqual(['log:task.awaiting_approval'])
    expect(currentTask(r.work)?.check).toEqual({
      handoff_present: true,
      status: 'awaiting_approval',
      errors: [],
      warnings: [],
    })
  })

  it('승인 대기와 막힘은 세션이 끝나도 남는다 (3.3)', () => {
    for (const s of ['awaiting_approval', 'blocked'] as const) {
      const r = apply(running(s), { type: 'SessionEnd', taskId: 't-01', at: at() })
      expect(status(r.work)).toBe(s)
      expect(currentTask(r.work)?.session?.alive).toBe(false)
      expect(r.effects).toEqual([])
    }
  })

  it('handoff 없이 세션이 끝나면 세션 종료를 기록하고, 뒤따른 PTY 종료는 무시한다', () => {
    const ended = apply(running('idle'), { type: 'SessionEnd', taskId: 't-01', at: at() })
    expect(types(ended.effects)).toEqual(['log:task.interrupted'])
    const exit = apply(ended.work, { type: 'pty.exit', taskId: 't-01', at: at() })
    expect(exit.work).toBe(ended.work)
    expect(exit.effects).toEqual([])
    expect(exit.rejected).toBeUndefined()
  })

  it('Stop 없이 세션이 끝나도 그때의 파일에 유효한 handoff가 있으면 승인 대기나 막힘이다 (3.3, D146)', () => {
    for (const end of [
      { type: 'SessionEnd' as const, taskId: 't-01', at: at(), reason: 'other', check: valid() },
      { type: 'pty.exit' as const, taskId: 't-01', at: at(), check: valid() },
    ]) {
      const r = apply(running('working'), end)
      expect(currentTask(r.work), end.type).toMatchObject({
        status: 'awaiting_approval',
        session: { alive: false },
        check: { handoff_present: true, status: 'awaiting_approval', errors: [] },
      })
      expect(r.effects, end.type).toEqual([
        {
          type: 'log',
          event: expect.objectContaining({
            type: 'task.awaiting_approval',
            payload: { reason: 'session_ended' },
          }) as unknown,
        },
      ])
    }
    const blocked = apply(running('idle'), {
      type: 'pty.exit',
      taskId: 't-01',
      at: at(),
      check: BLOCKED,
    })
    expect(status(blocked.work)).toBe('blocked')
    expect(blocked.effects).toEqual([])
    // 형식 오류가 있으면 세션 종료다
    const invalid = apply(running('idle'), {
      type: 'SessionEnd',
      taskId: 't-01',
      at: at(),
      check: INVALID,
    })
    expect(status(invalid.work)).toBe('session_ended')
    expect(types(invalid.effects)).toEqual(['log:task.interrupted'])
  })

  it('SessionEnd의 reason이 clear나 resume이면 CLI가 계속 돌므로 세션 종료가 아니다 (D110)', () => {
    for (const reason of ['clear', 'resume']) {
      const work = running('idle')
      const r = apply(work, { type: 'SessionEnd', taskId: 't-01', at: at(), reason })
      expect(r.work).toBe(work)
      expect(r.effects).toEqual([])
      expect(r.rejected).toBeUndefined()
      // 새 세션의 신호를 그대로 받는다
      expect(status(stop(r.work, valid()).work)).toBe('awaiting_approval')
    }
  })

  it('/clear 뒤에는 턴의 훅이 가져온 새 session_id를 따른다. [재개]는 그 세션을 연다 (D110)', () => {
    let work = running('idle')
    expect(currentTask(work)?.session?.id).toBe('session-t-01')
    const hookAt = { taskId: 't-01', at: at(), sessionId: 'session-new' }
    // 앞 세션의 SessionEnd(clear)와 새 세션의 알림으로는 옮기지 않는다: 아직 대화가 없다 (S6)
    work = apply(work, {
      ...hookAt,
      type: 'SessionEnd',
      reason: 'clear',
      sessionId: 'session-t-01',
    }).work
    const idle = { ...hookAt, type: 'Notification' as const, notificationType: 'idle_prompt' }
    expect(apply(work, idle).work).toBe(work)
    // 턴 안의 훅은 옮긴다. 도구 훅처럼 표시를 바꾸지 않는 신호도 세션 id는 남긴다
    const turns: MachineEvent[] = [
      { ...hookAt, type: 'UserPromptSubmit' },
      { ...hookAt, type: 'PreToolUse', toolName: 'Bash' },
      { ...hookAt, type: 'PostToolUse', toolName: 'Bash' },
      { ...hookAt, type: 'Stop', stopHookActive: false, handoffChanged: false, check: MISSING },
    ]
    for (const e of turns) {
      const task = currentTask(apply(work, e).work)
      expect(task?.session).toMatchObject({ id: 'session-new', alive: true, pid: 1001 })
    }
    // 서브에이전트 안의 훅으로는 옮기지 않는다
    const inAgent = { ...hookAt, type: 'PreToolUse' as const, toolName: 'Bash', agentId: 'a-1' }
    expect(apply(work, inAgent).work).toBe(work)
    const same = { ...hookAt, type: 'PreToolUse' as const, toolName: 'Bash' }
    const followed = apply(work, same).work
    expect(apply(followed, same).work).toBe(followed)

    // [즉시 중단] 뒤 [재개]: 다시 연 세션은 새 id다
    const interrupted = apply(followed, {
      type: 'interrupt',
      taskId: 't-01',
      at: at(),
      reason: 'human',
    }).work
    expect(currentTask(interrupted)?.session).toMatchObject({ id: 'session-new', alive: false })
    expect(apply(interrupted, { type: 'resume', taskId: 't-01', at: at() }).effects).toEqual([
      { type: 'resumeTask', taskId: 't-01' },
    ])
    const r = apply(interrupted, {
      type: 'session.resumed',
      taskId: 't-01',
      at: at(),
      pid: 2001,
      claudeVersion: '2.1.283 (Claude Code)',
      check: MISSING,
    })
    const logged = r.effects.find((e) => e.type === 'log')
    expect(logged?.type === 'log' ? logged.event.payload : null).toMatchObject({
      session_id: 'session-new',
    })
  })

  it('그 밖의 reason이나 reason이 없는 SessionEnd는 세션 종료다 (D110)', () => {
    for (const reason of ['logout', 'prompt_input_exit', 'other', 'new_reason', undefined]) {
      const r = apply(running('working'), {
        type: 'SessionEnd',
        taskId: 't-01',
        at: at(),
        ...(reason === undefined ? {} : { reason }),
      })
      expect(status(r.work)).toBe('session_ended')
      expect(currentTask(r.work)?.session?.alive).toBe(false)
    }
  })

  it('끝난 세션의 늦은 신호는 조용히 무시한다', () => {
    const ended = apply(running('idle'), { type: 'pty.exit', taskId: 't-01', at: at() }).work
    const r = apply(ended, { type: 'UserPromptSubmit', taskId: 't-01', at: at() })
    expect(r.work).toBe(ended)
    expect(r.rejected).toBeUndefined()
  })

  it('감시로 다시 한 검사는 패널 표시만 바꾼다 (I15)', () => {
    const check = { ...INVALID }
    const r = apply(running('working'), { type: 'check.updated', taskId: 't-01', at: at(), check })
    expect(currentTask(r.work)).toMatchObject({ status: 'working', check: { errors: [ERROR] } })
  })
})

describe('형식 오류 되돌림 (D21, D107)', () => {
  it('형식 오류가 있고 이번 턴에 handoff가 바뀌었으면 Stop 훅으로 되돌린다', () => {
    const r = stop(running(), INVALID)
    expect(r.effects).toEqual([
      {
        type: 'blockStop',
        taskId: 't-01',
        reason: expect.stringContaining(
          '- handoff.md: `blocked_reason` 없음: `status: blocked`일 때 필수',
        ),
      },
    ])
    expect(currentTask(r.work)).toMatchObject({ status: 'working', bounce_count: 1 })
  })

  it('연속 2회까지 되돌리고 세 번째 Stop은 대기로 둔다', () => {
    const first = stop(running(), INVALID, { active: false })
    const second = stop(first.work, INVALID, { active: true })
    const third = stop(second.work, INVALID, { active: true })
    expect(types(first.effects)).toEqual(['blockStop'])
    expect(types(second.effects)).toEqual(['blockStop'])
    expect(third.effects).toEqual([])
    expect(currentTask(third.work)).toMatchObject({
      status: 'idle',
      bounce_count: 2,
      check: { errors: [ERROR] },
    })
  })

  it('되돌림 횟수는 설정을 따른다 (D70)', () => {
    const none = { ...DEFAULT_CONFIG, format_error_bounce_max: 0 }
    expect(stop(running(), INVALID, {}, none).effects).toEqual([])
    const three = { ...DEFAULT_CONFIG, format_error_bounce_max: 3 }
    let work = running()
    const bounced: number[] = []
    for (let i = 0; i < 4; i++) {
      const r = stop(work, INVALID, { active: i > 0 }, three)
      bounced.push(r.effects.length)
      work = r.work
    }
    expect(bounced).toEqual([1, 1, 1, 0])
  })

  it('사람이 새 요청으로 시작한 턴의 Stop(stop_hook_active: false)에서 0으로 돌아간다', () => {
    let work = running()
    work = stop(work, INVALID, { active: false }).work
    work = stop(work, INVALID, { active: true }).work
    work = stop(work, INVALID, { active: true }).work
    expect(currentTask(work)).toMatchObject({ status: 'idle', bounce_count: 2 })
    work = apply(work, { type: 'UserPromptSubmit', taskId: 't-01', at: at() }).work
    const r = stop(work, INVALID, { active: false })
    expect(types(r.effects)).toEqual(['blockStop'])
    expect(currentTask(r.work)?.bounce_count).toBe(1)
  })

  it('검사를 통과하면 0으로 돌아간다', () => {
    let work = stop(running(), INVALID).work
    work = stop(work, valid(), { active: true }).work
    expect(currentTask(work)).toMatchObject({ status: 'awaiting_approval', bounce_count: 0 })
  })

  it('이번 턴에 handoff가 바뀌지 않았으면 되돌리지 않는다', () => {
    const r = stop(running(), INVALID, { changed: false })
    expect(r.effects).toEqual([])
    expect(currentTask(r.work)).toMatchObject({ status: 'idle', bounce_count: 0 })
  })

  it('handoff가 없으면 되돌리지 않는다', () => {
    const draftOnly: TaskCheck = { ...MISSING, errors: [{ ...ERROR, file: 'intent.draft.md' }] }
    expect(stop(running(), draftOnly).effects).toEqual([])
  })
})

describe('승인과 다음 task (시나리오 4, 5)', () => {
  /** 지금 task를 띄우고 Stop으로 승인 대기로 만든 뒤 승인한다 */
  function stepApprove(work: WorkState, check: TaskCheck, size?: Size): Transition {
    const ready = stop(launch(work), check).work
    return approve(ready, check, size)
  }

  it('L 경로: intake → evidence → rca → fix → review → verify → Work 완료', () => {
    let work = newWork()
    const nodes: TaskNode[] = []
    const all: Effect[] = []
    let r = stepApprove(work, valid({}, 'L'))
    for (;;) {
      nodes.push(...r.work.tasks.slice(nodes.length).map((t) => t.node))
      all.push(...r.effects)
      work = r.work
      if (work.status !== 'active') break
      r = stepApprove(work, valid())
    }
    expect(work.tasks.map((t) => [t.id, t.node, t.status])).toEqual([
      ['t-01', 'intake', 'approved'],
      ['t-02', 'evidence', 'approved'],
      ['t-03', 'rca', 'approved'],
      ['t-04', 'fix', 'approved'],
      ['t-05', 'review', 'approved'],
      ['t-06', 'verify', 'approved'],
    ])
    expect(work.status).toBe('completed')
    expect(work.completed_at).toBeDefined()
    expect(work.intent).toEqual({ version: 1, size: 'L' })
    expect(
      all.filter((e) => e.type === 'startTask').map((e) => e.type === 'startTask' && e.node),
    ).toEqual(['evidence', 'rca', 'fix', 'review', 'verify'])
    expect(types(all).at(-1)).toBe('log:work.completed')
  })

  it('M 경로: intake → investigate → fix → review → verify → Work 완료 (D147, D166)', () => {
    let r = stepApprove(newWork(), valid({}, 'M'))
    expect(r.work.intent).toEqual({ version: 1, size: 'M' })
    expect(r.effects.at(-1)).toEqual({
      type: 'startTask',
      taskId: 't-02',
      node: 'investigate',
      reason: 'default',
    })
    for (const next of ['fix', 'review', 'verify']) {
      r = stepApprove(r.work, valid())
      expect(currentTask(r.work)?.node).toBe(next)
    }
    r = stepApprove(r.work, valid())
    expect(r.work.status).toBe('completed')
    expect(r.work.tasks.map((t) => t.node)).toEqual([
      'intake',
      'investigate',
      'fix',
      'review',
      'verify',
    ])
  })

  it('S 경로: intake → fix → review → verify → Work 완료 (3.4, D163)', () => {
    let r = stepApprove(newWork(), valid({}, 'S'))
    expect(r.work.intent).toEqual({ version: 1, size: 'S' })
    expect(currentTask(r.work)?.node).toBe('fix')
    r = stepApprove(r.work, valid())
    expect(currentTask(r.work)?.node).toBe('review')
    r = stepApprove(r.work, valid())
    expect(currentTask(r.work)?.node).toBe('verify')
    r = stepApprove(r.work, valid())
    expect(r.work.status).toBe('completed')
    expect(r.work.tasks.map((t) => t.node)).toEqual(['intake', 'fix', 'review', 'verify'])
  })

  it('review는 자동 승인이 켜져 있어도 지적이 있으면 카운트다운하지 않고 까닭을 적은 뒤 사람의 승인을 기다린다 (D213)', () => {
    let work = stepApprove(newWork(), valid({}, 'S')).work
    work = stepApprove(work, valid()).work
    expect(currentTask(work)?.node).toBe('review')
    for (const reviewFindings of [true, null]) {
      const r = stop(launch(work), { ...valid(), reviewFindings }, {}, DEFAULT_CONFIG)
      expect(currentTask(r.work)).toMatchObject({ node: 'review', status: 'awaiting_approval' })
      expect(currentTask(r.work)?.countdown).toBeUndefined()
      expect(currentTask(r.work)?.auto_hold?.reasons).toEqual(['review_findings'])
      expect(types(r.effects)).toEqual(['log:task.awaiting_approval'])
      // 사람이 승인하면 verify로 간다
      const next = approve(r.work, valid())
      expect(next.effects.at(-1)).toMatchObject({ type: 'startTask', node: 'verify' })
    }
  })

  it('앱의 기본값에서 지적이 없는 review는 카운트다운 뒤 자동 승인할 수 있다 (D213)', () => {
    let work = stepApprove(newWork(), valid({}, 'S')).work
    work = stepApprove(work, valid()).work
    const r = stop(launch(work), { ...valid(), reviewFindings: false }, {}, DEFAULT_CONFIG)
    expect(currentTask(r.work)).toMatchObject({ node: 'review', status: 'awaiting_approval' })
    expect(currentTask(r.work)?.countdown?.seconds).toBe(DEFAULT_CONFIG.auto_approve_countdown_sec)
    expect(currentTask(r.work)?.auto_hold).toBeUndefined()
    // 자동 승인을 끈 Work는 지적이 없어도 사람이 승인한다 (D72)
    const off = stop(
      launch({ ...work, settings: { auto_approve: { review: false } } }),
      { ...valid(), reviewFindings: false },
      {},
      DEFAULT_CONFIG,
    )
    expect(currentTask(off.work)?.countdown).toBeUndefined()
  })

  it('앱의 기본값에서 fix는 카운트다운 뒤 자동 승인할 수 있다 (D214)', () => {
    const work = stepApprove(newWork(), valid({}, 'S')).work
    expect(currentTask(work)?.node).toBe('fix')
    const r = stop(launch(work), valid(), {}, DEFAULT_CONFIG)
    expect(currentTask(r.work)?.countdown?.seconds).toBe(DEFAULT_CONFIG.auto_approve_countdown_sec)
  })

  it('의도 승인: 승인을 기록하고, 세션을 끝내고, 결정을 더하고, intent를 확정하고, 다음 task를 시작한다', () => {
    const ready = stop(launch(newWork()), valid({}, 'L')).work
    const r = apply(ready, {
      type: 'approve',
      taskId: 't-01',
      at: '2026-09-26T12:00:00+09:00',
      check: valid({}, 'L'),
    })
    expect(r.effects).toEqual([
      {
        type: 'log',
        event: {
          ts: '2026-09-26T12:00:00+09:00',
          work_id: 'w-20260926-001',
          task_id: 't-01',
          type: 'task.approved',
          payload: { by: 'human' },
        },
      },
      { type: 'endSession', taskId: 't-01' },
      {
        type: 'appendDecisions',
        taskId: 't-01',
        node: 'intake',
        at: '2026-09-26T12:00:00+09:00',
        by: 'human',
        decisions: HANDOFF.decisions,
      },
      { type: 'confirmIntent', taskId: 't-01', version: 1, size: 'L' },
      { type: 'startTask', taskId: 't-02', node: 'evidence', reason: 'default' },
    ])
    expect(r.work.tasks[0]).toMatchObject({
      status: 'approved',
      approved_at: '2026-09-26T12:00:00+09:00',
      approved_by: 'human',
      session: { alive: false, ended_at: '2026-09-26T12:00:00+09:00' },
    })
    expect(r.work.tasks[1]).toMatchObject({
      id: 't-02',
      seq: 2,
      node: 'evidence',
      status: 'working',
    })
  })

  it('의도 승인 화면에서 사람이 고른 size가 초안의 size보다 우선한다 (4.1)', () => {
    const r = stepApprove(newWork(), valid({}, 'L'), 'S')
    expect(r.work.intent).toEqual({ version: 1, size: 'S' })
    expect(currentTask(r.work)?.node).toBe('fix')
  })

  it('verify 승인은 [완료만]으로 Work를 완료한다 (시나리오 7, I22)', () => {
    let work = stepApprove(newWork(), valid({}, 'S')).work
    work = stepApprove(work, valid()).work
    work = stepApprove(work, valid()).work
    expect(currentTask(work)?.node).toBe('verify')
    const r = stepApprove(work, valid())
    expect(r.work.status).toBe('completed')
    expect(types(r.effects)).toEqual([
      'log:task.approved',
      'endSession',
      'appendDecisions',
      'log:work.completed',
    ])
    const last = r.effects.at(-1)
    expect(last?.type === 'log' && last.event.payload).toEqual({ delivery: 'none' })
  })

  it('세션이 이미 끝난 승인 대기도 승인한다. 세션 종료는 하지 않는다', () => {
    const ready = stop(launch(newWork()), valid({}, 'L')).work
    const ended = apply(ready, { type: 'pty.exit', taskId: 't-01', at: at() }).work
    const r = approve(ended, valid({}, 'L'))
    expect(r.rejected).toBeUndefined()
    expect(types(r.effects)).not.toContain('endSession')
  })
})

describe('이전 단계 추천에서 멈춤 (D23)', () => {
  /** S 경로로 verify까지 가서 verify 세션이 살아 있는 Work: t-01 intake, t-02 fix, t-03 review, t-04 verify */
  function toVerify(): WorkState {
    let work = newWork()
    for (const check of [valid({}, 'S'), valid(), valid()]) {
      work = approve(stop(launch(work), check).work, check).work
    }
    return launch(work)
  }

  it('verify가 fix를 추천하면 승인 뒤 다음 task를 시작하지 않고 멈춘다', () => {
    const rec = valid({ recommended_next: { node: 'fix', reason: '완료조건 2 실패' } })
    const r = approve(stop(toVerify(), rec).work, rec)
    expect(r.work.status).toBe('stopped')
    expect(r.work.stop).toEqual({
      kind: 'recommended_back',
      task_id: 't-04',
      node: 'fix',
      reason: '완료조건 2 실패',
    })
    expect(types(r.effects)).toEqual(['log:task.approved', 'endSession', 'appendDecisions'])
    expect(r.work.tasks).toHaveLength(4)
  })

  it('S 경로의 fix가 건너뛴 investigate를 추천해도 멈춘다 (D66, D149)', () => {
    let work = newWork()
    work = approve(stop(launch(work), valid({}, 'S')).work, valid({}, 'S')).work
    const rec = valid({ recommended_next: { node: 'investigate', reason: '원인을 좁히지 못함' } })
    const r = approve(stop(launch(work), rec).work, rec)
    expect(r.work.status).toBe('stopped')
    expect(r.work.stop).toMatchObject({ kind: 'recommended_back', node: 'investigate' })
  })

  it('M 경로의 fix가 investigate를 추천하면 멈춘다 (D55, D147)', () => {
    let work = newWork()
    work = approve(stop(launch(work), valid({}, 'M')).work, valid({}, 'M')).work
    work = approve(stop(launch(work), valid()).work, valid()).work
    expect(currentTask(work)?.node).toBe('fix')
    const rec = valid({ recommended_next: { node: 'investigate', reason: '원인이 틀림' } })
    const r = approve(stop(launch(work), rec).work, rec)
    expect(r.work.status).toBe('stopped')
    expect(r.work.stop).toMatchObject({ kind: 'recommended_back', node: 'investigate' })
  })

  it('기본 다음 단계를 추천하면 그대로 진행한다', () => {
    let work = newWork()
    work = approve(stop(launch(work), valid({}, 'L')).work, valid({}, 'L')).work
    const rec = valid({ recommended_next: { node: 'rca', reason: '다음은 원인 분석' } })
    const r = approve(stop(launch(work), rec).work, rec)
    expect(r.work.status).toBe('active')
    expect(currentTask(r.work)?.node).toBe('rca')
  })

  it('review가 fix를, verify가 review를 추천하면 멈춘다 (5.6.10, D149)', () => {
    let work = newWork()
    for (const check of [valid({}, 'M'), valid(), valid()]) {
      work = approve(stop(launch(work), check).work, check).work
    }
    expect(currentTask(work)?.node).toBe('review')
    const back = valid({ recommended_next: { node: 'fix', reason: '수정 방향이 틀림' } })
    const r = approve(stop(launch(work), back).work, back)
    expect(r.work.stop).toMatchObject({ kind: 'recommended_back', task_id: 't-04', node: 'fix' })

    const toReview = valid({ recommended_next: { node: 'review', reason: '리뷰 반영이 깨짐' } })
    let v = newWork()
    for (const check of [valid({}, 'S'), valid(), valid()]) {
      v = approve(stop(launch(v), check).work, check).work
    }
    expect(currentTask(v)?.node).toBe('verify')
    const rv = approve(stop(launch(v), toReview).work, toReview)
    expect(rv.work.status).toBe('stopped')
    expect(rv.work.stop).toMatchObject({ kind: 'recommended_back', node: 'review' })
  })

  it('멈춘 Work에는 늦은 신호가 와도 바뀌지 않는다', () => {
    const rec = valid({ recommended_next: { node: 'fix', reason: '실패' } })
    const stopped = approve(stop(toVerify(), rec).work, rec).work
    const r = apply(stopped, { type: 'pty.exit', taskId: 't-04', at: at() })
    expect(r.work).toBe(stopped)
  })
})

describe('받지 않는 승인', () => {
  it('에이전트가 턴을 도는 중이거나 막힘이면 승인하지 않는다 (D112)', () => {
    for (const s of ['working', 'asking', 'input_needed', 'blocked'] as const) {
      const work = running(s)
      const r = approve(work, valid({}, 'L'))
      expect(r.rejected).toMatch(/승인할 수 있는 상태가 아님/)
      expect(r.work).toBe(work)
    }
  })

  it('누른 때 다시 한 검사가 유효하지 않으면 승인하지 않고 오류를 보인다 (4.1)', () => {
    const ready = stop(launch(newWork()), valid({}, 'L')).work
    const r = approve(ready, INVALID)
    expect(r.rejected).toMatch(/유효하지 않음/)
    expect(r.effects).toEqual([])
    expect(currentTask(r.work)).toMatchObject({
      status: 'awaiting_approval',
      check: { errors: [ERROR] },
    })
  })

  it('지금 task가 아니면 승인하지 않는다', () => {
    const r = stop(launch(newWork()), valid({}, 'L'))
    const next = approve(r.work, valid({}, 'L')).work
    const again = apply(next, { type: 'approve', taskId: 't-01', at: at(), check: valid({}, 'L') })
    expect(again.rejected).toMatch(/지금 task가 아님/)
    expect(again.work).toBe(next)
  })
})

describe('대기와 세션 종료에서의 승인, [오류 무시하고 승인] (4.1, D90, D112)', () => {
  const BODY: FormatIssue = {
    file: 'handoff.md',
    part: 'body',
    field: '요약',
    message: '`## 요약` 절 없음: handoff 본문의 필수 절',
  }
  const SIZE: FormatIssue = {
    file: 'intent.draft.md',
    part: 'header',
    field: 'size',
    message: '`size` 없음: 필수 필드',
  }
  const TYPE: FormatIssue = {
    file: 'intent.draft.md',
    part: 'header',
    field: 'type',
    message: '`type` 값이 허용값이 아님 (허용값: bugfix, 지금: feature)',
  }
  const NO_DRAFT: FormatIssue = {
    file: 'intent.draft.md',
    part: 'file',
    message: '`intent.draft.md` 없음: `status: awaiting_approval`일 때 필수 산출물',
  }
  const DRAFT_BODY: FormatIssue = {
    file: 'intent.draft.md',
    part: 'body',
    field: '비목표',
    message: '`## 비목표` 절 없음: intent 초안 본문의 필수 절',
  }

  /** handoff 머리글은 스키마를 통과하고 오류가 남은 검사 */
  function withErrors(errors: FormatIssue[], draftSize?: Size): TaskCheck {
    return { ...valid({}, draftSize), handoff: null, errors }
  }

  /** Stop 뒤 오류가 남아 대기가 된 지금 task */
  function idleWith(check: TaskCheck, work: WorkState = launch(newWork())): WorkState {
    const r = stop(work, check, { changed: false })
    expect(status(r.work)).toBe('idle')
    return r.work
  }

  function forceApprove(work: WorkState, check: TaskCheck, size?: Size): Transition {
    const task = currentTask(work)
    return apply(work, {
      type: 'approve',
      taskId: task?.id ?? '',
      at: at(),
      check,
      force: true,
      ...(size ? { size } : {}),
    })
  }

  /** intake를 M으로 승인하고 evidence task를 띄운 Work */
  function atEvidence(): WorkState {
    const ready = stop(launch(newWork()), valid({}, 'L')).work
    return launch(approve(ready, valid({}, 'L')).work)
  }

  it('대기에서도 누른 때의 검사가 유효하면 승인한다', () => {
    const work = idleWith(withErrors([BODY], 'L'))
    const r = approve(work, valid({}, 'L'))
    expect(r.rejected).toBeUndefined()
    expect(r.work.tasks[0]?.status).toBe('approved')
    expect(r.work.tasks[0]?.ignored_errors).toBeUndefined()
    expect(types(r.effects)).toContain('endSession')
  })

  it('intake에서 사람이 size를 고르면 size 오류가 풀려 대기에서도 [의도 승인]이 된다 (4.1)', () => {
    const noSize: TaskCheck = { ...withErrors([SIZE]), intentDraft: null }
    const work = idleWith(noSize)
    expect(approve(work, noSize).rejected).toMatch(/유효하지 않음/)
    const r = approve(work, noSize, 'S')
    expect(r.rejected).toBeUndefined()
    expect(r.work.intent).toEqual({ version: 1, size: 'S' })
    expect(r.work.tasks[0]?.ignored_errors).toBeUndefined()
    expect(currentTask(r.work)?.node).toBe('fix')
  })

  it('[오류 무시하고 승인]은 무시한 오류를 work.json과 events.jsonl에 남기고 진행한다', () => {
    const check = withErrors([BODY, DRAFT_BODY], 'L')
    const r = forceApprove(idleWith(check), check)
    expect(r.rejected).toBeUndefined()
    expect(r.work.tasks[0]).toMatchObject({
      status: 'approved',
      ignored_errors: [BODY, DRAFT_BODY],
    })
    expect(r.effects[0]).toMatchObject({
      type: 'log',
      event: { type: 'task.approved', payload: { by: 'human', ignored_errors: 2 } },
    })
    expect(types(r.effects)).toEqual([
      'log:task.approved',
      'endSession',
      'appendDecisions',
      'confirmIntent',
      'startTask',
    ])
    expect(r.effects[2]).toMatchObject({ decisions: HANDOFF.decisions })
  })

  it('handoff 머리글을 읽지 못하면 결정은 null이고 이전 단계 추천은 없는 것으로 본다', () => {
    const header: FormatIssue = {
      file: 'handoff.md',
      part: 'header',
      message: '머리글 YAML을 읽을 수 없음: bad indentation',
    }
    const unreadable: TaskCheck = { ...MISSING, handoff_present: true, errors: [header] }
    const r = forceApprove(idleWith(unreadable, atEvidence()), unreadable)
    expect(r.rejected).toBeUndefined()
    expect(r.effects.find((e) => e.type === 'appendDecisions')).toMatchObject({ decisions: null })
    expect(r.work.status).toBe('active')
    expect(currentTask(r.work)?.node).toBe('rca')
  })

  it('세션이 끝난 task도 승인하고, 세션 종료는 하지 않는다', () => {
    const check = withErrors([BODY], 'L')
    const ended = apply(idleWith(check), { type: 'pty.exit', taskId: 't-01', at: at() }).work
    expect(status(ended)).toBe('session_ended')
    const r = forceApprove(ended, check)
    expect(r.rejected).toBeUndefined()
    expect(types(r.effects)).not.toContain('endSession')
  })

  it('intake의 intent 초안 머리글 오류와 초안 없음은 넘길 수 없다 (D90)', () => {
    for (const issue of [TYPE, NO_DRAFT, SIZE]) {
      const check: TaskCheck = { ...withErrors([issue, BODY]), intentDraft: null }
      const work = idleWith(check)
      const r = forceApprove(work, check)
      expect(r.rejected).toMatch(/오류를 무시하고 승인할 수 없음/)
      expect(r.effects).toEqual([])
      expect(currentTask(r.work)?.status).toBe('idle')
    }
    // size 오류는 사람이 size를 고르면 풀린다
    const check: TaskCheck = { ...withErrors([SIZE, BODY]), intentDraft: null }
    expect(forceApprove(idleWith(check), check, 'L').rejected).toBeUndefined()
  })

  it('status가 blocked로 읽히면 [오류 무시하고 승인]을 받지 않는다 (4.4)', () => {
    const check: TaskCheck = { ...withErrors([BODY], 'L'), status: 'blocked' }
    const r = forceApprove(idleWith(check), check)
    expect(r.rejected).toMatch(/오류를 무시하고 승인할 수 없음/)
  })

  it('누른 때 오류가 없으면 [오류 무시하고 승인]도 보통 승인이다', () => {
    const work = idleWith(withErrors([BODY], 'L'))
    const r = forceApprove(work, valid({}, 'L'))
    expect(r.rejected).toBeUndefined()
    expect(r.work.tasks[0]?.ignored_errors).toBeUndefined()
    expect(r.effects[0]).toMatchObject({ event: { payload: { by: 'human' } } })
  })

  it('handoff가 없으면 어느 승인도 받지 않는다', () => {
    const work = idleWith(MISSING)
    expect(forceApprove(work, MISSING).rejected).toMatch(/오류를 무시하고 승인할 수 없음/)
    expect(approve(work, MISSING).rejected).toMatch(/유효하지 않음/)
  })
})

// ---------- M3: 사람 조작과 여러 Work ----------

/** intake를 M으로 승인하고 evidence task를 띄운 Work */
function evidenceLive(): WorkState {
  const ready = stop(launch(newWork()), valid({}, 'L')).work
  return launch(approve(ready, valid({}, 'L')).work)
}

describe('대기열 (D18)', () => {
  it('세션 상한 때문에 띄우지 못하면 대기열에 넣고, 자리가 나서 띄우면 작업 중이 된다', () => {
    const work = newWork()
    const q = apply(work, { type: 'task.queued', taskId: 't-01', at: '2026-09-26T10:00:00+09:00' })
    expect(q.rejected).toBeUndefined()
    expect(currentTask(q.work)).toMatchObject({
      status: 'queued',
      queued_at: '2026-09-26T10:00:00+09:00',
      session: null,
    })
    const started = launch(q.work)
    expect(currentTask(started)?.status).toBe('working')
    expect(currentTask(started)?.queued_at).toBeUndefined()
    expect(currentTask(started)?.session?.alive).toBe(true)
  })

  it('살아 있는 세션은 대기열에 넣지 않는다', () => {
    const r = apply(running(), { type: 'task.queued', taskId: 't-01', at: at() })
    expect(r.rejected).toBeDefined()
  })

  it('대기열에서 띄우지 못하면 중단됨이다', () => {
    const q = apply(newWork(), { type: 'task.queued', taskId: 't-01', at: at() }).work
    const r = apply(q, { type: 'session.failed', taskId: 't-01', at: at(), error: 'spawn 실패' })
    expect(currentTask(r.work)).toMatchObject({ status: 'interrupted', error: 'spawn 실패' })
    expect(currentTask(r.work)?.queued_at).toBeUndefined()
  })
})

describe('[즉시 중단] (시나리오 3-4)', () => {
  const interrupt = (work: WorkState, reason: 'human' | 'app_quit' = 'human') =>
    apply(work, { type: 'interrupt', taskId: currentTask(work)?.id ?? '', at: at(), reason })

  it('세션을 트리째 끝내고 중단됨으로 남긴다', () => {
    const r = interrupt(running('working'))
    expect(r.rejected).toBeUndefined()
    expect(currentTask(r.work)).toMatchObject({ status: 'interrupted', session: { alive: false } })
    expect(currentTask(r.work)?.session?.ended_at).toBeDefined()
    expect(types(r.effects)).toEqual(['log:task.interrupted', 'endSession'])
    expect(r.effects[0]).toMatchObject({ event: { payload: { reason: 'human' } } })
  })

  it('질문 대기, 입력 필요, 대기도 중단됨이다', () => {
    for (const s of ['asking', 'input_needed', 'idle'] as const) {
      expect(status(interrupt(running(s)).work)).toBe('interrupted')
    }
  })

  it('승인 대기와 막힘은 세션이 없어도 남는다 (3.3). 끝낸 뒤에도 승인할 수 있다', () => {
    for (const s of ['awaiting_approval', 'blocked'] as const) {
      const r = interrupt(running(s))
      expect(status(r.work)).toBe(s)
      expect(currentTask(r.work)?.session?.alive).toBe(false)
      expect(types(r.effects)).toEqual(['log:task.interrupted', 'endSession'])
    }
    const ended = interrupt(stop(launch(newWork()), valid({}, 'L')).work).work
    const r = approve(ended, valid({}, 'L'))
    expect(r.rejected).toBeUndefined()
    expect(types(r.effects)).not.toContain('endSession')
  })

  it('앱 종료 확인도 같은 전이이고 이유를 남긴다 (시나리오 3-6)', () => {
    const r = interrupt(running('working'), 'app_quit')
    expect(r.effects[0]).toMatchObject({ event: { payload: { reason: 'app_quit' } } })
  })

  it('대기열에서 뺀 task에 유효한 handoff가 있으면 승인 대기로 남는다 (3.3)', () => {
    const ended = apply(stop(launch(newWork()), valid({}, 'L')).work, {
      type: 'pty.exit',
      taskId: 't-01',
      at: at(),
    }).work
    const q = apply(ended, { type: 'task.queued', taskId: 't-01', at: at() }).work
    expect(status(q)).toBe('queued')
    const r = apply(q, {
      type: 'interrupt',
      taskId: 't-01',
      at: at(),
      reason: 'human',
      check: valid({}, 'L'),
    })
    expect(status(r.work)).toBe('awaiting_approval')
  })

  it('대기열의 task는 대기열에서 빼고 중단됨으로 둔다', () => {
    const q = apply(newWork(), { type: 'task.queued', taskId: 't-01', at: at() }).work
    const r = interrupt(q)
    expect(currentTask(r.work)?.status).toBe('interrupted')
    expect(r.effects).toEqual([
      { type: 'dequeue', taskId: 't-01' },
      expect.objectContaining({ type: 'log' }),
    ])
  })

  it('끝낼 세션이 없으면 받지 않는다. 늦게 온 PTY 종료는 무시한다', () => {
    const ended = interrupt(running('working')).work
    expect(interrupt(ended).rejected).toMatch(/끝낼 세션이 없음/)
    const late = apply(ended, { type: 'pty.exit', taskId: 't-01', at: at() })
    expect(late.work).toBe(ended)
  })
})

describe('[재개]와 [세션 재개] (시나리오 3-4, 3-5, 4.4)', () => {
  const resume = (work: WorkState) =>
    apply(work, { type: 'resume', taskId: currentTask(work)?.id ?? '', at: at() })
  const resumed = (work: WorkState, check: TaskCheck = MISSING, pid = 2001) =>
    apply(work, {
      type: 'session.resumed',
      taskId: currentTask(work)?.id ?? '',
      at: '2026-09-26T11:30:00+09:00',
      pid,
      claudeVersion: '2.1.284 (Claude Code)',
      check,
    })
  const interrupted = () =>
    apply(running('working'), { type: 'interrupt', taskId: 't-01', at: at(), reason: 'human' }).work

  it('중단된 세션은 --resume으로 다시 연다. 표시는 다시 연 결과로 바꾼다', () => {
    const before = interrupted()
    const r = resume(before)
    expect(r.rejected).toBeUndefined()
    expect(r.effects).toEqual([{ type: 'resumeTask', taskId: 't-01' }])
    expect(r.work).toBe(before)
    // 다시 연 뒤에는 세션이 살아 있어 다시 누르면 받지 않는다
    expect(resume(resumed(r.work).work).rejected).toMatch(/재개할 수 있는 상태가 아님/)
  })

  it('다시 열면 같은 세션 id로 pid를 바꾸고, handoff가 없으면 대기다', () => {
    const before = interrupted()
    const r = resumed(resume(before).work)
    expect(r.rejected).toBeUndefined()
    const task = currentTask(r.work)
    expect(task).toMatchObject({
      status: 'idle',
      session: {
        id: 'session-t-01',
        pid: 2001,
        alive: true,
        resumed_at: '2026-09-26T11:30:00+09:00',
        started_at: currentTask(before)?.session?.started_at,
      },
    })
    expect(task?.session?.ended_at).toBeUndefined()
    expect(types(r.effects)).toEqual(['log:task.resumed'])
    expect(r.effects[0]).toMatchObject({
      event: {
        task_id: 't-01',
        payload: { session_id: 'session-t-01', claude_version: '2.1.284 (Claude Code)' },
      },
    })
    // 다시 연 세션의 신호를 받는다
    expect(status(stop(r.work, valid({}, 'L')).work)).toBe('awaiting_approval')
  })

  it('다시 연 때 유효한 handoff가 있으면 승인 대기나 막힘이다 (3.3)', () => {
    const r = resumed(resume(interrupted()).work, valid({}, 'L'))
    expect(status(r.work)).toBe('awaiting_approval')
    expect(types(r.effects)).toEqual(['log:task.resumed', 'log:task.awaiting_approval'])
    expect(status(resumed(resume(interrupted()).work, BLOCKED).work)).toBe('blocked')
  })

  it('세션 종료, 세션 없는 승인 대기와 막힘도 다시 연다', () => {
    const ended = apply(running('idle'), { type: 'pty.exit', taskId: 't-01', at: at() }).work
    expect(resume(ended).effects).toEqual([{ type: 'resumeTask', taskId: 't-01' }])
    for (const s of ['awaiting_approval', 'blocked'] as const) {
      const noSession = apply(running(s), { type: 'pty.exit', taskId: 't-01', at: at() }).work
      expect(status(noSession)).toBe(s)
      expect(resume(noSession).effects).toEqual([{ type: 'resumeTask', taskId: 't-01' }])
    }
  })

  it('한 번도 띄우지 못한 task는 새 세션으로 시작한다', () => {
    const failed = apply(newWork(), {
      type: 'session.failed',
      taskId: 't-01',
      at: at(),
      error: 'claude 없음',
    }).work
    const r = resume(failed)
    expect(r.effects).toEqual([
      { type: 'startTask', taskId: 't-01', node: 'intake', reason: 'default' },
    ])
    // 띄우면 앞의 실패 이유를 지운다
    const started = currentTask(launch(r.work))
    expect(started?.session?.alive).toBe(true)
    expect(started?.error).toBeUndefined()
  })

  it('승인 대기를 다시 열어도 task.awaiting_approval을 거듭 남기지 않는다', () => {
    const ended = apply(stop(launch(newWork()), valid({}, 'L')).work, {
      type: 'pty.exit',
      taskId: 't-01',
      at: at(),
    }).work
    const r = resumed(resume(ended).work, valid({}, 'L'))
    expect(status(r.work)).toBe('awaiting_approval')
    expect(types(r.effects)).toEqual(['log:task.resumed'])
  })

  it('세션 없는 승인 대기를 다시 열지 못하면 유효한 handoff로 승인 대기에 남는다 (3.3)', () => {
    const ended = apply(stop(launch(newWork()), valid({}, 'L')).work, {
      type: 'pty.exit',
      taskId: 't-01',
      at: at(),
    }).work
    const r = apply(resume(ended).work, {
      type: 'session.failed',
      taskId: 't-01',
      at: at(),
      error: 'claude 없음',
      check: valid({}, 'L'),
    })
    expect(currentTask(r.work)).toMatchObject({ status: 'awaiting_approval', error: 'claude 없음' })
    expect(approve(r.work, valid({}, 'L')).rejected).toBeUndefined()
  })

  it('다시 열지 못하면 중단됨이고 세션 id는 남는다', () => {
    const r = apply(resume(interrupted()).work, {
      type: 'session.failed',
      taskId: 't-01',
      at: at(),
      error: 'spawn 실패',
    })
    expect(currentTask(r.work)).toMatchObject({
      status: 'interrupted',
      error: 'spawn 실패',
      session: { id: 'session-t-01', alive: false },
    })
  })

  it('살아 있는 세션, 작업 중, 승인됨은 재개하지 않는다', () => {
    for (const s of ['working', 'awaiting_approval', 'idle'] as const) {
      expect(resume(running(s)).rejected).toMatch(/재개할 수 있는 상태가 아님/)
    }
  })

  it('앞 프로세스의 늦은 PTY 종료는 다시 연 세션을 끝내지 않는다', () => {
    const open = resumed(resume(interrupted()).work).work
    const late = apply(open, { type: 'pty.exit', taskId: 't-01', at: at(), pid: 1001 })
    expect(late.work).toBe(open)
    const own = apply(open, { type: 'pty.exit', taskId: 't-01', at: at(), pid: 2001 })
    expect(status(own.work)).toBe('session_ended')
  })
})

describe('[이 단계 새 세션으로 다시] (시나리오 3-5, D114)', () => {
  it('handoff 없이 끝난 세션이면 같은 노드의 새 task를 새 세션으로 시작한다', () => {
    const work = evidenceLive()
    const ended = apply(work, { type: 'pty.exit', taskId: 't-02', at: at() }).work
    const r = apply(ended, { type: 'retry', taskId: 't-02', at: '2026-09-26T12:00:00+09:00' })
    expect(r.rejected).toBeUndefined()
    expect(r.work.tasks.map((t) => [t.id, t.node, t.status, t.reason])).toEqual([
      ['t-01', 'intake', 'approved', 'default'],
      ['t-02', 'evidence', 'session_ended', 'default'],
      ['t-03', 'evidence', 'working', 'resume'],
    ])
    expect(r.effects).toEqual([
      { type: 'startTask', taskId: 't-03', node: 'evidence', reason: 'resume' },
    ])
  })

  it('세션 종료가 아니면 받지 않는다', () => {
    for (const s of ['working', 'idle', 'interrupted', 'awaiting_approval'] as const) {
      const work = running(s)
      expect(apply(work, { type: 'retry', taskId: 't-01', at: at() }).rejected).toMatch(
        /handoff 없이 끝난 세션이 아님/,
      )
    }
  })
})

describe('[이 단계 끝나면 멈춤]과 멈춘 Work의 [재개] (시나리오 3-4, 3.3)', () => {
  const stopAfter = (work: WorkState, on: boolean) =>
    apply(work, { type: 'stopAfter', at: at(), on })

  it('켜 두면 승인 뒤 다음 단계를 시작하지 않고 멈춘다. 멈춤 표시는 지운다', () => {
    const on = stopAfter(evidenceLive(), true).work
    expect(on.stop_after_step).toBe(true)
    const r = approve(stop(on, valid()).work, valid())
    expect(r.work).toMatchObject({
      status: 'stopped',
      stop: { kind: 'after_step', task_id: 't-02' },
    })
    expect(r.work.stop_after_step).toBeUndefined()
    expect(types(r.effects)).toEqual(['log:task.approved', 'endSession', 'appendDecisions'])
    expect(r.work.tasks).toHaveLength(2)
  })

  it('끄면 그대로 진행한다', () => {
    const off = stopAfter(stopAfter(evidenceLive(), true).work, false).work
    expect(off.stop_after_step).toBeUndefined()
    const r = approve(stop(off, valid()).work, valid())
    expect(r.work.status).toBe('active')
    expect(currentTask(r.work)?.node).toBe('rca')
  })

  it('의도 승인 뒤에도 멈춘다. [재개]하면 기본 다음 단계를 시작한다', () => {
    const on = stopAfter(launch(newWork()), true).work
    const stopped = approve(stop(on, valid({}, 'S')).work, valid({}, 'S')).work
    expect(stopped).toMatchObject({ status: 'stopped', intent: { size: 'S' } })
    const r = apply(stopped, { type: 'resumeWork', at: at() })
    expect(r.rejected).toBeUndefined()
    expect(r.work.status).toBe('active')
    expect(r.work.stop).toBeUndefined()
    expect(r.effects).toEqual([
      { type: 'startTask', taskId: 't-02', node: 'fix', reason: 'default' },
    ])
  })

  it('verify 승인도 멈춤이 켜져 있으면 Work를 완료하지 않고 멈춘다. [재개]하면 완료한다', () => {
    let work = newWork()
    for (const check of [valid({}, 'S'), valid(), valid()]) {
      work = approve(stop(launch(work), check).work, check).work
    }
    const on = stopAfter(launch(work), true).work
    expect(currentTask(on)?.node).toBe('verify')
    const r = approve(stop(on, valid()).work, valid())
    expect(r.work).toMatchObject({
      status: 'stopped',
      stop: { kind: 'after_step', task_id: 't-04' },
    })
    expect(r.work.completed_at).toBeUndefined()
    expect(r.work.stop_after_step).toBeUndefined()
    expect(types(r.effects)).toEqual(['log:task.approved', 'endSession', 'appendDecisions'])
    const done = apply(r.work, { type: 'resumeWork', at: at() })
    expect(done.work).toMatchObject({ status: 'completed' })
    expect(done.work.stop).toBeUndefined()
    expect(types(done.effects)).toEqual(['log:work.completed'])
  })

  it('이전 단계 추천으로 멈춘 Work를 [재개]하면 추천을 따르지 않고 기본 다음 단계로 간다', () => {
    const rec = valid({ recommended_next: { node: 'intake', reason: '의도를 다시' } })
    const stopped = approve(stop(evidenceLive(), rec).work, rec).work
    expect(stopped.stop).toMatchObject({ kind: 'recommended_back', node: 'intake' })
    const r = apply(stopped, { type: 'resumeWork', at: at() })
    expect(r.effects).toEqual([
      { type: 'startTask', taskId: 't-03', node: 'rca', reason: 'default' },
    ])
  })

  it('verify에서 멈춘 Work를 [재개]하면 Work를 완료한다', () => {
    let work = newWork()
    for (const check of [valid({}, 'S'), valid(), valid()]) {
      work = approve(stop(launch(work), check).work, check).work
    }
    expect(currentTask(work)?.node).toBe('verify')
    const rec = valid({ recommended_next: { node: 'fix', reason: '완료조건 2 실패' } })
    const stopped = approve(stop(launch(work), rec).work, rec).work
    const r = apply(stopped, { type: 'resumeWork', at: at() })
    expect(r.work.status).toBe('completed')
    expect(types(r.effects)).toEqual(['log:work.completed'])
  })

  it('멈추지 않은 Work의 [재개]와 끝난 Work의 멈춤 표시는 받지 않는다', () => {
    expect(apply(running(), { type: 'resumeWork', at: at() }).rejected).toMatch(/멈춘 Work가 아님/)
    const done = { ...running(), status: 'completed' as const }
    expect(stopAfter(done, true).rejected).toBeDefined()
  })
})

describe('[Work 포기] (3.3)', () => {
  const abandon = (work: WorkState) => apply(work, { type: 'abandon', at: at() })

  it('살아 있는 세션을 끝내고 Work를 포기로 둔다', () => {
    const r = abandon(evidenceLive())
    expect(r.rejected).toBeUndefined()
    expect(r.work.status).toBe('abandoned')
    expect(r.work.abandoned_at).toBeDefined()
    expect(currentTask(r.work)).toMatchObject({ status: 'interrupted', session: { alive: false } })
    expect(types(r.effects)).toEqual(['log:task.interrupted', 'endSession', 'log:work.abandoned'])
    expect(r.effects[0]).toMatchObject({ event: { payload: { reason: 'abandoned' } } })
  })

  it('승인 대기도 중단됨으로 둔다. 포기한 Work의 task는 승인하지 않는다', () => {
    const r = abandon(running('awaiting_approval'))
    expect(status(r.work)).toBe('interrupted')
    expect(approve(r.work, valid({}, 'L')).rejected).toMatch(/진행 중인 Work가 아님/)
    // 늦은 신호는 무시한다
    expect(apply(r.work, { type: 'UserPromptSubmit', taskId: 't-01', at: at() }).work).toBe(r.work)
  })

  it('대기열의 task는 뺀다. 멈춘 Work도 포기한다', () => {
    const q = apply(newWork(), { type: 'task.queued', taskId: 't-01', at: at() }).work
    expect(types(abandon(q).effects)).toEqual([
      'dequeue',
      'log:task.interrupted',
      'log:work.abandoned',
    ])
    const on = apply(evidenceLive(), { type: 'stopAfter', at: at(), on: true }).work
    const stopped = approve(stop(on, valid()).work, valid()).work
    expect(stopped.status).toBe('stopped')
    const r = abandon(stopped)
    expect(r.work.status).toBe('abandoned')
    expect(r.work.stop).toBeUndefined()
    expect(types(r.effects)).toEqual(['log:work.abandoned'])
  })

  it('완료나 포기한 Work는 포기하지 않는다', () => {
    const done = { ...running('approved'), status: 'completed' as const }
    expect(abandon(done).rejected).toBeDefined()
    expect(abandon(abandon(running()).work).rejected).toBeDefined()
  })
})

describe('Work별 설정 (D72)', () => {
  it('질문 방식을 덮어쓴다. 끝난 Work는 바꾸지 않는다', () => {
    const settings = { question_mode: { evidence: 'confirm_each' as const } }
    const r = apply(running(), { type: 'settings.update', at: at(), settings })
    expect(r.work.settings).toEqual(settings)
    const done = { ...running(), status: 'completed' as const }
    expect(apply(done, { type: 'settings.update', at: at(), settings }).rejected).toBeDefined()
  })
})

describe('재시작 조정 (시나리오 9, D75, D78)', () => {
  const restart = (work: WorkState, check: TaskCheck | null = MISSING) =>
    apply(work, { type: 'app.restarted', at: '2026-09-26T13:00:00+09:00', check })

  it('실행 중이던 task는 중단됨이다. 세션은 살아 있지 않다', () => {
    for (const s of ['working', 'asking', 'input_needed', 'idle'] as const) {
      const r = restart(running(s))
      expect(currentTask(r.work)).toMatchObject({
        status: 'interrupted',
        session: { alive: false, ended_at: '2026-09-26T13:00:00+09:00' },
      })
      expect(r.effects).toEqual([
        expect.objectContaining({
          event: expect.objectContaining({
            type: 'task.interrupted',
            payload: { reason: 'app_restart' },
          }),
        }),
      ])
    }
  })

  it('유효한 handoff가 있으면 승인 대기나 막힘이다. 자동 승인과 자동 재개는 하지 않는다', () => {
    const r = restart(running('working'), valid({}, 'L'))
    expect(currentTask(r.work)).toMatchObject({
      status: 'awaiting_approval',
      session: { alive: false },
      check: { handoff_present: true, errors: [] },
    })
    expect(types(r.effects)).toEqual(['log:task.awaiting_approval'])
    expect(r.effects[0]).toMatchObject({ event: { payload: { reason: 'app_restart' } } })
    expect(status(restart(running('working'), BLOCKED).work)).toBe('blocked')
    // 이미 승인 대기였으면 기록을 더하지 않는다
    const kept = restart(running('awaiting_approval'), valid({}, 'L'))
    expect(status(kept.work)).toBe('awaiting_approval')
    expect(kept.effects).toEqual([])
    // 승인 대기였어도 지금 handoff가 유효하지 않으면 중단됨이다
    expect(status(restart(running('awaiting_approval'), INVALID).work)).toBe('interrupted')
  })

  it('띄우는 중이던 task도 중단됨이다', () => {
    const r = restart(newWork())
    expect(currentTask(r.work)).toMatchObject({ status: 'interrupted', session: null })
  })

  it('대기열을 비우고 대기 중이던 task를 중단됨으로 바꾼다 (D78)', () => {
    const q = apply(newWork(), { type: 'task.queued', taskId: 't-01', at: at() }).work
    const r = restart(q)
    expect(currentTask(r.work)?.status).toBe('interrupted')
    expect(currentTask(r.work)?.queued_at).toBeUndefined()
    expect(r.effects).toEqual([
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'task.interrupted',
          payload: { reason: 'app_restart', queued: true },
        }),
      }),
    ])
    // 재시작 뒤 [재개]하면 새 세션으로 시작한다
    const resumed = apply(r.work, { type: 'resume', taskId: 't-01', at: at() })
    expect(types(resumed.effects)).toEqual(['startTask'])
  })

  it('다시 열려고 대기열에 있던 승인 대기는 유효한 handoff로 승인 대기가 된다 (3.3)', () => {
    const ended = apply(stop(launch(newWork()), valid({}, 'L')).work, {
      type: 'pty.exit',
      taskId: 't-01',
      at: at(),
    }).work
    const q = apply(ended, { type: 'task.queued', taskId: 't-01', at: at() }).work
    const r = restart(q, valid({}, 'L'))
    expect(status(r.work)).toBe('awaiting_approval')
    expect(r.effects).toEqual([
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'task.awaiting_approval',
          payload: { reason: 'app_restart' },
        }),
      }),
    ])
  })

  it('실행 중이 아니던 task와 끝난 Work는 그대로 둔다', () => {
    const ended = apply(running('idle'), { type: 'pty.exit', taskId: 't-01', at: at() }).work
    expect(restart(ended).work).toBe(ended)
    const interrupted = apply(running(), {
      type: 'interrupt',
      taskId: 't-01',
      at: at(),
      reason: 'app_quit',
    }).work
    expect(restart(interrupted).work).toBe(interrupted)
  })
})

describe('액션 바의 조작 (시나리오 3-4, 3-5, 4.4)', () => {
  it('상태마다 누를 수 있는 버튼', () => {
    const live = actions(running('working'))
    expect(live).toMatchObject({ interrupt: true, resume: false, retry: false, stopAfter: true })
    const q = apply(newWork(), { type: 'task.queued', taskId: 't-01', at: at() }).work
    expect(actions(q)).toMatchObject({ interrupt: true, resume: false })
    const ended = apply(running('idle'), { type: 'pty.exit', taskId: 't-01', at: at() }).work
    expect(actions(ended)).toMatchObject({ interrupt: false, resume: true, retry: true })
    const interrupted = apply(running(), {
      type: 'interrupt',
      taskId: 't-01',
      at: at(),
      reason: 'human',
    }).work
    expect(actions(interrupted)).toMatchObject({ interrupt: false, resume: true, retry: false })
    const stopped = { ...running('approved'), status: 'stopped' as const }
    expect(actions(stopped)).toMatchObject({
      interrupt: false,
      resume: false,
      resumeWork: true,
      stopAfter: false,
      abandon: true,
    })
    // 완료나 포기한 Work는 [Work 정리]만 누른다 (시나리오 8). 보관된 Work는 아무것도 누르지 않는다
    const done = { ...running('approved'), status: 'completed' as const }
    const { clean, ...rest } = actions(done)
    expect(clean).toBe(true)
    expect(Object.values(rest).every((v) => !v)).toBe(true)
    expect(actions({ ...done, status: 'abandoned' }).clean).toBe(true)
    const archived = { ...done, status: 'archived' as const }
    expect(Object.values(actions(archived)).every((v) => !v)).toBe(true)
  })
})

describe('단계 선택 (6.2, D77, D115~D117)', () => {
  /** S 경로로 verify까지 가서 verify 세션이 살아 있는 Work: t-01 intake, t-02 fix, t-03 review, t-04 verify */
  function toVerify(): WorkState {
    let work = newWork()
    for (const check of [valid({}, 'S'), valid(), valid()]) {
      work = approve(stop(launch(work), check).work, check).work
    }
    return launch(work)
  }

  /** L 경로로 rca까지 가서 rca 세션이 살아 있는 Work: t-01 intake, t-02 evidence, t-03 rca */
  function toRca(): WorkState {
    let work = newWork()
    for (const check of [valid({}, 'L'), valid()]) {
      work = approve(stop(launch(work), check).work, check).work
    }
    return launch(work)
  }

  function select(
    work: WorkState,
    node: NodeName,
    opts: {
      keepCode?: boolean
      instruction?: string
      expect?: { taskId: string; done: boolean }
    } = {},
  ): Transition {
    const task = currentTask(work)
    return apply(work, {
      type: 'selectStep',
      at: at(),
      node,
      keepCode: opts.keepCode ?? false,
      instruction: opts.instruction ?? '',
      expect: opts.expect ?? { taskId: task?.id ?? '', done: task?.status === 'approved' },
      backups: [],
    })
  }

  const BACKUP = 'relay/w-20260926-001-discarded-1'

  it('코드를 되돌리는 되감기는 진행 중 작업을 기록하고 세션을 끝낸 뒤 코드를 main에 맡긴다 (D77)', () => {
    const r = select(toVerify(), 'fix', { instruction: '  완료조건 2를 다시 봐 줘\n' })
    expect(r.rejected).toBeUndefined()
    expect(r.work.operation).toEqual({
      kind: 'rewind',
      stage: 'backup',
      started_at: r.work.operation?.started_at,
      node: 'fix',
      from_task: 't-04',
      instruction: '완료조건 2를 다시 봐 줘',
      discard: ['t-02', 't-03', 't-04'],
      reset_to: 'start-t-02',
      backup_branch: BACKUP,
      backup_commit: null,
    })
    expect(types(r.effects)).toEqual(['log:task.interrupted', 'endSession', 'rewindCode'])
    const logged = r.effects[0]
    expect(logged?.type === 'log' && logged.event.payload).toEqual({ reason: 'rewind' })
    expect(r.effects[2]).toEqual({
      type: 'rewindCode',
      to: 'start-t-02',
      backupBranch: BACKUP,
      message: 'relay(w-20260926-001): 되감기 전 커밋 안 된 변경',
    })
    // 폐기와 새 task는 코드를 되돌린 뒤다
    expect(r.work.tasks.map((t) => [t.id, t.status])).toEqual([
      ['t-01', 'approved'],
      ['t-02', 'approved'],
      ['t-03', 'approved'],
      ['t-04', 'interrupted'],
    ])
    expect(r.work.tasks[3]?.session?.alive).toBe(false)
  })

  it('백업하고 되돌리면 task를 폐기하고 고른 단계를 되감기로 시작하며 기록을 지운다', () => {
    const phase1 = select(toVerify(), 'fix', { instruction: '다시' }).work
    const backedUp = apply(phase1, {
      type: 'rewind.backedUp',
      at: at(),
      branch: BACKUP,
      commit: 'backup-commit',
    })
    expect(backedUp.work.operation).toMatchObject({
      stage: 'reset',
      backup_branch: BACKUP,
      backup_commit: 'backup-commit',
    })
    expect(backedUp.effects).toEqual([])
    const r = apply(backedUp.work, { type: 'rewind.applied', at: at(), head: 'head-before' })
    expect(r.work.operation).toBeUndefined()
    expect(r.work.status).toBe('active')
    expect(r.work.tasks.map((t) => [t.id, t.node, t.status, t.reason])).toEqual([
      ['t-01', 'intake', 'approved', 'default'],
      ['t-02', 'fix', 'discarded', 'default'],
      ['t-03', 'review', 'discarded', 'default'],
      ['t-04', 'verify', 'discarded', 'default'],
      ['t-05', 'fix', 'working', 'rewind'],
    ])
    expect(r.work.tasks[1]).toMatchObject({ discarded_by: 't-05', approved_by: 'human' })
    expect(r.work.tasks[1]?.discarded_at).toBeDefined()
    expect(r.work.tasks[4]?.selection).toEqual({
      from_task: 't-04',
      instruction: '다시',
      discarded: ['t-02', 't-03', 't-04'],
      skipped: [],
      keep_code: false,
      reset: {
        from: 'head-before',
        to: 'start-t-02',
        backup_branch: BACKUP,
        backup_commit: 'backup-commit',
      },
    })
    expect(r.effects).toEqual([
      {
        type: 'log',
        event: {
          ts: expect.any(String) as string,
          work_id: 'w-20260926-001',
          task_id: 't-05',
          type: 'task.rewound',
          payload: {
            node: 'fix',
            from_task: 't-04',
            discarded: ['t-02', 't-03', 't-04'],
            keep_code: false,
            reset_to: 'start-t-02',
            backup_branch: BACKUP,
          },
        },
      },
      { type: 'startTask', taskId: 't-05', node: 'fix', reason: 'rewind' },
    ])
    // 폐기된 task에 늦게 온 신호는 무시한다
    const late = apply(r.work, { type: 'pty.exit', taskId: 't-04', at: at() })
    expect(late.work).toBe(r.work)
  })

  it('백업할 것이 없었으면 백업 브랜치는 null이다 (D116)', () => {
    const phase1 = select(toVerify(), 'verify').work
    const none = apply(phase1, { type: 'rewind.backedUp', at: at(), branch: null, commit: null })
    const r = apply(none.work, { type: 'rewind.applied', at: at(), head: 'start-t-04' })
    expect(r.work.tasks.at(-1)?.selection?.reset).toEqual({
      from: 'start-t-04',
      to: 'start-t-04',
      backup_branch: null,
      backup_commit: null,
    })
    const logged = r.effects[0]
    expect(logged?.type === 'log' && logged.event.payload['backup_branch']).toBeNull()
  })

  it('git이 실패하면 기록만 지우고 Work는 그대로 둔다. 끝낸 task는 [재개]할 수 있다', () => {
    const phase1 = select(toVerify(), 'fix').work
    const r = apply(phase1, { type: 'rewind.failed', at: at(), error: 'index.lock' })
    expect(r.work.operation).toBeUndefined()
    expect(r.work.tasks).toEqual(phase1.tasks)
    expect(r.effects).toEqual([])
    expect(actions(r.work)).toMatchObject({ resume: true, selectStep: true })
    // 기록이 없는데 온 결과는 받지 않는다
    expect(apply(r.work, { type: 'rewind.applied', at: at(), head: 'h' }).rejected).toBe(
      '진행 중인 되감기가 없음',
    )
    expect(
      apply(r.work, { type: 'rewind.backedUp', at: at(), branch: null, commit: null }).work,
    ).toBe(r.work)
  })

  it('git이 실패했는데 코드가 이미 바뀌었으면 끊긴 되감기로 남긴다. 승인과 전달을 막고 [다시 시도]로 잇는다 (D136)', () => {
    const phase1 = select(toVerify(), 'fix').work
    const backedUp = apply(phase1, {
      type: 'rewind.backedUp',
      at: at(),
      branch: BACKUP,
      commit: 'backup1',
      head: 'fixhead1',
    }).work
    const failedAt = at()
    const r = apply(backedUp, { type: 'rewind.failed', at: failedAt, error: 'clean', cut: true })
    expect(r.work.operation).toEqual({ ...backedUp.operation, interrupted_at: failedAt })
    expect(r.work.tasks).toEqual(backedUp.tasks)
    expect(badge(r.work).kind).toBe('recovery')
    expect(approve(r.work, valid()).rejected).toBe(OPERATION_BLOCKS)
    const retry = apply(r.work, { type: 'operationRetry', at: at() })
    expect(retry.effects.map((e) => e.type)).toEqual(['resumeRewind'])
  })

  it('건너뛰기는 한 번에 반영한다: 진행 중인 k를 끝내고 폐기하고 고른 단계를 시작한다. 코드는 그대로다 (D117)', () => {
    const r = select(toRca(), 'verify', { instruction: '바로 검증해 줘' })
    expect(r.work.operation).toBeUndefined()
    expect(r.work.tasks.map((t) => [t.id, t.node, t.status, t.reason])).toEqual([
      ['t-01', 'intake', 'approved', 'default'],
      ['t-02', 'evidence', 'approved', 'default'],
      ['t-03', 'rca', 'discarded', 'default'],
      ['t-04', 'verify', 'working', 'skip'],
    ])
    // fix와 review를 건너뛴다 (D166)
    expect(r.work.tasks[2]?.session?.alive).toBe(false)
    expect(types(r.effects)).toEqual([
      'log:task.interrupted',
      'endSession',
      'log:task.skipped_to',
      'startTask',
    ])
    const skipped = r.effects[2]
    expect(skipped?.type === 'log' && skipped.event).toMatchObject({
      task_id: 't-04',
      payload: {
        node: 'verify',
        from_task: 't-03',
        discarded: ['t-03'],
        skipped: ['fix', 'review'],
      },
    })
    expect(r.work.tasks[3]?.selection).toEqual({
      from_task: 't-03',
      instruction: '바로 검증해 줘',
      discarded: ['t-03'],
      skipped: ['fix', 'review'],
      keep_code: false,
      reset: null,
    })
  })

  it('[현재 코드 위에서 이어서]는 코드를 두고 한 번에 반영한다 (6.2)', () => {
    const r = select(toVerify(), 'fix', { keepCode: true })
    expect(r.work.operation).toBeUndefined()
    expect(types(r.effects)).toEqual([
      'log:task.interrupted',
      'endSession',
      'log:task.rewound',
      'startTask',
    ])
    const logged = r.effects[2]
    expect(logged?.type === 'log' && logged.event.payload).toEqual({
      node: 'fix',
      from_task: 't-04',
      discarded: ['t-02', 't-03', 't-04'],
      keep_code: true,
    })
    expect(r.work.tasks.at(-1)?.selection).toMatchObject({ keep_code: true, reset: null })
  })

  it('이전 단계 추천으로 멈춘 Work에서 추천대로 고르면 진행 중으로 되돌리고 멈춤 표시를 지운다 (D23)', () => {
    const rec = valid({ recommended_next: { node: 'fix', reason: '완료조건 2 실패' } })
    const stopped = approve(stop(toVerify(), rec).work, rec).work
    expect(stopped.status).toBe('stopped')
    const phase1 = select(stopped, 'fix')
    // 끝난 k라 끝낼 세션이 없다
    expect(types(phase1.effects)).toEqual(['rewindCode'])
    expect(phase1.work.status).toBe('stopped')
    const r = apply(phase1.work, { type: 'rewind.applied', at: at(), head: 'h' })
    expect(r.work.status).toBe('active')
    expect(r.work.stop).toBeUndefined()
    expect(r.work.tasks.map((t) => [t.id, t.status])).toEqual([
      ['t-01', 'approved'],
      ['t-02', 'discarded'],
      ['t-03', 'discarded'],
      ['t-04', 'discarded'],
      ['t-05', 'working'],
    ])
  })

  it('끝난 k 다음의 기본 다음 단계를 고르면 기본 진행이고 추가 지시만 남는다', () => {
    const on = apply(launch(newWork()), { type: 'stopAfter', at: at(), on: true }).work
    const ready = stop(on, valid({}, 'L')).work
    const stopped = approve(ready, valid({}, 'L')).work
    expect(stopped.status).toBe('stopped')
    const r = select(stopped, 'evidence', { instruction: '로그를 먼저 봐 줘' })
    expect(r.work.status).toBe('active')
    expect(types(r.effects)).toEqual(['startTask'])
    expect(r.work.tasks[1]).toMatchObject({
      node: 'evidence',
      reason: 'default',
      selection: { instruction: '로그를 먼저 봐 줘', discarded: [], skipped: [] },
    })
  })

  it('미리 본 뒤 지금 task나 그 task가 끝났는지가 바뀌었으면 받지 않는다', () => {
    const work = toVerify()
    expect(select(work, 'fix', { expect: { taskId: 't-02', done: false } }).rejected).toBe(
      '미리 본 뒤 Work가 바뀌었음. 단계 선택을 다시 여세요',
    )
    expect(select(work, 'fix', { expect: { taskId: 't-04', done: true } }).rejected).toBeDefined()
  })

  it('의도 승인 전에는 intake만 고를 수 있다. intake로 되감은 뒤 의도 승인하면 intent 새 버전이다 (6.3, D40)', () => {
    const before = launch(newWork())
    expect(select(before, 'evidence').rejected).toBe('의도 승인 전에는 intake만 고를 수 있음 (6.3)')
    expect(select(before, 'intake').work.operation).toMatchObject({
      node: 'intake',
      discard: ['t-01'],
      reset_to: 'start-t-01',
    })

    const phase1 = select(toVerify(), 'intake', { instruction: '범위를 넓혀 줘' }).work
    const rewound = apply(phase1, { type: 'rewind.applied', at: at(), head: 'h' }).work
    expect(rewound.tasks.map((t) => t.status)).toEqual([
      'discarded',
      'discarded',
      'discarded',
      'discarded',
      'working',
    ])
    // 새 intake가 승인되기 전에는 지금 승인된 intent가 그대로다
    expect(rewound.intent).toEqual({ version: 1, size: 'S' })
    const ready = stop(launch(rewound), valid({}, 'L')).work
    const r = approve(ready, valid({}, 'L'))
    expect(r.work.intent).toEqual({ version: 2, size: 'L' })
    expect(r.effects).toContainEqual({
      type: 'confirmIntent',
      taskId: 't-05',
      version: 2,
      size: 'L',
    })
    expect(currentTask(r.work)).toMatchObject({ id: 't-06', node: 'evidence', reason: 'default' })
  })

  it('끝난 Work에서는 고르지 않는다. [단계 선택]은 진행 중이거나 멈춘 Work에서 누른다', () => {
    const done = { ...running('approved'), status: 'completed' as const }
    expect(select(done, 'intake', { expect: { taskId: 't-01', done: true } }).rejected).toBe(
      '진행 중이거나 멈춘 Work가 아님',
    )
    expect(actions(done).selectStep).toBe(false)
    expect(actions(running('working')).selectStep).toBe(true)
    expect(actions({ ...running('approved'), status: 'stopped' }).selectStep).toBe(true)
    expect(actions({ ...running('working'), status: 'abandoned' }).selectStep).toBe(false)
  })

  it('재시작 조정은 남은 되감기 기록을 끊긴 작업으로 표시한다 (시나리오 9-4, D121)', () => {
    const phase1 = select(toVerify(), 'fix').work
    const when = at()
    const r = apply(phase1, { type: 'app.restarted', at: when, check: null })
    expect(r.work.operation).toEqual({ ...phase1.operation, interrupted_at: when })
    // 또 켜도 처음 찾은 때를 둔다
    const again = apply(r.work, { type: 'app.restarted', at: at(), check: null })
    expect(again.work).toBe(r.work)
  })
})

describe('전달 (시나리오 7, D77, D119, D120)', () => {
  const BRANCH = 'relay/w-20260926-001'

  /**
   * S 경로로 verify까지 가서 verify가 승인 대기인 Work: t-01 intake, t-02 fix, t-03 review,
   * t-04 verify(세션 살아 있음)
   */
  function atVerify(): WorkState {
    let work = newWork()
    for (const check of [valid({}, 'S'), valid(), valid()]) {
      work = approve(stop(launch(work), check).work, check).work
    }
    return stop(launch(work), valid()).work
  }

  function deliver(
    work: WorkState,
    choice: 'push' | 'pr',
    uncommitted: 'discard' | 'commit' | 'session' | null = null,
    check: TaskCheck | null = valid(),
  ): Transition {
    return apply(work, { type: 'deliver', at: at(), choice, uncommitted, check })
  }

  function succeed(work: WorkState, extra: { prUrl?: string; draft?: boolean } = {}) {
    return apply(work, {
      type: 'delivery.succeeded',
      at: at(),
      compareUrl: 'https://github.com/o/r/compare/main...relay%2Fw-20260926-001?expand=1',
      ...extra,
      check: valid({ decisions: [{ what: '완료조건을 모두 통과', why: '다시 실행함', by: 'ai' }] }),
    })
  }

  it('[push]는 verify 세션을 끝내고 진행 중 작업을 기록한 뒤 전달을 main에 맡긴다. 승인은 아직 없다 (D120)', () => {
    const work = atVerify()
    const r = deliver(work, 'push')
    expect(r.rejected).toBeUndefined()
    expect(r.work.status).toBe('active')
    expect(r.work.operation).toEqual({
      kind: 'deliver',
      stage: 'push',
      started_at: r.work.operation?.started_at,
      choice: 'push',
      task_id: 't-04',
      uncommitted: null,
      branch: BRANCH,
      base: 'main',
    })
    const task = currentTask(r.work)
    expect(task).toMatchObject({ status: 'awaiting_approval', session: { alive: false } })
    expect(task?.approved_at).toBeUndefined()
    expect(types(r.effects)).toEqual(['endSession', 'deliver'])
    expect(r.effects[1]).toEqual({
      type: 'deliver',
      taskId: 't-04',
      choice: 'push',
      uncommitted: null,
      message: null,
      branch: BRANCH,
      base: 'main',
    })
  })

  it('커밋 안 된 변경을 처리하면 prepare 단계부터 기록하고 커밋이나 stash의 메시지를 준다 (7-5)', () => {
    const discard = deliver(atVerify(), 'pr', 'discard')
    expect(discard.work.operation).toMatchObject({ stage: 'prepare', uncommitted: 'discard' })
    expect(discard.effects.at(-1)).toMatchObject({
      uncommitted: 'discard',
      message: 'relay(w-20260926-001): 완료 전 버린 변경',
    })
    const commit = deliver(atVerify(), 'push', 'commit')
    expect(commit.effects.at(-1)).toMatchObject({
      uncommitted: 'commit',
      message: 'relay(w-20260926-001): 완료 전 남은 변경',
    })
    // 단계가 넘어가면 기록의 단계를 옮기고, 만든 커밋이나 stash를 적는다 (D77)
    const pushing = apply(commit.work, {
      type: 'delivery.stage',
      at: at(),
      stage: 'push',
      commit: 'commit01',
    })
    expect(pushing.work.operation).toMatchObject({
      kind: 'deliver',
      stage: 'push',
      commit: 'commit01',
    })
    const again = apply(pushing.work, { type: 'delivery.stage', at: at(), stage: 'push' })
    expect(again.work).toBe(pushing.work)
    const stashing = apply(discard.work, {
      type: 'delivery.stage',
      at: at(),
      stage: 'push',
      stash: 'stash001',
    })
    expect(stashing.work.operation).toMatchObject({ stage: 'push', stash: 'stash001' })
  })

  it('앞 시도가 만든 stash와 커밋은 전달이 실패해도 결과에 남고, [다시 시도]와 [전달 없이 완료] 뒤에도 이어진다 (7-5, 7-6)', () => {
    // [변경 버리고 진행]: stash를 만든 뒤 push가 실패했다
    const first = deliver(atVerify(), 'push', 'discard').work
    const stashed = apply(first, {
      type: 'delivery.stage',
      at: at(),
      stage: 'push',
      stash: 'stash001',
    }).work
    const failed = apply(stashed, { type: 'delivery.failed', at: at(), error: 'git push 실패' })
    expect(failed.work.delivery).toMatchObject({
      status: 'failed',
      stage: 'push',
      stashes: ['stash001'],
    })
    const logged = failed.effects[0]
    expect(logged?.type === 'log' && logged.event.payload).toEqual({
      choice: 'push',
      stage: 'push',
      error: 'git push 실패',
      stashes: ['stash001'],
    })
    // [다시 시도]: 작업 트리는 이미 깨끗해 stash를 다시 만들지 않는다. 성공한 결과에 앞의 stash가 남는다
    const done = succeed(deliver(failed.work, 'push').work)
    expect(done.work.delivery).toMatchObject({ status: 'succeeded', stashes: ['stash001'] })
    expect(done.work.delivery?.commits).toBeUndefined()
    const delivered = done.effects.find(
      (e) => e.type === 'log' && e.event.type === 'delivery.succeeded',
    )
    expect(delivered?.type === 'log' && delivered.event.payload).toMatchObject({
      stashes: ['stash001'],
    })
    // 다음 시도가 [커밋하고 진행]으로 커밋을 만들고 또 실패하면 둘 다 남는다
    const second = deliver(failed.work, 'push', 'commit').work
    const committed = apply(second, {
      type: 'delivery.stage',
      at: at(),
      stage: 'push',
      commit: 'commit01',
    }).work
    const again = apply(committed, { type: 'delivery.failed', at: at(), error: 'git push 실패' })
    expect(again.work.delivery).toMatchObject({
      stashes: ['stash001'],
      commits: ['commit01'],
    })
    // [전달 없이 완료]: 실패한 결과가 그대로 남는다
    const none = approve(again.work, valid()).work
    expect(none.status).toBe('completed')
    expect(none.delivery).toMatchObject({
      status: 'failed',
      stashes: ['stash001'],
      commits: ['commit01'],
    })
  })

  it('전달이 끝나면 승인을 기록하고 Work를 완료하며 기록을 지운다 (7-6, D120)', () => {
    const started = deliver(atVerify(), 'pr').work
    const r = succeed(started, { prUrl: 'https://github.com/o/r/pull/7', draft: false })
    expect(r.rejected).toBeUndefined()
    expect(r.work.status).toBe('completed')
    expect(r.work.completed_at).toBeDefined()
    expect(r.work.operation).toBeUndefined()
    expect(currentTask(r.work)).toMatchObject({ status: 'approved', approved_by: 'human' })
    expect(r.work.delivery).toEqual({
      choice: 'pr',
      status: 'succeeded',
      at: r.work.completed_at,
      branch: BRANCH,
      compare_url: 'https://github.com/o/r/compare/main...relay%2Fw-20260926-001?expand=1',
      pr_url: 'https://github.com/o/r/pull/7',
      draft: false,
    })
    expect(types(r.effects)).toEqual([
      'log:task.approved',
      'appendDecisions',
      'log:delivery.succeeded',
      'log:work.completed',
    ])
    const [, decisions, delivered, completed] = r.effects
    expect(decisions).toMatchObject({
      type: 'appendDecisions',
      taskId: 't-04',
      node: 'verify',
      decisions: [{ what: '완료조건을 모두 통과', why: '다시 실행함', by: 'ai' }],
    })
    expect(delivered?.type === 'log' && delivered.event.payload).toEqual({
      choice: 'pr',
      branch: BRANCH,
      compare_url: 'https://github.com/o/r/compare/main...relay%2Fw-20260926-001?expand=1',
      pr_url: 'https://github.com/o/r/pull/7',
      draft: false,
    })
    expect(completed?.type === 'log' && completed.event.payload).toEqual({ delivery: 'pr' })
  })

  it('전달이 실패하면 완료하지 않는다. verify는 승인 대기로 남고 [다시 시도]와 [전달 없이 완료]를 받는다 (7-6, D120)', () => {
    const started = deliver(atVerify(), 'push').work
    const failed = apply(started, {
      type: 'delivery.failed',
      at: at(),
      error: 'git push 실패: rejected',
    })
    expect(failed.work.status).toBe('active')
    expect(failed.work.operation).toBeUndefined()
    expect(currentTask(failed.work)?.status).toBe('awaiting_approval')
    expect(failed.work.delivery).toEqual({
      choice: 'push',
      status: 'failed',
      at: failed.work.delivery?.at,
      stage: 'push',
      error: 'git push 실패: rejected',
      branch: BRANCH,
    })
    expect(types(failed.effects)).toEqual(['log:delivery.failed'])
    const logged = failed.effects[0]
    expect(logged?.type === 'log' && logged.event.payload).toEqual({
      choice: 'push',
      stage: 'push',
      error: 'git push 실패: rejected',
    })
    // [다시 시도]: 같은 전달을 다시 한다. 세션은 이미 끝났다
    const retry = deliver(failed.work, 'push')
    expect(types(retry.effects)).toEqual(['deliver'])
    expect(succeed(retry.work).work.delivery?.status).toBe('succeeded')
    // [전달 없이 완료]: [완료만]과 같다. 실패한 전달은 기록으로 남는다
    const none = approve(failed.work, valid())
    expect(none.work.status).toBe('completed')
    const last = none.effects.at(-1)
    expect(last?.type === 'log' && last.event.payload).toEqual({ delivery: 'none' })
    expect(none.work.delivery?.status).toBe('failed')
  })

  it('승인하면 멈추는 verify는 전달하지 않고 [승인하고 멈춤]으로 멈춘다. 멈춘 Work에서 전달하면 완료한다 (D119)', () => {
    const on = apply(atVerify(), { type: 'stopAfter', at: at(), on: true }).work
    expect(deliver(on, 'push').rejected).toBe('승인하면 Work가 멈춤: [승인하고 멈춤]을 누르세요')
    const back = valid({ recommended_next: { node: 'fix', reason: '완료조건 2 실패' } })
    expect(deliver(atVerify(), 'push', null, back).rejected).toBe(
      '승인하면 Work가 멈춤: [승인하고 멈춤]을 누르세요',
    )
    // [승인하고 멈춤]은 승인이다: Work가 멈추고 액션 바의 [재개]는 보이지 않는다
    const stopped = approve(on, valid()).work
    expect(stopped).toMatchObject({
      status: 'stopped',
      stop: { kind: 'after_step', task_id: 't-04' },
    })
    expect(actions(stopped)).toMatchObject({ resumeWork: false, selectStep: true, abandon: true })
    // 멈춘 Work에서 전달한다. 세션은 이미 끝났고 승인은 다시 남기지 않는다
    const r = deliver(stopped, 'push', null, null)
    expect(r.rejected).toBeUndefined()
    expect(types(r.effects)).toEqual(['deliver'])
    const done = succeed(r.work)
    expect(done.work.status).toBe('completed')
    expect(done.work.stop).toBeUndefined()
    expect(types(done.effects)).toEqual(['log:delivery.succeeded', 'log:work.completed'])
    // 멈춘 Work의 [완료만]은 M3의 [재개]다
    const resumed = apply(stopped, { type: 'resumeWork', at: at() })
    expect(resumed.work.status).toBe('completed')
  })

  it('[AI 세션 열기]는 verify 세션을 끝내고 정리 세션을 main에 맡긴다. 진행 중 작업은 기록하지 않는다 (7-5)', () => {
    const r = deliver(atVerify(), 'pr', 'session')
    expect(r.rejected).toBeUndefined()
    expect(r.work.operation).toBeUndefined()
    expect(types(r.effects)).toEqual(['endSession', 'openCleanup'])
    expect(r.effects[1]).toEqual({ type: 'openCleanup', choice: 'pr' })
    // 정리가 끝나면 다시 전달한다
    expect(deliver(r.work, 'pr').work.operation).toMatchObject({ kind: 'deliver', stage: 'push' })
  })

  it('세션 없이 대기로 남은 verify도 누른 때의 검사가 유효하면 전달하고, 표시는 승인 대기다 (3.3, D112)', () => {
    let work = newWork()
    for (const check of [valid({}, 'S'), valid(), valid()]) {
      work = approve(stop(launch(work), check).work, check).work
    }
    work = stop(launch(work), MISSING).work
    work = apply(work, { type: 'pty.exit', taskId: 't-04', at: at() }).work
    expect(status(work)).toBe('session_ended')
    const r = deliver(work, 'push')
    expect(r.rejected).toBeUndefined()
    expect(status(r.work)).toBe('awaiting_approval')
    expect(types(r.effects)).toEqual(['log:task.awaiting_approval', 'deliver'])
  })

  it('받지 않는 전달: 형식 오류, 턴이 끝나지 않음, verify가 아님, 진행 중 작업, 끝난 Work', () => {
    expect(deliver(atVerify(), 'push', null, INVALID).rejected).toBe(
      't-04의 handoff가 유효하지 않음',
    )
    let work = newWork()
    for (const check of [valid({}, 'S'), valid(), valid()]) {
      work = approve(stop(launch(work), check).work, check).work
    }
    const working = launch(work)
    expect(deliver(working, 'push').rejected).toBe('t-04는 승인할 수 있는 상태가 아님')
    const intake = stop(launch(newWork()), valid({}, 'S')).work
    expect(deliver(intake, 'push').rejected).toBe('최종 검증의 Work 완료 화면이 아님')
    const busy = deliver(atVerify(), 'push').work
    expect(deliver(busy, 'push').rejected).toBe(OPERATION_BLOCKS)
    const done = approve(atVerify(), valid()).work
    expect(done.status).toBe('completed')
    expect(deliver(done, 'push').rejected).toBe('전달할 수 있는 Work가 아님')
    // 진행 중인 전달이 없으면 결과를 받지 않는다
    expect(succeed(atVerify()).rejected).toBe('진행 중인 전달이 없음')
    const quiet = apply(atVerify(), { type: 'delivery.failed', at: at(), error: 'x' })
    expect(quiet.effects).toEqual([])
  })

  it('재시작 조정은 남은 전달 기록을 끊긴 작업으로 표시한다 (시나리오 9-4, D121)', () => {
    const delivering = deliver(atVerify(), 'push').work
    const when = at()
    const r = apply(delivering, { type: 'app.restarted', at: when, check: valid() })
    expect(r.work.operation).toEqual({ ...delivering.operation, interrupted_at: when })
    expect(r.work.tasks).toEqual(delivering.tasks)
    expect(r.effects).toEqual([])
  })
})

describe('정리 (시나리오 8, D77)', () => {
  const BACKUP = 'relay/w-20260926-001-discarded-1'

  /** [완료만]으로 완료한 S 경로 Work: intake → fix → review → verify */
  function completed(): WorkState {
    let work = newWork()
    for (const check of [valid({}, 'S'), valid(), valid(), valid()]) {
      work = approve(stop(launch(work), check).work, check).work
    }
    expect(work.status).toBe('completed')
    return work
  }

  function clean(work: WorkState, force = false, deleteBranches: string[] = [BACKUP]) {
    return apply(work, { type: 'clean', at: at(), force, deleteBranches, head: 'head0001' })
  }

  it('완료한 Work를 정리하면 진행 중 작업을 기록하고 git 작업을 main에 맡긴다', () => {
    const r = clean(completed(), true)
    expect(r.rejected).toBeUndefined()
    expect(r.work.operation).toEqual({
      kind: 'clean',
      stage: 'worktree',
      started_at: r.work.operation?.started_at,
      force: true,
      delete_branches: [BACKUP],
      head: 'head0001',
    })
    expect(r.effects).toEqual([{ type: 'clean', force: true, deleteBranches: [BACKUP] }])
    expect(actions(r.work).clean).toBe(false)
  })

  it('worktree를 지우면 브랜치 단계로 옮기고, 끝나면 보관됨으로 바꾸고 work.cleaned를 남긴다 (8-2)', () => {
    const removed = apply(clean(completed()).work, { type: 'clean.removed', at: at() })
    expect(removed.work.operation).toMatchObject({ kind: 'clean', stage: 'branches' })
    const done = apply(removed.work, { type: 'clean.done', at: at() })
    expect(done.work.status).toBe('archived')
    expect(done.work.operation).toBeUndefined()
    expect(done.work.cleaned).toEqual({
      at: done.work.cleaned?.at,
      head: 'head0001',
      forced: false,
      deleted_branches: [BACKUP],
    })
    expect(done.work.completed_at).toBeDefined()
    expect(types(done.effects)).toEqual(['log:work.cleaned'])
    const logged = done.effects[0]
    expect(logged?.type === 'log' && logged.event.payload).toEqual({
      forced: false,
      deleted_branches: [BACKUP],
    })
    // 보관된 Work는 다시 정리하지 않고 설정도 바꾸지 않는다
    expect(clean(done.work).rejected).toBe('정리할 수 있는 Work가 아님')
    expect(apply(done.work, { type: 'abandon', at: at() }).rejected).toBeDefined()
  })

  it('git이 실패하면 기록만 지우고 Work는 그대로다', () => {
    const failed = apply(clean(completed()).work, { type: 'clean.failed', at: at(), error: 'x' })
    expect(failed.work.status).toBe('completed')
    expect(failed.work.operation).toBeUndefined()
    expect(actions(failed.work).clean).toBe(true)
  })

  it('포기한 Work도 정리한다. 진행 중이거나 멈춘 Work는 정리하지 않는다', () => {
    const abandoned = apply(running(), { type: 'abandon', at: at() }).work
    expect(clean(abandoned).rejected).toBeUndefined()
    expect(clean(running()).rejected).toBe('정리할 수 있는 Work가 아님')
    const stopped = { ...running('approved'), status: 'stopped' as const }
    expect(clean(stopped).rejected).toBe('정리할 수 있는 Work가 아님')
    expect(apply(completed(), { type: 'clean.done', at: at() }).rejected).toBe(
      '진행 중인 정리가 없음',
    )
  })

  it('재시작 조정은 남은 정리 기록을 끊긴 작업으로 표시한다. 완료한 Work도 같다 (시나리오 9-4, D121)', () => {
    const cleaning = clean(completed()).work
    const when = at()
    const r = apply(cleaning, { type: 'app.restarted', at: when, check: null })
    expect(r.work.operation).toEqual({ ...cleaning.operation, interrupted_at: when })
    expect(r.work.status).toBe('completed')
  })
})

describe('끊긴 작업 (시나리오 9-4, D121~D123)', () => {
  const BACKUP = 'relay/w-20260926-001-discarded-1'

  /** S 경로로 verify까지 가서 verify 세션이 살아 있는 Work: t-01 intake, t-02 fix, t-03 review, t-04 verify */
  function toVerify(): WorkState {
    let work = newWork()
    for (const check of [valid({}, 'S'), valid(), valid()]) {
      work = approve(stop(launch(work), check).work, check).work
    }
    return launch(work)
  }

  /** 앱을 다시 켰다 */
  function restart(work: WorkState, killed?: { taskId: string; pid: number }[]): WorkState {
    return apply(work, {
      type: 'app.restarted',
      at: at(),
      check: null,
      ...(killed ? { killed } : {}),
    }).work
  }

  /** verify에서 fix로 되감다 끊긴 Work (backup 단계) */
  function rewinding(): WorkState {
    const work = toVerify()
    return apply(work, {
      type: 'selectStep',
      at: at(),
      node: 'fix',
      keepCode: false,
      instruction: '다시 고쳐 줘',
      expect: { taskId: 't-04', done: false },
      backups: [],
    }).work
  }

  /** verify의 [push]가 끊긴 Work */
  function delivering(uncommitted: 'discard' | 'commit' | null = null): WorkState {
    const verify = stop(toVerify(), valid()).work
    return apply(verify, {
      type: 'deliver',
      at: at(),
      choice: 'push',
      uncommitted,
      check: valid(),
    }).work
  }

  /** [완료만]으로 완료하고 정리하다 끊긴 Work */
  function cleaning(): WorkState {
    let work = newWork()
    for (const check of [valid({}, 'S'), valid(), valid(), valid()]) {
      work = approve(stop(launch(work), check).work, check).work
    }
    return apply(work, {
      type: 'clean',
      at: at(),
      force: false,
      deleteBranches: [BACKUP],
      head: 'head0001',
    }).work
  }

  it('끊긴 작업이 있는 동안은 [다시 시도], [무시], Work 설정만 받는다. 액션 바는 비어 있다 (D122)', () => {
    const cut = restart(rewinding())
    const verify = 't-04'
    const commands: MachineEvent[] = [
      { type: 'approve', taskId: verify, at: at(), check: valid() },
      { type: 'interrupt', taskId: verify, at: at(), reason: 'human' },
      { type: 'resume', taskId: verify, at: at() },
      { type: 'retry', taskId: verify, at: at() },
      { type: 'stopAfter', at: at(), on: true },
      { type: 'resumeWork', at: at() },
      { type: 'abandon', at: at() },
      {
        type: 'selectStep',
        at: at(),
        node: 'verify',
        keepCode: false,
        instruction: '',
        expect: { taskId: verify, done: false },
        backups: [],
      },
      { type: 'deliver', at: at(), choice: 'push', uncommitted: null, check: valid() },
      { type: 'clean', at: at(), force: false, deleteBranches: [], head: null },
    ]
    for (const c of commands) {
      const r = apply(cut, c)
      expect(r.rejected, c.type).toBe(OPERATION_BLOCKS)
      expect(r.work, c.type).toBe(cut)
    }
    expect(Object.values(actions(cut)).every((v) => !v)).toBe(true)
    const settings = apply(cut, {
      type: 'settings.update',
      at: at(),
      settings: { question_mode: { fix: 'confirm_each' } },
    })
    expect(settings.rejected).toBeUndefined()
    expect(settings.work.settings).toEqual({ question_mode: { fix: 'confirm_each' } })
  })

  it('[무시]: 되감기와 정리는 기록만 지운다. 끝낸 task는 끝난 채다 (D123)', () => {
    const cut = restart(rewinding())
    const r = apply(cut, { type: 'operationIgnore', at: at() })
    expect(r.rejected).toBeUndefined()
    expect(r.effects).toEqual([])
    expect(r.work.operation).toBeUndefined()
    // 되감으려고 끝낸 verify는 승인 대기가 아니었으니 중단됨이고, [재개]할 수 있다
    expect(currentTask(r.work)).toMatchObject({ id: 't-04', status: 'interrupted' })
    expect(actions(r.work)).toMatchObject({ resume: true, selectStep: true })

    const cleanCut = restart(cleaning())
    const c = apply(cleanCut, { type: 'operationIgnore', at: at() })
    expect(c.work.operation).toBeUndefined()
    expect(c.work.status).toBe('completed')
    expect(actions(c.work).clean).toBe(true)
  })

  it('되감기 [다시 시도]: 끊긴 표시를 지우고 끊긴 곳부터 main에 맡긴다. 결과는 보통의 되감기처럼 받는다 (D123)', () => {
    const cut = restart(rewinding())
    const op = cut.operation
    expect(op).toMatchObject({
      kind: 'rewind',
      stage: 'backup',
      interrupted_at: expect.any(String),
    })
    const r = apply(cut, { type: 'operationRetry', at: at() })
    expect(r.rejected).toBeUndefined()
    if (!op) throw new Error('기록이 없음')
    const live: Record<string, unknown> = { ...op }
    delete live['interrupted_at']
    expect(r.work.operation).toEqual(live)
    expect(r.effects).toEqual([
      {
        type: 'resumeRewind',
        operation: live,
        message: 'relay(w-20260926-001): 되감기 전 커밋 안 된 변경',
      },
    ])
    // 다시 진행 중인 작업이라 배지는 끊긴 작업이 아니다
    expect(badge(r.work).kind).not.toBe('recovery')

    // 백업 단계가 끝나면 되돌리기 전 HEAD도 적는다
    const backedUp = apply(r.work, {
      type: 'rewind.backedUp',
      at: at(),
      branch: BACKUP,
      commit: 'backup01',
      head: 'fixhead1',
    }).work
    expect(backedUp.operation).toMatchObject({
      stage: 'reset',
      backup_branch: BACKUP,
      backup_commit: 'backup01',
      head: 'fixhead1',
    })
    // 덤으로 남긴 백업은 task.rewound에 적는다
    const applied = apply(backedUp, {
      type: 'rewind.applied',
      at: at(),
      head: 'fixhead1',
      extraBackup: 'relay/w-20260926-001-discarded-2',
    })
    expect(applied.work.operation).toBeUndefined()
    const rewound = applied.effects.find((e) => e.type === 'log' && e.event.type === 'task.rewound')
    expect(rewound?.type === 'log' && rewound.event.payload).toMatchObject({
      node: 'fix',
      discarded: ['t-02', 't-03', 't-04'],
      reset_to: 'start-t-02',
      backup_branch: BACKUP,
      extra_backup_branch: 'relay/w-20260926-001-discarded-2',
    })
    expect(currentTask(applied.work)).toMatchObject({
      node: 'fix',
      reason: 'rewind',
      selection: {
        reset: {
          from: 'fixhead1',
          to: 'start-t-02',
          backup_branch: BACKUP,
          backup_commit: 'backup01',
        },
      },
    })
  })

  it('reset 단계에서 끊긴 되감기도 [다시 시도]로 이어 한다. 실패하면 M4처럼 기록을 지운다', () => {
    const backedUp = apply(rewinding(), {
      type: 'rewind.backedUp',
      at: at(),
      branch: BACKUP,
      commit: 'backup01',
      head: 'fixhead1',
    }).work
    const cut = restart(backedUp)
    const r = apply(cut, { type: 'operationRetry', at: at() })
    const [effect] = r.effects
    expect(effect?.type === 'resumeRewind' && effect.operation).toMatchObject({
      stage: 'reset',
      backup_branch: BACKUP,
      head: 'fixhead1',
    })
    const failed = apply(r.work, { type: 'rewind.failed', at: at(), error: 'git 실패' })
    expect(failed.work.operation).toBeUndefined()
    expect(currentTask(failed.work)?.status).toBe('interrupted')
  })

  it('정리 [다시 시도]: 끊긴 단계부터 main에 맡기고, 끝나면 보관됨이다 (D123)', () => {
    const cut = restart(cleaning())
    const r = apply(cut, { type: 'operationRetry', at: at() })
    expect(r.effects).toEqual([
      { type: 'clean', force: false, deleteBranches: [BACKUP], resume: 'worktree' },
    ])
    expect(r.work.operation?.interrupted_at).toBeUndefined()
    const removed = apply(r.work, { type: 'clean.removed', at: at() }).work
    // 브랜치 단계에서 또 끊기면 그 단계부터다
    const again = apply(restart(removed), { type: 'operationRetry', at: at() })
    expect(again.effects).toEqual([
      { type: 'clean', force: false, deleteBranches: [BACKUP], resume: 'branches' },
    ])
    const done = apply(again.work, { type: 'clean.done', at: at() })
    expect(done.work.status).toBe('archived')
    expect(done.work.operation).toBeUndefined()
    expect(done.work.cleaned).toMatchObject({ head: 'head0001', deleted_branches: [BACKUP] })
  })

  it('전달 [다시 시도]와 [무시]: 끊긴 시도를 실패로 남기고, 기록한 것과 찾은 stash·커밋을 결과에 더한다 (D123)', () => {
    for (const type of ['operationRetry', 'operationIgnore'] as const) {
      // push 단계로 넘어가며 stash를 적은 뒤 끊겼다
      const staged = apply(delivering('discard'), {
        type: 'delivery.stage',
        at: at(),
        stage: 'push',
        stash: 'stash001',
      }).work
      const cut = restart(staged)
      const r = apply(cut, {
        type,
        at: at(),
        found: { stashes: ['stash001', 'stash000'], commits: [] },
      })
      expect(r.rejected).toBeUndefined()
      expect(r.work.operation).toBeUndefined()
      expect(r.work.status).toBe('active')
      expect(r.work.delivery).toEqual({
        choice: 'push',
        status: 'failed',
        at: r.work.delivery?.at,
        stage: 'push',
        error: '앱이 꺼져 끊김',
        branch: 'relay/w-20260926-001',
        stashes: ['stash001', 'stash000'],
      })
      expect(types(r.effects)).toEqual(['log:delivery.failed'])
      const logged = r.effects[0]
      expect(logged?.type === 'log' && logged.event.payload).toEqual({
        choice: 'push',
        stage: 'push',
        error: '앱이 꺼져 끊김',
        reason: 'app_restart',
        stashes: ['stash001', 'stash000'],
      })
      // verify는 승인 대기로 남아 다시 전달하거나 [완료만]할 수 있다
      expect(currentTask(r.work)).toMatchObject({ id: 't-04', status: 'awaiting_approval' })
      const again = apply(r.work, {
        type: 'deliver',
        at: at(),
        choice: 'push',
        uncommitted: null,
        check: valid(),
      })
      expect(again.rejected).toBeUndefined()
      const ok = apply(again.work, {
        type: 'delivery.succeeded',
        at: at(),
        compareUrl: null,
        check: valid(),
      })
      expect(ok.work.delivery?.stashes).toEqual(['stash001', 'stash000'])
    }
  })

  it('끊긴 작업이 없으면 [다시 시도]와 [무시]를 받지 않는다. 끊기지 않은 진행 중 작업도 같다', () => {
    const plain = toVerify()
    expect(apply(plain, { type: 'operationRetry', at: at() }).rejected).toBe('끊긴 작업이 없음')
    expect(apply(plain, { type: 'operationIgnore', at: at() }).rejected).toBe('끊긴 작업이 없음')
    const live = rewinding()
    expect(apply(live, { type: 'operationRetry', at: at() }).rejected).toBe('끊긴 작업이 없음')
    expect(apply(live, { type: 'operationIgnore', at: at() }).rejected).toBe('끊긴 작업이 없음')
  })
})

describe('재시작 때의 고아 프로세스와 정리 세션 (시나리오 9-1, D76, D126)', () => {
  it('끝낸 고아 프로세스는 그 task의 조정 이벤트에 남긴다', () => {
    const work = running()
    const r = apply(work, {
      type: 'app.restarted',
      at: at(),
      check: null,
      killed: [{ taskId: 't-01', pid: 1001 }],
    })
    expect(r.effects).toEqual([
      {
        type: 'log',
        event: expect.objectContaining({
          type: 'task.interrupted',
          task_id: 't-01',
          payload: { reason: 'app_restart', killed_pid: 1001 },
        }),
      },
    ])
  })

  it('정리 세션은 살아 있는 동안 프로세스를 적고, 끝나거나 다시 켜면 지운다 (D126)', () => {
    const work = newWork()
    const started = apply(work, {
      type: 'cleanup.started',
      at: '2026-09-26T11:00:00+09:00',
      pid: 4321,
      processStartedAt: '2026-09-26T11:00:00.1234567+09:00',
    }).work
    expect(started.cleanup_process).toEqual({
      pid: 4321,
      process_started_at: '2026-09-26T11:00:00.1234567+09:00',
      started_at: '2026-09-26T11:00:00+09:00',
    })
    expect(apply(started, { type: 'cleanup.ended', at: at() }).work.cleanup_process).toBeUndefined()
    expect(apply(work, { type: 'cleanup.ended', at: at() }).work).toBe(work)
    const restarted = apply(started, { type: 'app.restarted', at: at(), check: null }).work
    expect(restarted.cleanup_process).toBeUndefined()
  })
})

describe('앱 소유 파일의 해시 (D91, D124)', () => {
  it('Work를 만들면 request.md의 해시를 적는다. 없으면 빈 기록이다', () => {
    const made = createWork({
      workId: 'w-20260926-001',
      baseBranch: 'main',
      baseCommit: 'base0001',
      requestHash: 'sha256:aa',
      at: at(),
    }).work
    expect(made.file_hashes).toEqual({ 'request.md': 'sha256:aa' })
    expect(newWork().file_hashes).toEqual({})
  })

  it('앱이 쓰거나 사람이 받아들인 해시를 적고, 없는 파일은 지운다. 같으면 그대로다', () => {
    const work = newWork()
    const r = apply(work, {
      type: 'files.recorded',
      at: at(),
      hashes: { 'decisions.md': 'sha256:d1', 'intent.md': 'sha256:i1' },
    }).work
    expect(r.file_hashes).toEqual({ 'decisions.md': 'sha256:d1', 'intent.md': 'sha256:i1' })
    const gone = apply(r, { type: 'files.recorded', at: at(), hashes: { 'intent.md': null } }).work
    expect(gone.file_hashes).toEqual({ 'decisions.md': 'sha256:d1' })
    expect(
      apply(gone, { type: 'files.recorded', at: at(), hashes: { 'decisions.md': 'sha256:d1' } })
        .work,
    ).toBe(gone)
    // M6 전에 만든 Work(기록 없음)는 처음 읽을 때 적는다
    const old = { ...work }
    delete old.file_hashes
    expect(apply(old, { type: 'files.recorded', at: at(), hashes: {} }).work.file_hashes).toEqual(
      {},
    )
  })
})

describe('자동 승인 (4.3, D127~D131)', () => {
  const AUTO: AppConfig = {
    ...DEFAULT_CONFIG,
    auto_approve: {
      investigate: false,
      evidence: true,
      rca: true,
      fix: true,
      review: true,
      respond: false,
    },
    auto_approve_countdown_sec: 15,
  }
  /** L 경로의 의도 승인(사람) 뒤 evidence 세션을 띄운 Work */
  function evidenceRunning(settings: WorkState['settings'] = {}): WorkState {
    const w = approve(stop(launch(newWork()), valid({}, 'L')).work, valid({}, 'L')).work
    return launch({ ...w, settings })
  }
  /** evidence가 Stop으로 승인 대기가 되어 카운트다운 중인 Work */
  function counting(check: TaskCheck = valid()): WorkState {
    const w = stop(evidenceRunning(), check, {}, AUTO).work
    if (!currentTask(w)?.countdown) throw new Error('카운트다운 중이 아님')
    return w
  }
  const task = (work: WorkState) => currentTask(work) as TaskRecord
  const started = (work: WorkState) => task(work).countdown?.started_at ?? ''
  const fire = (work: WorkState, check: TaskCheck | null = valid(), config = AUTO) =>
    apply(
      work,
      { type: 'autoApprove', taskId: task(work).id, at: at(), startedAt: started(work), check },
      config,
    )

  it('Stop으로 승인 대기가 되면 조건을 모두 만족할 때 카운트다운을 시작하고 타이머를 건다 (D127)', () => {
    const running = evidenceRunning()
    const r = apply(
      running,
      {
        type: 'Stop',
        taskId: 't-02',
        at: '2026-09-26T11:00:00+09:00',
        stopHookActive: false,
        handoffChanged: true,
        check: valid(),
      },
      AUTO,
    )
    expect(task(r.work)).toMatchObject({
      status: 'awaiting_approval',
      countdown: { started_at: '2026-09-26T11:00:00+09:00', seconds: 15 },
    })
    expect(task(r.work).auto_hold).toBeUndefined()
    expect(r.effects).toEqual([
      expect.objectContaining({ type: 'log' }),
      {
        type: 'startCountdown',
        taskId: 't-02',
        startedAt: '2026-09-26T11:00:00+09:00',
        seconds: 15,
      },
    ])
    // 꺼진 단계는 카운트다운하지 않고 까닭도 적지 않는다
    const manual = stop(running, valid())
    expect(task(manual.work).countdown).toBeUndefined()
    expect(task(manual.work).auto_hold).toBeUndefined()
    expect(types(manual.effects)).toEqual(['log:task.awaiting_approval'])
  })

  it('카운트다운이 끝나면 다시 판정해 자동 승인한다. 승인 방식은 자동이고 다음 단계로 간다 (4.3, 5.4, 5.5)', () => {
    const w = counting()
    const r = fire(w)
    expect(task(w).id).toBe('t-02')
    const approved = r.work.tasks.find((t) => t.id === 't-02')
    expect(approved).toMatchObject({ status: 'approved', approved_by: 'auto' })
    expect(approved?.countdown).toBeUndefined()
    expect(types(r.effects)).toEqual([
      'stopCountdown',
      'log:task.approved',
      'endSession',
      'appendDecisions',
      'startTask',
    ])
    expect(r.effects[1]).toMatchObject({ event: { payload: { by: 'auto' } } })
    expect(r.effects[3]).toMatchObject({ by: 'auto', decisions: HANDOFF.decisions })
    expect(r.effects[4]).toMatchObject({ node: 'rca' })
  })

  it('intake와 verify는 자동 승인을 켜도 카운트다운하지 않는다. 리뷰는 지적이 있으면 하지 않는다 (4.2, D213)', () => {
    const intake = stop(launch(newWork()), valid({}, 'L'), {}, AUTO)
    expect(task(intake.work).countdown).toBeUndefined()
    expect(task(intake.work).auto_hold).toBeUndefined()
    let w = approve(intake.work, valid({}, 'S')).work
    w = approve(stop(launch(w), valid(), {}, AUTO).work, valid()).work
    const review = stop(launch(w), { ...valid(), reviewFindings: true }, {}, AUTO)
    expect(task(review.work).node).toBe('review')
    expect(task(review.work).countdown).toBeUndefined()
    expect(task(review.work).auto_hold?.reasons).toEqual(['review_findings'])
    w = approve(review.work, valid()).work
    const verify = stop(launch(w), valid(), {}, AUTO)
    expect(task(verify.work).node).toBe('verify')
    expect(task(verify.work).countdown).toBeUndefined()
  })

  it('조건을 하나라도 어기면 카운트다운하지 않고 까닭을 적는다 (4.3, D129)', () => {
    const rows: [TaskCheck, boolean, AutoHoldReason][] = [
      [valid({ open_questions: ['기대 동작?'] }), false, 'open_questions'],
      [
        valid({ intent_deviation: { summary: '범위 밖', evidence: '로그' } }),
        false,
        'intent_deviation',
      ],
      [
        valid({ recommended_next: { node: 'intake', reason: '의도 다시' } }),
        false,
        'recommended_next',
      ],
      [valid(), true, 'background'],
    ]
    for (const [check, background, reason] of rows) {
      const r = apply(
        evidenceRunning(),
        {
          type: 'Stop',
          taskId: 't-02',
          at: '2026-09-26T11:00:00+09:00',
          stopHookActive: false,
          handoffChanged: true,
          check,
          background,
        },
        AUTO,
      )
      expect(task(r.work).status, reason).toBe('awaiting_approval')
      expect(task(r.work).countdown, reason).toBeUndefined()
      expect(task(r.work).auto_hold, reason).toEqual({
        at: '2026-09-26T11:00:00+09:00',
        reasons: [reason],
      })
      expect(types(r.effects), reason).not.toContain('startCountdown')
    }
    // 막힘(4.4)과 형식 오류(대기)는 승인 대기가 아니라 카운트다운도 까닭도 없다
    const blocked = stop(evidenceRunning(), BLOCKED, {}, AUTO).work
    expect(task(blocked)).toMatchObject({ status: 'blocked' })
    expect(task(blocked).countdown ?? task(blocked).auto_hold).toBeUndefined()
    const idle = stop(evidenceRunning(), INVALID, {}, AUTO).work
    expect(task(idle).countdown ?? task(idle).auto_hold).toBeUndefined()
  })

  it('[취소]하면 멈추고 사람의 승인을 기다린다. 늦게 온 타이머는 무시한다 (4.3)', () => {
    const w = counting()
    const old = started(w)
    const r = apply(
      w,
      { type: 'countdown.cancel', taskId: 't-02', at: '2026-09-26T11:00:05+09:00' },
      AUTO,
    )
    expect(task(r.work)).toMatchObject({
      status: 'awaiting_approval',
      auto_hold: { at: '2026-09-26T11:00:05+09:00', reasons: ['cancel'] },
    })
    expect(task(r.work).countdown).toBeUndefined()
    expect(r.effects).toEqual([{ type: 'stopCountdown', taskId: 't-02' }])
    const late = apply(
      r.work,
      { type: 'autoApprove', taskId: 't-02', at: at(), startedAt: old, check: valid() },
      AUTO,
    )
    expect(late.work).toBe(r.work)
    expect(late.rejected).toBeUndefined()
    // 카운트다운 중이 아니면 [취소]를 받지 않는다. 사람은 승인할 수 있다
    expect(
      apply(r.work, { type: 'countdown.cancel', taskId: 't-02', at: at() }, AUTO).rejected,
    ).toBe('t-02는 자동 승인 카운트다운 중이 아님')
    const human = approve(r.work, valid())
    expect(human.work.tasks[1]).toMatchObject({ status: 'approved', approved_by: 'human' })
    expect(human.work.tasks[1]?.auto_hold).toBeUndefined()
  })

  it('카운트다운 중에 사람이 [승인]하면 사람 승인이다', () => {
    const r = approve(counting(), valid())
    expect(r.work.tasks[1]).toMatchObject({ status: 'approved', approved_by: 'human' })
    expect(types(r.effects)[0]).toBe('stopCountdown')
    expect(r.effects[1]).toMatchObject({ event: { payload: { by: 'human' } } })
  })

  it('새 요청(UserPromptSubmit)이 오면 멈춘다. 다음 턴이 끝나면 다시 판정한다 (4.3, D131)', () => {
    const w = counting()
    const prompt = apply(w, { type: 'UserPromptSubmit', taskId: 't-02', at: at() }, AUTO)
    expect(task(prompt.work).status).toBe('working')
    expect(task(prompt.work).countdown ?? task(prompt.work).auto_hold).toBeUndefined()
    expect(prompt.effects).toEqual([{ type: 'stopCountdown', taskId: 't-02' }])
    const again = stop(prompt.work, valid(), {}, AUTO)
    expect(task(again.work).countdown?.started_at).not.toBe(started(w))
    expect(types(again.effects)).toEqual(['log:task.awaiting_approval', 'startCountdown'])
    // [취소]한 뒤에도 사람이 요청하고 턴이 끝나면 다시 판정한다
    const cancelled = apply(w, { type: 'countdown.cancel', taskId: 't-02', at: at() }, AUTO).work
    const asked = apply(cancelled, { type: 'UserPromptSubmit', taskId: 't-02', at: at() }, AUTO)
    expect(task(asked.work).auto_hold).toBeUndefined()
    expect(task(stop(asked.work, valid(), {}, AUTO).work).countdown).toBeDefined()
  })

  it('새 요청 없이 Stop이 다시 오면 새로 판정한다: 조건을 만족하면 카운트다운을 새로 시작한다 (D131)', () => {
    const w = counting()
    const again = stop(w, valid(), { active: false }, AUTO)
    expect(task(again.work).countdown?.started_at).not.toBe(started(w))
    expect(types(again.effects)).toEqual(['stopCountdown', 'startCountdown'])
    const broken = stop(w, valid({ open_questions: ['?'] }), {}, AUTO)
    expect(task(broken.work).countdown).toBeUndefined()
    expect(task(broken.work).auto_hold?.reasons).toEqual(['open_questions'])
    expect(broken.effects).toEqual([{ type: 'stopCountdown', taskId: 't-02' }])
  })

  it('[즉시 중단], 세션 종료, 조건을 어긴 감시 검사도 카운트다운을 멈춘다 (D130)', () => {
    const interrupted = apply(
      counting(),
      { type: 'interrupt', taskId: 't-02', at: at(), reason: 'human' },
      AUTO,
    )
    expect(task(interrupted.work)).toMatchObject({
      status: 'awaiting_approval',
      session: { alive: false },
      auto_hold: { reasons: ['interrupt'] },
    })
    expect(types(interrupted.effects)).toEqual([
      'stopCountdown',
      'log:task.interrupted',
      'endSession',
    ])
    for (const end of [
      { type: 'SessionEnd' as const, taskId: 't-02', at: at(), reason: 'prompt_input_exit' },
      { type: 'pty.exit' as const, taskId: 't-02', at: at() },
    ]) {
      const r = apply(counting(), end, AUTO)
      expect(task(r.work), end.type).toMatchObject({
        status: 'awaiting_approval',
        session: { alive: false },
        auto_hold: { reasons: ['session'] },
      })
      expect(r.effects, end.type).toEqual([{ type: 'stopCountdown', taskId: 't-02' }])
    }
    // /clear와 /resume은 세션 종료가 아니다 (D110)
    const clear = apply(
      counting(),
      { type: 'SessionEnd', taskId: 't-02', at: at(), reason: 'clear' },
      AUTO,
    )
    expect(task(clear.work).countdown).toBeDefined()
    // 감시로 다시 한 검사가 조건을 만족하면 그대로, 어기면 멈춘다
    const w = counting()
    const same = apply(w, { type: 'check.updated', taskId: 't-02', at: at(), check: valid() }, AUTO)
    expect(task(same.work).countdown).toEqual(task(w).countdown)
    expect(same.effects).toEqual([])
    const changed = apply(
      w,
      { type: 'check.updated', taskId: 't-02', at: at(), check: valid({ open_questions: ['?'] }) },
      AUTO,
    )
    expect(task(changed.work)).toMatchObject({
      status: 'awaiting_approval',
      auto_hold: { reasons: ['open_questions'] },
    })
    expect(task(changed.work).countdown).toBeUndefined()
    expect(changed.effects).toEqual([{ type: 'stopCountdown', taskId: 't-02' }])
  })

  it('Stop 없이 세션이 끝나 승인 대기가 되면 자동 승인을 판정하지 않는다: 턴이 끝난 것이 아니다 (D146)', () => {
    const r = apply(
      evidenceRunning(),
      { type: 'SessionEnd', taskId: 't-02', at: at(), reason: 'other', check: valid() },
      AUTO,
    )
    expect(task(r.work)).toMatchObject({ status: 'awaiting_approval', session: { alive: false } })
    expect(task(r.work).countdown ?? task(r.work).auto_hold).toBeUndefined()
    expect(types(r.effects)).toEqual(['log:task.awaiting_approval'])
  })

  it('앱 종료 확인과 [단계 선택]으로 세션을 끝내도 멈춘다. 까닭은 끝낸 까닭대로 적는다 (D130, D145)', () => {
    const quit = apply(
      counting(),
      { type: 'interrupt', taskId: 't-02', at: at(), reason: 'app_quit' },
      AUTO,
    )
    expect(task(quit.work)).toMatchObject({
      status: 'awaiting_approval',
      session: { alive: false },
      auto_hold: { reasons: ['quit'] },
    })
    expect(types(quit.effects)).toEqual(['stopCountdown', 'log:task.interrupted', 'endSession'])
    // 다시 켜도 재시작 조정은 까닭을 바꾸지 않는다: 카운트다운은 끌 때 이미 멈췄다
    const reopened = apply(quit.work, { type: 'app.restarted', at: at(), check: valid() }, AUTO)
    expect(task(reopened.work).auto_hold?.reasons).toEqual(['quit'])
    // 코드를 되돌리는 [단계 선택]은 git이 실패하면 끝낸 task가 승인 대기로 남는다 (6.2)
    const selected = apply(
      counting(),
      {
        type: 'selectStep',
        at: at(),
        node: 'evidence',
        keepCode: false,
        instruction: '',
        expect: { taskId: 't-02', done: false },
        backups: [],
      },
      AUTO,
    )
    expect(selected.rejected).toBeUndefined()
    expect(types(selected.effects)).toEqual([
      'stopCountdown',
      'log:task.interrupted',
      'endSession',
      'rewindCode',
    ])
    const failed = apply(selected.work, { type: 'rewind.failed', at: at(), error: 'index.lock' })
    expect(task(failed.work)).toMatchObject({
      status: 'awaiting_approval',
      session: { alive: false },
      auto_hold: { reasons: ['step'] },
    })
  })

  it('끝날 때 다시 판정한다: 설정을 껐거나 handoff가 바뀌었으면 승인하지 않는다 (D128, D130)', () => {
    const off = fire(counting(), valid(), DEFAULT_CONFIG)
    expect(task(off.work)).toMatchObject({
      status: 'awaiting_approval',
      auto_hold: { reasons: ['settings'] },
    })
    expect(types(off.effects)).toEqual(['stopCountdown'])
    const changed = fire(counting(), valid({ intent_deviation: { summary: 's', evidence: 'e' } }))
    expect(task(changed.work).auto_hold?.reasons).toEqual(['intent_deviation'])
    expect(task(changed.work).status).toBe('awaiting_approval')
    const unreadable = fire(counting(), null)
    expect(task(unreadable.work).auto_hold?.reasons).toEqual(['invalid'])
    const invalid = fire(counting(), { ...valid(), errors: [ERROR] })
    expect(task(invalid.work).auto_hold?.reasons).toEqual(['invalid'])
    expect(task(invalid.work).check?.errors).toEqual([ERROR])
  })

  it('판정은 턴이 끝날 때의 설정을 쓴다. 카운트다운 중에 끄면 바로 멈추고, 이미 승인 대기면 켜도 시작하지 않는다 (D73, D128)', () => {
    // 앱 설정을 끈다
    const off = apply(counting(), { type: 'config.updated', at: at() }, DEFAULT_CONFIG)
    expect(task(off.work)).toMatchObject({ auto_hold: { reasons: ['settings'] } })
    expect(off.effects).toEqual([{ type: 'stopCountdown', taskId: 't-02' }])
    // 다른 단계를 끄면 그대로다
    const rcaOff = { ...AUTO, auto_approve: { ...AUTO.auto_approve, rca: false } }
    const other = apply(counting(), { type: 'config.updated', at: at() }, rcaOff)
    expect(task(other.work).countdown).toBeDefined()
    expect(other.effects).toEqual([])
    // Work 설정으로 끈다 (D72)
    const work = apply(
      counting(),
      { type: 'settings.update', at: at(), settings: { auto_approve: { evidence: false } } },
      AUTO,
    )
    expect(work.work.settings).toEqual({ auto_approve: { evidence: false } })
    expect(task(work.work).auto_hold?.reasons).toEqual(['settings'])
    // 이미 승인 대기인 task는 켜도 카운트다운하지 않는다(다음 Stop부터)
    const waiting = stop(evidenceRunning(), valid()).work
    const on = apply(waiting, { type: 'config.updated', at: at() }, AUTO)
    expect(on.work).toBe(waiting)
    // task를 시작한 뒤 켜도 턴이 끝날 때의 설정을 쓴다
    const later = stop(evidenceRunning(), valid(), {}, AUTO)
    expect(task(later.work).countdown).toBeDefined()
  })

  it('Work 설정이 앱 설정보다 우선한다 (D72)', () => {
    const manualWork = stop(
      evidenceRunning({ auto_approve: { evidence: false } }),
      valid(),
      {},
      AUTO,
    )
    expect(task(manualWork.work).countdown ?? task(manualWork.work).auto_hold).toBeUndefined()
    const autoWork = stop(evidenceRunning({ auto_approve: { evidence: true } }), valid())
    expect(task(autoWork.work).countdown?.seconds).toBe(DEFAULT_CONFIG.auto_approve_countdown_sec)
  })

  it('재시작 조정은 카운트다운을 지우고 자동 승인하지 않는다. 다음 턴이 끝나면 다시 판정한다 (D75, D127, D131)', () => {
    const w = counting()
    const old = started(w)
    const r = apply(
      w,
      { type: 'app.restarted', at: '2026-09-26T13:00:00+09:00', check: valid() },
      AUTO,
    )
    expect(task(r.work)).toMatchObject({
      status: 'awaiting_approval',
      session: { alive: false },
      auto_hold: { at: '2026-09-26T13:00:00+09:00', reasons: ['restart'] },
    })
    expect(task(r.work).countdown).toBeUndefined()
    // 이미 승인 대기였으니 조정 이벤트는 없다. 타이머는 없지만 푸는 할 일은 해가 없다
    expect(types(r.effects)).toEqual(['stopCountdown'])
    const late = apply(
      r.work,
      { type: 'autoApprove', taskId: 't-02', at: at(), startedAt: old, check: valid() },
      AUTO,
    )
    expect(late.work).toBe(r.work)
    // 작업 중이던 task가 유효한 handoff로 승인 대기가 되어도 자동 승인하지 않는다
    const working = apply(
      evidenceRunning(),
      { type: 'app.restarted', at: '2026-09-26T13:00:00+09:00', check: valid() },
      AUTO,
    )
    expect(task(working.work)).toMatchObject({
      status: 'awaiting_approval',
      auto_hold: { reasons: ['restart'] },
    })
    // [세션 재개]로 다시 연 세션에서 사람이 요청하고 턴이 끝나면 다시 판정한다
    const resumed = apply(
      r.work,
      {
        type: 'session.resumed',
        taskId: 't-02',
        at: at(),
        pid: 3000,
        claudeVersion: 'v',
        check: valid(),
      },
      AUTO,
    ).work
    expect(task(resumed)).toMatchObject({
      status: 'awaiting_approval',
      auto_hold: { reasons: ['restart'] },
    })
    const prompt = apply(resumed, { type: 'UserPromptSubmit', taskId: 't-02', at: at() }, AUTO).work
    expect(task(stop(prompt, valid(), {}, AUTO).work).countdown).toBeDefined()
  })

  it('끊긴 작업의 기록이 있으면 자동 승인하지 않는다. [취소]도 받지 않는다 (D122)', () => {
    const w = counting()
    const cut: WorkState = {
      ...w,
      operation: {
        kind: 'clean',
        stage: 'worktree',
        started_at: at(),
        force: false,
        delete_branches: [],
        head: null,
        interrupted_at: at(),
      },
    }
    const r = fire(cut)
    expect(task(r.work)).toMatchObject({
      status: 'awaiting_approval',
      auto_hold: { reasons: ['operation'] },
    })
    expect(types(r.effects)).toEqual(['stopCountdown'])
    const cancel = apply(cut, { type: 'countdown.cancel', taskId: 't-02', at: at() }, AUTO)
    expect(cancel.rejected).toBe(OPERATION_BLOCKS)
  })

  it('[이 단계 끝나면 멈춤]이 켜져 있으면 자동 승인하고 멈춘다 (시나리오 3-4)', () => {
    const w = { ...counting(), stop_after_step: true }
    const r = fire(w)
    expect(r.work).toMatchObject({
      status: 'stopped',
      stop: { kind: 'after_step', task_id: 't-02' },
    })
    expect(r.work.tasks[1]).toMatchObject({ status: 'approved', approved_by: 'auto' })
    expect(types(r.effects)).not.toContain('startTask')
  })

  it('단계 선택과 포기는 카운트다운을 지운다 (6.2, 3.3)', () => {
    const abandoned = apply(counting(), { type: 'abandon', at: at() }, AUTO)
    expect(task(abandoned.work)).toMatchObject({ status: 'interrupted' })
    expect(task(abandoned.work).countdown ?? task(abandoned.work).auto_hold).toBeUndefined()
    expect(types(abandoned.effects)[0]).toBe('stopCountdown')
    const w = counting()
    const skipped = apply(
      w,
      {
        type: 'selectStep',
        at: at(),
        node: 'fix',
        keepCode: false,
        instruction: '',
        expect: { taskId: 't-02', done: false },
        backups: [],
      },
      AUTO,
    )
    expect(skipped.rejected).toBeUndefined()
    const t2 = skipped.work.tasks.find((t) => t.id === 't-02')
    expect(t2?.status).toBe('discarded')
    expect(t2?.countdown ?? t2?.auto_hold).toBeUndefined()
    expect(types(skipped.effects)[0]).toBe('stopCountdown')
  })
})

describe('PR 진행 (시나리오 10, D152~D200)', () => {
  const PR_URL = 'https://github.com/o/r/pull/7'
  const HEAD = 'head0001'
  const OPEN = { enabled: true, reasons: [] }

  /** S 경로로 verify가 승인 대기인 Work에서 [PR 생성]이 성공해 PR 진행이 된 Work */
  function inPr(): WorkState {
    let work = newWork()
    for (const check of [valid({}, 'S'), valid(), valid()]) {
      work = approve(stop(launch(work), check).work, check).work
    }
    work = stop(launch(work), valid()).work
    work = apply(work, {
      type: 'deliver',
      at: at(),
      choice: 'pr',
      uncommitted: null,
      check: valid(),
    }).work
    return apply(work, {
      type: 'delivery.succeeded',
      at: at(),
      compareUrl: null,
      prUrl: PR_URL,
      draft: false,
      pr: { number: 7, head: HEAD, ghVersion: '2.101.0' },
      check: valid(),
    }).work
  }

  const readPr = (work: WorkState, o: Partial<Extract<MachineEvent, { type: 'pr.read' }>> = {}) =>
    apply(work, {
      type: 'pr.read',
      at: at(),
      number: 7,
      state: 'OPEN',
      head: HEAD,
      received: [],
      notAccepted: [],
      ...o,
    })

  it('[PR 생성]이 성공하면 완료 대신 PR 진행이다. 번호, 주소, head, gh 버전을 적는다 (D152, D191, D198)', () => {
    const work = inPr()
    expect(work.status).toBe('pr')
    expect(work.completed_at).toBeUndefined()
    expect(work.operation).toBeUndefined()
    expect(work.pr).toEqual({
      number: 7,
      url: PR_URL,
      head: HEAD,
      gh_version: '2.101.0',
      started_at: work.delivery?.at,
    })
    expect(currentTask(work)).toMatchObject({ status: 'approved', session: { alive: false } })
    // PR 진행 중에는 [단계 선택], [이 단계 끝나면 멈춤], [Work 포기], [Work 정리]가 없다 (D182)
    expect(actions(work)).toEqual({
      interrupt: false,
      resume: false,
      retry: false,
      resumeWork: false,
      selectStep: false,
      stopAfter: false,
      abandon: false,
      clean: false,
    })
    expect(badge(work)).toMatchObject({ kind: 'pr_waiting', hot: false })
    expect(badge(work, 'pr_items')).toMatchObject({
      kind: 'pr_items',
      label: '대응 거리 있음',
      hot: true,
    })
    expect(badge(work, 'mergeable')).toMatchObject({ label: '머지 가능', hot: true })
    // PR 진행에서는 다른 사람 명령을 받지 않는다
    expect(apply(work, { type: 'abandon', at: at() }).rejected).toBeDefined()
  })

  it('읽으면 head와 읽은 때를 적고, 받은 항목과 받은 원격 커밋을 기록한다. 기준 브랜치 병합이 있으면 기준 커밋을 옮긴다 (D181, D191, D193)', () => {
    const r = readPr(inPr(), {
      head: 'head0002',
      received: ['convo:1'],
      notAccepted: ['convo:2'],
      synced: { commits: ['head0002', 'base0002'], baseCommit: 'base0002' },
    })
    expect(r.work.pr).toMatchObject({ head: 'head0002', read_at: expect.any(String) })
    expect(r.work.base_commit).toBe('base0002')
    expect(
      r.effects.map((e) => (e.type === 'log' ? [e.event.type, e.event.payload] : e.type)),
    ).toEqual([
      ['pr.synced', { commits: ['head0002', 'base0002'], base_commit: 'base0002' }],
      ['pr.items_received', { items: ['convo:1'], not_accepted: ['convo:2'] }],
    ])
    // 받은 것이 없으면 기록하지 않는다
    expect(readPr(inPr()).effects).toEqual([])
  })

  it('밖에서 머지된 것을 읽으면 완료(머지됨, outside)다 (D179)', () => {
    const r = readPr(inPr(), { state: 'MERGED', head: 'head0003' })
    expect(r.work.status).toBe('completed')
    expect(r.work.completed_at).toBeDefined()
    expect(r.work.pr?.merged).toEqual({
      at: r.work.completed_at,
      head: 'head0003',
      method: null,
      outside: true,
    })
    expect(types(r.effects)).toEqual(['log:pr.merged', 'log:work.completed'])
    expect(actions(r.work).clean).toBe(true)
  })

  it('닫힘을 읽으면 한 번 기록하고, 다시 열린 것을 읽으면 되돌린다 (D179)', () => {
    const closed = readPr(inPr(), { state: 'CLOSED' })
    expect(closed.work.status).toBe('pr')
    expect(closed.work.pr?.closed_at).toBeDefined()
    expect(types(closed.effects)).toEqual(['log:pr.closed'])
    expect(readPr(closed.work, { state: 'CLOSED' }).effects).toEqual([])
    const reopened = readPr(closed.work)
    expect(reopened.work.pr?.closed_at).toBeUndefined()
    expect(types(reopened.effects)).toEqual(['log:pr.reopened'])
  })

  it('다른 PR의 읽기나 진행 중 작업이 있을 때의 읽기는 반영하지 않는다', () => {
    const work = inPr()
    expect(readPr(work, { number: 8, head: 'x' }).work).toBe(work)
    const merging = apply(work, {
      type: 'pr.merge',
      at: at(),
      method: 'squash',
      head: HEAD,
      gate: OPEN,
    }).work
    expect(readPr(merging, { state: 'MERGED' }).work).toBe(merging)
  })

  it('[머지]는 머지 창의 head가 마지막으로 읽은 head이고 조건을 만족할 때만 받는다. 진행 중 작업으로 기록한다 (D77, D176)', () => {
    const work = inPr()
    expect(
      apply(work, { type: 'pr.merge', at: at(), method: 'squash', head: 'other', gate: OPEN })
        .rejected,
    ).toBe('머지 창을 연 뒤 PR의 새 head를 읽었음. 머지 창을 다시 여세요')
    expect(
      apply(work, {
        type: 'pr.merge',
        at: at(),
        method: 'squash',
        head: HEAD,
        gate: { enabled: false, reasons: ['CI 실패', '기준 브랜치와 충돌'] },
      }).rejected,
    ).toBe('머지할 수 없음: CI 실패, 기준 브랜치와 충돌')
    const r = apply(work, { type: 'pr.merge', at: at(), method: 'squash', head: HEAD, gate: OPEN })
    expect(r.work.operation).toEqual({
      kind: 'merge',
      started_at: expect.any(String),
      method: 'squash',
      head: HEAD,
    })
    expect(r.effects).toEqual([{ type: 'merge', method: 'squash', head: HEAD }])
    expect(badge(r.work).kind).toBe('pr_waiting')
    // 머지가 끝나면 완료(머지됨)다 (D178)
    const done = apply(r.work, { type: 'pr.merged', at: at() })
    expect(done.work).toMatchObject({
      status: 'completed',
      pr: { merged: { head: HEAD, method: 'squash', outside: false } },
    })
    expect(done.work.operation).toBeUndefined()
    expect(
      done.effects.map((e) => (e.type === 'log' ? [e.event.type, e.event.payload] : e.type)),
    ).toEqual([
      ['pr.merged', { method: 'squash', head: HEAD, outside: false }],
      ['work.completed', { delivery: 'pr', merged: true }],
    ])
    // 실패하면 기록만 지우고 PR 진행에 남는다
    const failed = apply(r.work, {
      type: 'pr.mergeFailed',
      at: at(),
      error: 'Head branch was modified',
    })
    expect(failed.work.status).toBe('pr')
    expect(failed.work.operation).toBeUndefined()
  })

  it('끊긴 머지의 [다시 시도]는 이어서 머지하고, [무시]는 기록만 지운다 (D123)', () => {
    const merging = apply(inPr(), {
      type: 'pr.merge',
      at: at(),
      method: 'rebase',
      head: HEAD,
      gate: OPEN,
    }).work
    const restarted = apply(merging, { type: 'app.restarted', at: at(), check: null }).work
    expect(restarted.operation).toMatchObject({ kind: 'merge', interrupted_at: expect.any(String) })
    expect(badge(restarted).kind).toBe('recovery')
    const retried = apply(restarted, { type: 'operationRetry', at: at() })
    expect(retried.effects).toEqual([{ type: 'merge', method: 'rebase', head: HEAD, resume: true }])
    const ignored = apply(restarted, { type: 'operationIgnore', at: at() })
    expect(ignored.work.operation).toBeUndefined()
    expect(ignored.work.status).toBe('pr')
  })

  it('[머지 없이 끝내기]는 완료(머지 없이)다. 머지 뒤 정리 창을 연 것을 적는다 (D178, D179, D200)', () => {
    const ended = apply(inPr(), { type: 'pr.end', at: at() })
    expect(ended.work.status).toBe('completed')
    expect(ended.work.pr?.ended_at).toBeDefined()
    expect(
      ended.effects.map((e) => (e.type === 'log' ? [e.event.type, e.event.payload] : e.type)),
    ).toEqual([['work.completed', { delivery: 'pr', merged: false }]])
    const merged = readPr(inPr(), { state: 'MERGED' }).work
    const offered = apply(merged, { type: 'pr.cleanOffered', at: at() })
    expect(offered.work.pr?.clean_offered_at).toBeDefined()
    expect(apply(inPr(), { type: 'pr.end', at: at() }).work.status).toBe('completed')
    expect(apply(newWork(), { type: 'pr.end', at: at() }).rejected).toBe('PR 진행인 Work가 아님')
  })

  it('머지로 완료한 Work의 정리는 origin의 작업 브랜치를 지우는 단계를 더 기록한다 (D77, D178)', () => {
    const merged = readPr(inPr(), { state: 'MERGED' }).work
    const cleaning = apply(merged, {
      type: 'clean',
      at: at(),
      force: false,
      deleteBranches: ['relay/w-20260926-001'],
      deleteRemote: 'relay/w-20260926-001',
      head: HEAD,
    })
    expect(cleaning.work.operation).toMatchObject({
      stage: 'worktree',
      delete_remote: 'relay/w-20260926-001',
    })
    expect(cleaning.effects[0]).toMatchObject({
      type: 'clean',
      deleteRemote: 'relay/w-20260926-001',
    })
    const removed = apply(cleaning.work, { type: 'clean.removed', at: at() }).work
    const branches = apply(removed, { type: 'clean.branchesDeleted', at: at() }).work
    expect(branches.operation).toMatchObject({ stage: 'remote' })
    const done = apply(branches, { type: 'clean.done', at: at() })
    expect(done.work.status).toBe('archived')
    expect(done.work.cleaned).toMatchObject({
      deleted_branches: ['relay/w-20260926-001'],
      deleted_remote_branch: 'relay/w-20260926-001',
    })
  })
})
