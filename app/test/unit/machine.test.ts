import { describe, expect, it } from 'vitest'
import {
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
    ['SessionEnd', 'working', { type: 'SessionEnd', taskId: T, at: 'x' }, 'session_ended'],
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
    expect(r.work.stop?.node).toBe('rca')
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
  it('승인 대기가 아니면 승인하지 않는다', () => {
    const work = running('idle')
    const r = approve(work, valid({}, 'M'))
    expect(r.rejected).toMatch(/승인 대기가 아님/)
    expect(r.work).toBe(work)
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
