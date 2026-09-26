// Work와 Task의 상태 전이 (3.3, 시나리오 2~5). (상태, 이벤트) → (새 상태, 할 일)인 순수 함수다 (I10).
// 훅 신호, 사람 버튼, 프로세스 종료를 main이 이벤트로 바꿔 넣고, 돌려받은 할 일을 차례로 실행한다.
// 상태는 work.json이고 main이 전이마다 쓴다 (I11). 설정은 판정하는 때의 값을 받는다 (D73).
// 기본 흐름과 [오류 무시하고 승인](D112)을 담는다. 중단, 재개, 대기열, 되감기, 자동 승인은 해당 마일스톤에서 더한다.
import type { AppConfig, WorkSettings } from '../shared/config'
import type { Decision, NodeName, Size } from '../shared/contracts'
import type {
  CheckSummary,
  LifecycleEvent,
  StartReason,
  TaskRecord,
  TaskStatus,
  WorkState,
} from '../shared/work'
import { REVIEWABLE, approvalGate } from './approval'
import { NODES, WORK_COMPLETE, defaultNext, isPrevious } from './pipeline'
import { FORMAT_VERSION, bounceMessage, isValid, summarize, type TaskCheck } from './validate'

// ---------- 이벤트와 할 일 ----------

interface TaskEvent {
  taskId: string
  /** 일어난 때 (ISO 8601). 기록에 그대로 쓴다 */
  at: string
}

/**
 * main이 task를 띄운 직후 알린다 (시나리오 2). 첫 훅보다 먼저 와야 한다.
 * 띄우기 전에 정한 값(시작 커밋, 스킬 해시, claude 버전)과 띄운 프로세스를 담는다.
 */
export interface SessionStarted extends TaskEvent {
  type: 'session.started'
  sessionId: string
  pid: number
  processStartedAt?: string
  startCommit: string
  skillHash: string
  claudeVersion: string
}

/** task를 띄우지 못했다 */
export interface SessionFailed extends TaskEvent {
  type: 'session.failed'
  error: string
}

/** 훅 신호 (시나리오 3). type은 Claude Code의 훅 이벤트 이름이다 */
export interface UserPromptSubmitted extends TaskEvent {
  type: 'UserPromptSubmit'
  /** 본문의 permission_mode (D94) */
  permissionMode?: string
}

export interface ToolUse extends TaskEvent {
  type: 'PreToolUse' | 'PostToolUse'
  toolName: string
}

export interface NotificationSent extends TaskEvent {
  type: 'Notification'
  notificationType?: string
}

export interface Stopped extends TaskEvent {
  type: 'Stop'
  /** 본문의 stop_hook_active. 되돌림에 이어진 Stop이면 true다 (S2, D107) */
  stopHookActive: boolean
  /** 이번 턴에 handoff.md(intake는 intent 초안도)가 바뀌었는가. main이 턴 시작 때와 비교해 정한다 */
  handoffChanged: boolean
  /** Stop을 받고 main이 다시 한 형식 검사 (I15) */
  check: CheckSummary
}

/** SessionEnd 훅 */
export interface SessionEndHook extends TaskEvent {
  type: 'SessionEnd'
  /** 본문의 reason: clear | resume | logout | prompt_input_exit | other (Claude Code 문서 hooks) */
  reason?: string
}

/** PTY 종료 */
export interface PtyExited extends TaskEvent {
  type: 'pty.exit'
}

export type SessionEnded = SessionEndHook | PtyExited

/** 감시(I15)가 파일 변경을 보고 다시 한 형식 검사. 패널 표시만 바꾼다 */
export interface CheckUpdated extends TaskEvent {
  type: 'check.updated'
  check: CheckSummary
}

/**
 * 사람이 [승인]을 눌렀다 (시나리오 4-3). intake에서는 [의도 승인], verify에서는 [Work 완료]다.
 * check는 누른 때 main이 다시 한 검사다. 기록할 결정과 이전 단계 추천을 여기서 읽는다.
 */
export interface Approve extends TaskEvent {
  type: 'approve'
  check: TaskCheck
  /** intake에서 사람이 승인 화면에서 고른 크기. 없으면 intent 초안의 크기 (4.1) */
  size?: Size
  /** [오류 무시하고 승인] (4.1, D90, D112). 확인 창을 거친 뒤에 보낸다 */
  force?: boolean
}

export type MachineEvent =
  | SessionStarted
  | SessionFailed
  | UserPromptSubmitted
  | ToolUse
  | NotificationSent
  | Stopped
  | SessionEnded
  | CheckUpdated
  | Approve

export type Effect =
  /** task를 시작한다 (시나리오 2): task 디렉터리와 시작 커밋, 스킬 배포, 설정 파일, context.md, PTY */
  | { type: 'startTask'; taskId: string; node: NodeName; reason: StartReason }
  /** Stop 훅에 {"decision":"block","reason":…}로 답해 형식 오류를 되돌린다 (D21) */
  | { type: 'blockStop'; taskId: string; reason: string }
  /** 세션의 프로세스 트리를 끝내고 pty.log를 남긴다 (시나리오 5-1) */
  | { type: 'endSession'; taskId: string }
  /** intent 초안을 intent.md로 확정하고 이전 버전은 intent.history/에 둔다 (4.1) */
  | { type: 'confirmIntent'; taskId: string; version: number; size: Size }
  /**
   * decisions.md에 handoff의 결정을 더한다 (5.4).
   * decisions가 null이면 [오류 무시하고 승인]에서 머리글을 읽지 못한 것이다 (D112)
   */
  | {
      type: 'appendDecisions'
      taskId: string
      node: NodeName
      at: string
      by: 'human'
      decisions: Decision[] | null
    }
  /** events.jsonl에 한 줄 더한다 (5.5) */
  | { type: 'log'; event: LifecycleEvent }

export interface Transition {
  work: WorkState
  effects: Effect[]
  /**
   * 명령(세션 시작, 승인)을 받아들이지 않은 이유. 끝난 세션에서 늦게 온 신호처럼
   * 흐름에서 생길 수 있는 이벤트는 이유 없이 무시한다.
   */
  rejected?: string
}

// ---------- 도움 ----------

/** 세션이 살아 있을 때의 표시 (시나리오 3). 승인 대기와 막힘은 세션이 끝나도 남는다 */
const LIVE: readonly TaskStatus[] = [
  'working',
  'asking',
  'input_needed',
  'idle',
  'awaiting_approval',
  'blocked',
]

const ASK_TOOL = 'AskUserQuestion'
const PERMISSION_PROMPT = 'permission_prompt'

/** /clear와 /resume도 SessionEnd를 보내지만 CLI는 새 세션으로 계속 돈다. 세션 종료로 보지 않는다 (D110) */
const SESSION_CONTINUES: readonly string[] = ['clear', 'resume']
const BYPASS_MODE = 'bypassPermissions'

const pad = (n: number) => String(n).padStart(2, '0')

/** task id: t-01 */
export function taskId(seq: number): string {
  return `t-${pad(seq)}`
}

/** task 디렉터리 이름: 01-intake (5.1) */
export function taskDirName(task: Pick<TaskRecord, 'seq' | 'node'>): string {
  return `${pad(task.seq)}-${task.node}`
}

/** 지금 task. 파이프라인은 한 번에 task 하나만 진행한다 */
export function currentTask(work: WorkState): TaskRecord | undefined {
  return work.tasks[work.tasks.length - 1]
}

/** 권한 확인 끈 모드가 아니면 탭 머리 띠에 경고한다 (D94) */
export function permissionWarning(task: TaskRecord): boolean {
  return task.permission_mode !== undefined && task.permission_mode !== BYPASS_MODE
}

function newTask(work: WorkState, node: NodeName, at: string): TaskRecord {
  const seq = Math.max(0, ...work.tasks.map((t) => t.seq)) + 1
  return {
    id: taskId(seq),
    seq,
    node,
    status: 'working',
    reason: 'default',
    format_version: FORMAT_VERSION,
    created_at: at,
    session: null,
    bounce_count: 0,
    check: null,
  }
}

function withTask(work: WorkState, task: TaskRecord): WorkState {
  return { ...work, tasks: work.tasks.map((t) => (t.id === task.id ? task : t)) }
}

function log(
  work: WorkState,
  at: string,
  type: LifecycleEvent['type'],
  payload: Record<string, unknown> = {},
  task?: TaskRecord,
): Effect {
  const event: LifecycleEvent = task
    ? { ts: at, work_id: work.work_id, task_id: task.id, type, payload }
    : { ts: at, work_id: work.work_id, type, payload }
  return { type: 'log', event }
}

const unchanged = (work: WorkState, rejected?: string): Transition =>
  rejected === undefined ? { work, effects: [] } : { work, effects: [], rejected }

// ---------- Work 만들기 ----------

export interface NewWork {
  workId: string
  /** 기준 브랜치와, Work를 만들 때 분기한 기준 커밋 (시나리오 1, D97) */
  baseBranch: string
  baseCommit: string
  settings?: WorkSettings
  at: string
}

/** Work를 만들고 intake task를 시작한다 (시나리오 1-2, 1-3) */
export function createWork(input: NewWork): Transition {
  const empty: WorkState = {
    schema_version: 1,
    work_id: input.workId,
    status: 'active',
    created_at: input.at,
    base_branch: input.baseBranch,
    base_commit: input.baseCommit,
    intent: null,
    settings: input.settings ?? {},
    tasks: [],
  }
  const intake = newTask(empty, 'intake', input.at)
  const work = { ...empty, tasks: [intake] }
  return {
    work,
    effects: [
      log(work, input.at, 'work.created', {
        base_branch: input.baseBranch,
        base_commit: input.baseCommit,
      }),
      { type: 'startTask', taskId: intake.id, node: intake.node, reason: intake.reason },
    ],
  }
}

// ---------- 전이 ----------

export function transition(work: WorkState, event: MachineEvent, config: AppConfig): Transition {
  const task = work.tasks.find((t) => t.id === event.taskId)
  const command =
    event.type === 'session.started' || event.type === 'session.failed' || event.type === 'approve'
  if (!task || task !== currentTask(work)) {
    return command ? unchanged(work, `${event.taskId}는 지금 task가 아님`) : unchanged(work)
  }
  switch (event.type) {
    case 'session.started':
      return sessionStarted(work, task, event)
    case 'session.failed':
      return sessionFailed(work, task, event)
    case 'approve':
      return approve(work, task, event)
    case 'check.updated':
      if (task.status === 'approved' || task.status === 'interrupted') return unchanged(work)
      return { work: withTask(work, { ...task, check: summarize(event.check) }), effects: [] }
    case 'SessionEnd':
    case 'pty.exit':
      return sessionEnded(work, task, event)
    default:
      return hook(work, task, event, config)
  }
}

function sessionStarted(work: WorkState, task: TaskRecord, e: SessionStarted): Transition {
  if (task.status !== 'working' || task.session) return unchanged(work, `${task.id}는 이미 시작함`)
  const started: TaskRecord = {
    ...task,
    start_commit: e.startCommit,
    skill_hash: e.skillHash,
    claude_version: e.claudeVersion,
    session: {
      id: e.sessionId,
      pid: e.pid,
      ...(e.processStartedAt === undefined ? {} : { process_started_at: e.processStartedAt }),
      started_at: e.at,
      alive: true,
    },
  }
  return {
    work: withTask(work, started),
    effects: [
      log(work, e.at, 'task.started', { reason: task.reason, session_id: e.sessionId }, task),
    ],
  }
}

function sessionFailed(work: WorkState, task: TaskRecord, e: SessionFailed): Transition {
  if (task.status !== 'working' || task.session) return unchanged(work, `${task.id}는 이미 시작함`)
  return {
    work: withTask(work, { ...task, status: 'interrupted', error: e.error }),
    effects: [
      log(work, e.at, 'task.interrupted', { reason: 'start_failed', error: e.error }, task),
    ],
  }
}

/** 훅 신호에 따른 표시 (시나리오 3의 표) */
function hook(
  work: WorkState,
  task: TaskRecord,
  e: UserPromptSubmitted | ToolUse | NotificationSent | Stopped,
  config: AppConfig,
): Transition {
  if (!task.session?.alive || !LIVE.includes(task.status)) return unchanged(work)
  const set = (patch: Partial<TaskRecord>): Transition => ({
    work: withTask(work, { ...task, ...patch }),
    effects: [],
  })
  switch (e.type) {
    case 'UserPromptSubmit':
      // 작업 중. 사람이 새 요청을 보낸 때를 남기고, 첫 신호의 permission_mode를 기록한다 (D94).
      return set({
        status: 'working',
        last_prompt_at: e.at,
        ...(task.permission_mode === undefined && e.permissionMode !== undefined
          ? { permission_mode: e.permissionMode }
          : {}),
      })
    case 'PreToolUse':
      return e.toolName === ASK_TOOL ? set({ status: 'asking' }) : unchanged(work)
    case 'PostToolUse':
      return e.toolName === ASK_TOOL ? set({ status: 'working' }) : unchanged(work)
    case 'Notification':
      return e.notificationType === PERMISSION_PROMPT
        ? set({ status: 'input_needed' })
        : unchanged(work)
    case 'Stop':
      return stop(work, task, e, config)
  }
}

/**
 * Stop (시나리오 3-2, 3-3). 유효한 handoff가 있으면 승인 대기나 막힘, 없으면 대기다.
 * 형식 오류가 있고 이번 턴에 handoff가 바뀌었으면 설정한 연속 횟수까지 되돌린다 (D21).
 * 연속 횟수는 사람이 새 요청으로 시작한 턴의 Stop이나 검사 통과 때 0으로 돌아간다 (D107).
 */
function stop(work: WorkState, task: TaskRecord, e: Stopped, config: AppConfig): Transition {
  const check = summarize(e.check)
  const bounces = e.stopHookActive ? task.bounce_count : 0
  if (isValid(check)) {
    const status = check.status === 'blocked' ? 'blocked' : 'awaiting_approval'
    const entered = status === 'awaiting_approval' && task.status !== 'awaiting_approval'
    return {
      work: withTask(work, { ...task, status, bounce_count: 0, check }),
      effects: entered ? [log(work, e.at, 'task.awaiting_approval', {}, task)] : [],
    }
  }
  const bounce =
    check.handoff_present &&
    check.errors.length > 0 &&
    e.handoffChanged &&
    bounces < config.format_error_bounce_max
  if (bounce) {
    return {
      work: withTask(work, { ...task, status: 'working', bounce_count: bounces + 1, check }),
      effects: [{ type: 'blockStop', taskId: task.id, reason: bounceMessage(check) }],
    }
  }
  return {
    work: withTask(work, { ...task, status: 'idle', bounce_count: bounces, check }),
    effects: [],
  }
}

/**
 * SessionEnd나 PTY 종료 (시나리오 3). 승인 대기와 막힘은 그대로 두고, 그 밖에는 세션 종료다 (3.3).
 * SessionEnd의 reason이 clear나 resume이면 CLI가 계속 돌므로 세션 종료로 보지 않는다 (D110).
 */
function sessionEnded(work: WorkState, task: TaskRecord, e: SessionEnded): Transition {
  if (e.type === 'SessionEnd' && e.reason !== undefined && SESSION_CONTINUES.includes(e.reason)) {
    return unchanged(work)
  }
  if (!task.session?.alive) return unchanged(work)
  const session = { ...task.session, alive: false, ended_at: e.at }
  if (task.status === 'awaiting_approval' || task.status === 'blocked') {
    return { work: withTask(work, { ...task, session }), effects: [] }
  }
  return {
    work: withTask(work, { ...task, session, status: 'session_ended' }),
    effects: [log(work, e.at, 'task.interrupted', { reason: 'session_ended' }, task)],
  }
}

/**
 * 승인 (시나리오 4-4, 5). 승인을 기록하고, 세션을 끝내고, 결정을 decisions.md에 더하고, 다음 단계로 간다.
 * intake 승인은 의도 승인이라 intent를 확정한다 (4.1). verify 승인은 [Work 완료]다. M2의 전달은 [완료만]이다.
 * 에이전트가 턴을 끝낸 뒤(승인 대기, 대기, 세션 종료)에만 받는다. 누른 때의 검사로 다시 판정한다 (approvalGate).
 * [오류 무시하고 승인]이면 무시한 오류를 남기고, 머리글에서 읽지 못한 값은 없는 것으로 본다 (D112).
 * 에이전트가 이전 단계를 추천했으면 다음 task를 시작하지 않고 멈춘다 (D23).
 */
function approve(work: WorkState, task: TaskRecord, e: Approve): Transition {
  if (!REVIEWABLE.includes(task.status)) {
    return unchanged(work, `${task.id}는 승인할 수 있는 상태가 아님`)
  }
  const check = summarize(e.check)
  const gate = approvalGate(task, check, task.node === 'intake' ? e.size : undefined)
  const forced = !gate.approve && e.force === true && gate.force
  if (!gate.approve && !forced) {
    // 승인 화면을 띄운 뒤 파일이 바뀌었다. 오류를 보이고 승인하지 않는다 (4.1).
    const reason = e.force
      ? `${task.id}: 오류를 무시하고 승인할 수 없음`
      : `${task.id}의 handoff가 유효하지 않음`
    return { work: withTask(work, { ...task, check }), effects: [], rejected: reason }
  }
  const size = task.node === 'intake' ? (e.size ?? e.check.intentDraft?.size) : work.intent?.size
  if (!size) return unchanged(work, `${task.id}: intent의 크기를 모름`)
  const header = e.check.handoffHeader

  const session = task.session?.alive
    ? { ...task.session, alive: false, ended_at: e.at }
    : task.session
  const approved: TaskRecord = {
    ...task,
    status: 'approved',
    approved_at: e.at,
    approved_by: 'human',
    check,
    session,
    ...(forced ? { ignored_errors: gate.errors } : {}),
  }
  let next: WorkState = withTask(work, approved)
  const payload = forced ? { by: 'human', ignored_errors: gate.errors.length } : { by: 'human' }
  const effects: Effect[] = [log(work, e.at, 'task.approved', payload, task)]
  if (task.session?.alive) effects.push({ type: 'endSession', taskId: task.id })
  effects.push({
    type: 'appendDecisions',
    taskId: task.id,
    node: task.node,
    at: e.at,
    by: 'human',
    decisions: header ? header.decisions : null,
  })
  if (task.node === 'intake') {
    const version = (work.intent?.version ?? 0) + 1
    next = { ...next, intent: { version, size } }
    effects.push({ type: 'confirmIntent', taskId: task.id, version, size })
  }

  const rec = header?.recommended_next
  if (rec && NODES.includes(rec.node) && isPrevious(task.node, rec.node)) {
    next = {
      ...next,
      status: 'stopped',
      stop: { kind: 'recommended_back', task_id: task.id, node: rec.node, reason: rec.reason },
    }
    return { work: next, effects }
  }
  const nextNode = defaultNext(task.node, size)
  if (nextNode === WORK_COMPLETE) {
    next = { ...next, status: 'completed', completed_at: e.at }
    effects.push(log(work, e.at, 'work.completed', { delivery: 'none' }))
    return { work: next, effects }
  }
  const created = newTask(next, nextNode, e.at)
  next = { ...next, tasks: [...next.tasks, created] }
  effects.push({
    type: 'startTask',
    taskId: created.id,
    node: created.node,
    reason: created.reason,
  })
  return { work: next, effects }
}
