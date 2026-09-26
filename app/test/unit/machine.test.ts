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
import type { TaskCheck } from '../../src/core/validate'
import { DEFAULT_CONFIG, type AppConfig } from '../../src/shared/config'
import type { Handoff, NodeName, Size } from '../../src/shared/contracts'
import type { FormatIssue, TaskStatus, WorkState } from '../../src/shared/work'

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

function apply(work: WorkState, event: MachineEvent, config: AppConfig = DEFAULT_CONFIG) {
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

  it('M 경로: intake → evidence → rca → fix → verify → Work 완료', () => {
    let work = newWork()
    const nodes: NodeName[] = []
    const all: Effect[] = []
    let r = stepApprove(work, valid({}, 'M'))
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
      ['t-05', 'verify', 'approved'],
    ])
    expect(work.status).toBe('completed')
    expect(work.completed_at).toBeDefined()
    expect(work.intent).toEqual({ version: 1, size: 'M' })
    expect(
      all.filter((e) => e.type === 'startTask').map((e) => e.type === 'startTask' && e.node),
    ).toEqual(['evidence', 'rca', 'fix', 'verify'])
    expect(types(all).at(-1)).toBe('log:work.completed')
  })

  it('S 경로: intake → fix → verify → Work 완료 (3.4)', () => {
    let r = stepApprove(newWork(), valid({}, 'S'))
    expect(r.work.intent).toEqual({ version: 1, size: 'S' })
    expect(currentTask(r.work)?.node).toBe('fix')
    r = stepApprove(r.work, valid())
    expect(currentTask(r.work)?.node).toBe('verify')
    r = stepApprove(r.work, valid())
    expect(r.work.status).toBe('completed')
    expect(r.work.tasks.map((t) => t.node)).toEqual(['intake', 'fix', 'verify'])
  })

  it('의도 승인: 승인을 기록하고, 세션을 끝내고, 결정을 더하고, intent를 확정하고, 다음 task를 시작한다', () => {
    const ready = stop(launch(newWork()), valid({}, 'M')).work
    const r = apply(ready, {
      type: 'approve',
      taskId: 't-01',
      at: '2026-09-26T12:00:00+09:00',
      check: valid({}, 'M'),
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
      { type: 'confirmIntent', taskId: 't-01', version: 1, size: 'M' },
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
    const r = stepApprove(newWork(), valid({}, 'M'), 'S')
    expect(r.work.intent).toEqual({ version: 1, size: 'S' })
    expect(currentTask(r.work)?.node).toBe('fix')
  })

  it('verify 승인은 [완료만]으로 Work를 완료한다 (시나리오 7, I22)', () => {
    let work = stepApprove(newWork(), valid({}, 'S')).work
    work = stepApprove(work, valid()).work
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
    const ready = stop(launch(newWork()), valid({}, 'M')).work
    const ended = apply(ready, { type: 'pty.exit', taskId: 't-01', at: at() }).work
    const r = approve(ended, valid({}, 'M'))
    expect(r.rejected).toBeUndefined()
    expect(types(r.effects)).not.toContain('endSession')
  })
})

describe('이전 단계 추천에서 멈춤 (D23)', () => {
  function toVerify(): WorkState {
    let work = newWork()
    for (const check of [valid({}, 'S'), valid()]) {
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
      task_id: 't-03',
      node: 'fix',
      reason: '완료조건 2 실패',
    })
    expect(types(r.effects)).toEqual(['log:task.approved', 'endSession', 'appendDecisions'])
    expect(r.work.tasks).toHaveLength(3)
  })

  it('S 경로의 fix가 건너뛴 rca를 추천해도 멈춘다 (D66)', () => {
    let work = newWork()
    work = approve(stop(launch(work), valid({}, 'S')).work, valid({}, 'S')).work
    const rec = valid({ recommended_next: { node: 'rca', reason: '원인을 좁히지 못함' } })
    const r = approve(stop(launch(work), rec).work, rec)
    expect(r.work.status).toBe('stopped')
    expect(r.work.stop).toMatchObject({ kind: 'recommended_back', node: 'rca' })
  })

  it('기본 다음 단계를 추천하면 그대로 진행한다', () => {
    let work = newWork()
    work = approve(stop(launch(work), valid({}, 'M')).work, valid({}, 'M')).work
    const rec = valid({ recommended_next: { node: 'rca', reason: '다음은 원인 분석' } })
    const r = approve(stop(launch(work), rec).work, rec)
    expect(r.work.status).toBe('active')
    expect(currentTask(r.work)?.node).toBe('rca')
  })

  it('멈춘 Work에는 늦은 신호가 와도 바뀌지 않는다', () => {
    const rec = valid({ recommended_next: { node: 'fix', reason: '실패' } })
    const stopped = approve(stop(toVerify(), rec).work, rec).work
    const r = apply(stopped, { type: 'pty.exit', taskId: 't-03', at: at() })
    expect(r.work).toBe(stopped)
  })
})

describe('받지 않는 승인', () => {
  it('에이전트가 턴을 도는 중이거나 막힘이면 승인하지 않는다 (D112)', () => {
    for (const s of ['working', 'asking', 'input_needed', 'blocked'] as const) {
      const work = running(s)
      const r = approve(work, valid({}, 'M'))
      expect(r.rejected).toMatch(/승인할 수 있는 상태가 아님/)
      expect(r.work).toBe(work)
    }
  })

  it('누른 때 다시 한 검사가 유효하지 않으면 승인하지 않고 오류를 보인다 (4.1)', () => {
    const ready = stop(launch(newWork()), valid({}, 'M')).work
    const r = approve(ready, INVALID)
    expect(r.rejected).toMatch(/유효하지 않음/)
    expect(r.effects).toEqual([])
    expect(currentTask(r.work)).toMatchObject({
      status: 'awaiting_approval',
      check: { errors: [ERROR] },
    })
  })

  it('지금 task가 아니면 승인하지 않는다', () => {
    const r = stop(launch(newWork()), valid({}, 'M'))
    const next = approve(r.work, valid({}, 'M')).work
    const again = apply(next, { type: 'approve', taskId: 't-01', at: at(), check: valid({}, 'M') })
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
    const ready = stop(launch(newWork()), valid({}, 'M')).work
    return launch(approve(ready, valid({}, 'M')).work)
  }

  it('대기에서도 누른 때의 검사가 유효하면 승인한다', () => {
    const work = idleWith(withErrors([BODY], 'M'))
    const r = approve(work, valid({}, 'M'))
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
    const check = withErrors([BODY, DRAFT_BODY], 'M')
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
    const check = withErrors([BODY], 'M')
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
    expect(forceApprove(idleWith(check), check, 'M').rejected).toBeUndefined()
  })

  it('status가 blocked로 읽히면 [오류 무시하고 승인]을 받지 않는다 (4.4)', () => {
    const check: TaskCheck = { ...withErrors([BODY], 'M'), status: 'blocked' }
    const r = forceApprove(idleWith(check), check)
    expect(r.rejected).toMatch(/오류를 무시하고 승인할 수 없음/)
  })

  it('누른 때 오류가 없으면 [오류 무시하고 승인]도 보통 승인이다', () => {
    const work = idleWith(withErrors([BODY], 'M'))
    const r = forceApprove(work, valid({}, 'M'))
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
  const ready = stop(launch(newWork()), valid({}, 'M')).work
  return launch(approve(ready, valid({}, 'M')).work)
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
    const ended = interrupt(stop(launch(newWork()), valid({}, 'M')).work).work
    const r = approve(ended, valid({}, 'M'))
    expect(r.rejected).toBeUndefined()
    expect(types(r.effects)).not.toContain('endSession')
  })

  it('앱 종료 확인도 같은 전이이고 이유를 남긴다 (시나리오 3-6)', () => {
    const r = interrupt(running('working'), 'app_quit')
    expect(r.effects[0]).toMatchObject({ event: { payload: { reason: 'app_quit' } } })
  })

  it('대기열에서 뺀 task에 유효한 handoff가 있으면 승인 대기로 남는다 (3.3)', () => {
    const ended = apply(stop(launch(newWork()), valid({}, 'M')).work, {
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
      check: valid({}, 'M'),
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
    expect(status(stop(r.work, valid({}, 'M')).work)).toBe('awaiting_approval')
  })

  it('다시 연 때 유효한 handoff가 있으면 승인 대기나 막힘이다 (3.3)', () => {
    const r = resumed(resume(interrupted()).work, valid({}, 'M'))
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
    const ended = apply(stop(launch(newWork()), valid({}, 'M')).work, {
      type: 'pty.exit',
      taskId: 't-01',
      at: at(),
    }).work
    const r = resumed(resume(ended).work, valid({}, 'M'))
    expect(status(r.work)).toBe('awaiting_approval')
    expect(types(r.effects)).toEqual(['log:task.resumed'])
  })

  it('세션 없는 승인 대기를 다시 열지 못하면 유효한 handoff로 승인 대기에 남는다 (3.3)', () => {
    const ended = apply(stop(launch(newWork()), valid({}, 'M')).work, {
      type: 'pty.exit',
      taskId: 't-01',
      at: at(),
    }).work
    const r = apply(resume(ended).work, {
      type: 'session.failed',
      taskId: 't-01',
      at: at(),
      error: 'claude 없음',
      check: valid({}, 'M'),
    })
    expect(currentTask(r.work)).toMatchObject({ status: 'awaiting_approval', error: 'claude 없음' })
    expect(approve(r.work, valid({}, 'M')).rejected).toBeUndefined()
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
    for (const check of [valid({}, 'S'), valid()]) {
      work = approve(stop(launch(work), check).work, check).work
    }
    const on = stopAfter(launch(work), true).work
    expect(currentTask(on)?.node).toBe('verify')
    const r = approve(stop(on, valid()).work, valid())
    expect(r.work).toMatchObject({
      status: 'stopped',
      stop: { kind: 'after_step', task_id: 't-03' },
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
    for (const check of [valid({}, 'S'), valid()]) {
      work = approve(stop(launch(work), check).work, check).work
    }
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
    expect(approve(r.work, valid({}, 'M')).rejected).toMatch(/진행 중인 Work가 아님/)
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
    const r = restart(running('working'), valid({}, 'M'))
    expect(currentTask(r.work)).toMatchObject({
      status: 'awaiting_approval',
      session: { alive: false },
      check: { handoff_present: true, errors: [] },
    })
    expect(types(r.effects)).toEqual(['log:task.awaiting_approval'])
    expect(r.effects[0]).toMatchObject({ event: { payload: { reason: 'app_restart' } } })
    expect(status(restart(running('working'), BLOCKED).work)).toBe('blocked')
    // 이미 승인 대기였으면 기록을 더하지 않는다
    const kept = restart(running('awaiting_approval'), valid({}, 'M'))
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
    const ended = apply(stop(launch(newWork()), valid({}, 'M')).work, {
      type: 'pty.exit',
      taskId: 't-01',
      at: at(),
    }).work
    const q = apply(ended, { type: 'task.queued', taskId: 't-01', at: at() }).work
    const r = restart(q, valid({}, 'M'))
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
    const done = { ...running('approved'), status: 'completed' as const }
    expect(Object.values(actions(done)).every((v) => !v)).toBe(true)
  })
})
