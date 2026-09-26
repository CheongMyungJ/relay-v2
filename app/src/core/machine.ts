// Work와 Task의 상태 전이 (3.3, 시나리오 2~5, 9). (상태, 이벤트) → (새 상태, 할 일)인 순수 함수다 (I10).
// 훅 신호, 사람 버튼, 프로세스 종료, 재시작을 main이 이벤트로 바꿔 넣고, 돌려받은 할 일을 차례로 실행한다.
// 상태는 work.json이고 main이 전이마다 쓴다 (I11). 설정은 판정하는 때의 값을 받는다 (D73).
// 기본 흐름, [오류 무시하고 승인](D112), 사람 조작(중단, 재개, 멈춤, 포기), 대기열(D18), 재시작 조정(D75, D78)을
// 담는다. 되감기와 자동 승인은 해당 마일스톤에서 더한다. 세션 상한은 main이 세고, 자리가 없으면 task.queued를 넣는다.
import type { AppConfig, WorkSettings } from '../shared/config'
import type { Decision, NodeName, Size } from '../shared/contracts'
import type { WorkActions } from '../shared/views'
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

/**
 * main이 끝난 세션을 --resume으로 다시 띄운 직후 알린다 (시나리오 3-4, 3-5).
 * check는 다시 띄운 때의 형식 검사다. 유효한 handoff가 있으면 승인 대기나 막힘이다 (3.3).
 */
export interface SessionResumed extends TaskEvent {
  type: 'session.resumed'
  pid: number
  processStartedAt?: string
  claudeVersion: string
  check: CheckSummary
}

/**
 * task를 띄우지 못했다 (새 세션이든 재개든). check는 그때의 형식 검사다. 유효한 handoff가 있으면
 * 세션이 없어도 승인 대기나 막힘으로 남는다 (3.3). 없으면 중단됨이다.
 */
export interface SessionFailed extends TaskEvent {
  type: 'session.failed'
  error: string
  check?: CheckSummary
}

/** 세션 상한 때문에 띄우지 못해 대기열에 넣었다 (D18). main이 넣는다 */
export interface TaskQueued extends TaskEvent {
  type: 'task.queued'
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
  /** 끝난 프로세스. 다시 연 세션이 있으면 앞 프로세스의 늦은 종료를 가려낸다 */
  pid?: number
}

export type SessionEnded = SessionEndHook | PtyExited

/** 감시(I15)가 파일 변경을 보고 다시 한 형식 검사. 패널 표시만 바꾼다 */
export interface CheckUpdated extends TaskEvent {
  type: 'check.updated'
  check: CheckSummary
}

/**
 * 사람이 [승인]을 눌렀다 (시나리오 4-3). intake에서는 [의도 승인], verify에서는 Work 완료 화면의 [완료만]이다.
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

/** 세션을 끝내는 이유. events.jsonl의 task.interrupted에 남긴다 */
export type InterruptReason = 'human' | 'app_quit'

/**
 * [즉시 중단] (시나리오 3-4)과 앱 종료 확인 (시나리오 3-6). check는 누른 때의 형식 검사다.
 * 대기열에서 뺀 task는 유효한 handoff가 있으면 승인 대기나 막힘으로 남는다 (3.3).
 */
export interface Interrupt extends TaskEvent {
  type: 'interrupt'
  reason: InterruptReason
  check?: CheckSummary
}

/** [재개], [세션 재개] (시나리오 3-4, 3-5, 4.4) */
export interface Resume extends TaskEvent {
  type: 'resume'
}

/** [이 단계 새 세션으로 다시] (시나리오 3-5, D114) */
export interface Retry extends TaskEvent {
  type: 'retry'
}

interface WorkEvent {
  at: string
}

/** [이 단계 끝나면 멈춤]을 켜거나 끈다 (시나리오 3-4) */
export interface StopAfterStep extends WorkEvent {
  type: 'stopAfter'
  on: boolean
}

/** 멈춘 Work의 [재개]: 기본 다음 단계를 시작한다 (3.3, 시나리오 3-4) */
export interface ResumeWork extends WorkEvent {
  type: 'resumeWork'
}

/** [Work 포기] (3.3) */
export interface Abandon extends WorkEvent {
  type: 'abandon'
}

/** Work별 설정 (D72). main이 검사한 값을 넣는다. 질문 방식은 다음에 시작하는 task부터 쓴다 (D73) */
export interface UpdateSettings extends WorkEvent {
  type: 'settings.update'
  settings: WorkSettings
}

/**
 * 앱을 다시 켰다 (시나리오 9, D75, D78). check는 지금 task의 형식 검사다.
 * 재시작 뒤 이 앱에서 살아 있는 세션은 없다.
 */
export interface AppRestarted extends WorkEvent {
  type: 'app.restarted'
  check: CheckSummary | null
}

export type MachineEvent =
  | SessionStarted
  | SessionResumed
  | SessionFailed
  | TaskQueued
  | UserPromptSubmitted
  | ToolUse
  | NotificationSent
  | Stopped
  | SessionEnded
  | CheckUpdated
  | Approve
  | Interrupt
  | Resume
  | Retry
  | StopAfterStep
  | ResumeWork
  | Abandon
  | UpdateSettings
  | AppRestarted

export type Effect =
  /**
   * task를 새 세션으로 시작한다 (시나리오 2): task 디렉터리와 시작 커밋, 스킬 배포, 설정 파일, context.md, PTY.
   * 세션 상한을 넘으면 main이 대기열에 넣는다 (D18)
   */
  | { type: 'startTask'; taskId: string; node: NodeName; reason: StartReason }
  /** 끝난 세션을 같은 옵션과 --resume <세션 id>로 다시 연다 (시나리오 3-4). 상한은 startTask와 같다 */
  | { type: 'resumeTask'; taskId: string }
  /** 대기열에서 뺀다 */
  | { type: 'dequeue'; taskId: string }
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
   * 명령(세션 시작, 승인, 사람 버튼)을 받아들이지 않은 이유. 끝난 세션에서 늦게 온 신호처럼
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

/** 세션을 끝내도 남는 표시: 유효한 handoff가 있는 승인 대기와 막힘 (3.3) */
const KEPT_WITHOUT_SESSION: readonly TaskStatus[] = ['awaiting_approval', 'blocked']

/** [재개]·[세션 재개]를 받는 상태. 세션이 살아 있지 않아야 한다 */
const RESUMABLE: readonly TaskStatus[] = [
  'interrupted',
  'session_ended',
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

/**
 * 세션을 띄울 수 있는 task: 세션이 살아 있지 않고, 새로 만들었거나(작업 중) 대기열에서 자리를 기다리거나
 * [재개]·[세션 재개]를 받는 상태다. main은 띄운 결과를 session.started, session.resumed, session.failed,
 * task.queued로 알린다. 명령과 그 할 일은 Work의 처리 줄 한 번에 끝나므로 그 사이에 다른 명령은 오지 않는다.
 */
export function launchable(task: TaskRecord): boolean {
  if (task.session?.alive) return false
  return task.status === 'working' || task.status === 'queued' || RESUMABLE.includes(task.status)
}

/**
 * 사람이 할 수 있는 조작 (액션 바). 화면에 보이는 버튼과 machine이 받는 명령이 같은 판정을 쓴다.
 * [즉시 중단]은 세션이 살아 있거나 대기열에 있을 때, [재개]·[세션 재개]는 세션이 없고 중단됨, 세션 종료,
 * 승인 대기, 막힘일 때, [이 단계 새 세션으로 다시]는 세션 종료일 때다.
 */
export function actions(work: WorkState): WorkActions {
  const task = currentTask(work)
  const active = work.status === 'active'
  const live = task?.session?.alive === true
  return {
    interrupt: active && !!task && (live || task.status === 'queued'),
    resume: active && !!task && !live && RESUMABLE.includes(task.status),
    retry: active && task?.status === 'session_ended',
    resumeWork: work.status === 'stopped',
    stopAfter: active,
    abandon: active || work.status === 'stopped',
  }
}

function newTask(
  work: WorkState,
  node: NodeName,
  at: string,
  reason: StartReason = 'default',
): TaskRecord {
  const seq = Math.max(0, ...work.tasks.map((t) => t.seq)) + 1
  return {
    id: taskId(seq),
    seq,
    node,
    status: 'working',
    reason,
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

/** 형식 검사로 정한 표시: 유효한 handoff면 승인 대기나 막힘, 아니면 null (3.3, 시나리오 3의 Stop) */
function handoffStatus(check: CheckSummary): 'awaiting_approval' | 'blocked' | null {
  if (!isValid(check)) return null
  return check.status === 'blocked' ? 'blocked' : 'awaiting_approval'
}

/** 세션 없이 남는 task의 표시: 유효한 handoff면 승인 대기나 막힘(3.3), 아니면 중단됨 */
function withoutSession(check: CheckSummary | undefined | null): TaskStatus {
  return (check ? handoffStatus(check) : null) ?? 'interrupted'
}

/** 키를 뺀 사본 */
function omit<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const drop: readonly PropertyKey[] = keys
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !drop.includes(k))) as Omit<T, K>
}

/** 대기열 표시를 지운 task */
const unqueued = (task: TaskRecord): TaskRecord => omit(task, 'queued_at')

/** [이 단계 끝나면 멈춤] 표시를 지운 Work */
const withoutStopAfter = (work: WorkState): WorkState => omit(work, 'stop_after_step')

/**
 * 세션을 끝낸다: 살아 있으면 endSession, 대기열에 있으면 dequeue. 승인 대기와 막힘은 그대로 두고,
 * 그 밖에는 중단됨이다 (3.3). 세션도 대기열도 아니면 null.
 */
function endTask(
  work: WorkState,
  task: TaskRecord,
  at: string,
  reason: InterruptReason | 'abandoned',
  check?: CheckSummary,
): { task: TaskRecord; effects: Effect[] } | null {
  if (task.status === 'queued') {
    const status = reason === 'abandoned' ? 'interrupted' : withoutSession(check)
    return {
      task: { ...unqueued(task), status },
      effects: [
        { type: 'dequeue', taskId: task.id },
        log(work, at, 'task.interrupted', { reason, queued: true }, task),
      ],
    }
  }
  if (!task.session?.alive) return null
  const kept = reason !== 'abandoned' && KEPT_WITHOUT_SESSION.includes(task.status)
  return {
    task: {
      ...task,
      status: kept ? task.status : 'interrupted',
      session: { ...task.session, alive: false, ended_at: at },
    },
    effects: [
      log(work, at, 'task.interrupted', { reason }, task),
      { type: 'endSession', taskId: task.id },
    ],
  }
}

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

const TASK_COMMANDS: readonly MachineEvent['type'][] = [
  'session.started',
  'session.resumed',
  'session.failed',
  'task.queued',
  'approve',
  'interrupt',
  'resume',
  'retry',
]

export function transition(work: WorkState, event: MachineEvent, config: AppConfig): Transition {
  switch (event.type) {
    case 'stopAfter':
      return stopAfter(work, event)
    case 'resumeWork':
      return resumeWork(work, event)
    case 'abandon':
      return abandon(work, event)
    case 'settings.update':
      return updateSettings(work, event)
    case 'app.restarted':
      return restarted(work, event)
    default:
      return taskTransition(work, event, config)
  }
}

type TaskMachineEvent = Exclude<
  MachineEvent,
  StopAfterStep | ResumeWork | Abandon | UpdateSettings | AppRestarted
>

function taskTransition(work: WorkState, event: TaskMachineEvent, config: AppConfig): Transition {
  const task = work.tasks.find((t) => t.id === event.taskId)
  const command = TASK_COMMANDS.includes(event.type)
  if (!task || task !== currentTask(work)) {
    return command ? unchanged(work, `${event.taskId}는 지금 task가 아님`) : unchanged(work)
  }
  switch (event.type) {
    case 'session.started':
      return sessionStarted(work, task, event)
    case 'session.resumed':
      return sessionResumed(work, task, event)
    case 'session.failed':
      return sessionFailed(work, task, event)
    case 'task.queued':
      return queued(work, task, event)
    case 'approve':
      return approve(work, task, event)
    case 'interrupt':
      return interrupt(work, task, event)
    case 'resume':
      return resume(work, task)
    case 'retry':
      return retry(work, task, event)
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
  if (!launchable(task) || task.session) return unchanged(work, `${task.id}는 이미 시작함`)
  const started: TaskRecord = {
    ...omit(unqueued(task), 'error'),
    status: 'working',
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

/**
 * 다시 연 세션 (시나리오 3-4). pid와 시작 시각을 바꾸고, 표시는 다시 연 때의 검사로 정한다:
 * 유효한 handoff면 승인 대기나 막힘, 아니면 대기다. 다시 연 claude는 사람의 입력을 기다린다 (S6).
 */
function sessionResumed(work: WorkState, task: TaskRecord, e: SessionResumed): Transition {
  if (!launchable(task) || !task.session) {
    return unchanged(work, `${task.id}는 다시 열 수 있는 상태가 아님`)
  }
  const check = summarize(e.check)
  const status = handoffStatus(check) ?? 'idle'
  const session = omit(task.session, 'ended_at', 'process_started_at')
  const resumed: TaskRecord = {
    ...omit(unqueued(task), 'error'),
    status,
    check,
    session: {
      ...session,
      pid: e.pid,
      ...(e.processStartedAt === undefined ? {} : { process_started_at: e.processStartedAt }),
      alive: true,
      resumed_at: e.at,
    },
  }
  const effects: Effect[] = [
    log(
      work,
      e.at,
      'task.resumed',
      { session_id: task.session.id, claude_version: e.claudeVersion },
      task,
    ),
  ]
  if (status === 'awaiting_approval' && task.status !== 'awaiting_approval') {
    effects.push(log(work, e.at, 'task.awaiting_approval', {}, task))
  }
  return { work: withTask(work, resumed), effects }
}

function sessionFailed(work: WorkState, task: TaskRecord, e: SessionFailed): Transition {
  if (!launchable(task)) return unchanged(work, `${task.id}는 이미 시작함`)
  const failed: TaskRecord = {
    ...unqueued(task),
    status: withoutSession(e.check),
    error: e.error,
    ...(e.check ? { check: summarize(e.check) } : {}),
  }
  return {
    work: withTask(work, failed),
    effects: [
      log(work, e.at, 'task.interrupted', { reason: 'start_failed', error: e.error }, task),
    ],
  }
}

/** 세션 상한 때문에 대기열에 넣었다 (D18) */
function queued(work: WorkState, task: TaskRecord, e: TaskQueued): Transition {
  if (!launchable(task)) return unchanged(work, `${task.id}는 띄울 수 있는 상태가 아님`)
  return { work: withTask(work, { ...task, status: 'queued', queued_at: e.at }), effects: [] }
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
  const status = handoffStatus(check)
  if (status) {
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
 * 다시 연 세션이 있으면 앞 프로세스의 늦은 PTY 종료는 무시한다.
 */
function sessionEnded(work: WorkState, task: TaskRecord, e: SessionEnded): Transition {
  if (e.type === 'SessionEnd' && e.reason !== undefined && SESSION_CONTINUES.includes(e.reason)) {
    return unchanged(work)
  }
  if (!task.session?.alive) return unchanged(work)
  if (e.type === 'pty.exit' && e.pid !== undefined && e.pid !== task.session.pid) {
    return unchanged(work)
  }
  const session = { ...task.session, alive: false, ended_at: e.at }
  if (KEPT_WITHOUT_SESSION.includes(task.status)) {
    return { work: withTask(work, { ...task, session }), effects: [] }
  }
  return {
    work: withTask(work, { ...task, session, status: 'session_ended' }),
    effects: [log(work, e.at, 'task.interrupted', { reason: 'session_ended' }, task)],
  }
}

/**
 * 승인 (시나리오 4-4, 5). 승인을 기록하고, 세션을 끝내고, 결정을 decisions.md에 더하고, 다음 단계로 간다.
 * intake 승인은 의도 승인이라 intent를 확정한다 (4.1). verify 승인은 Work 완료 화면의 전달 선택이고, M2의 전달은 [완료만]뿐이다.
 * 에이전트가 턴을 끝낸 뒤(승인 대기, 대기, 세션 종료)에만 받는다. 누른 때의 검사로 다시 판정한다 (approvalGate).
 * [오류 무시하고 승인]이면 무시한 오류를 남기고, 머리글에서 읽지 못한 값은 없는 것으로 본다 (D112).
 * 에이전트가 이전 단계를 추천했으면 다음 task를 시작하지 않고 멈춘다 (D23). [이 단계 끝나면 멈춤]이
 * 켜져 있어도 멈춘다 (시나리오 3-4). 어느 쪽이든 멈춤 표시는 지운다.
 */
function approve(work: WorkState, task: TaskRecord, e: Approve): Transition {
  if (work.status !== 'active') return unchanged(work, '진행 중인 Work가 아님')
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
  const stopAfterStep = work.stop_after_step === true
  let next: WorkState = withoutStopAfter(withTask(work, approved))
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
  if (stopAfterStep) {
    next = { ...next, status: 'stopped', stop: { kind: 'after_step', task_id: task.id } }
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

/**
 * [즉시 중단] (시나리오 3-4)과 앱 종료 확인 (시나리오 3-6). 세션을 트리째 끝내고 중단됨으로 남긴다.
 * 유효한 handoff로 승인 대기나 막힘이던 task는 세션이 없어도 그 표시가 남는다 (3.3).
 * 대기열의 task는 대기열에서 빼고 중단됨으로 둔다.
 */
function interrupt(work: WorkState, task: TaskRecord, e: Interrupt): Transition {
  if (work.status !== 'active') return unchanged(work, '진행 중인 Work가 아님')
  const ended = endTask(work, task, e.at, e.reason, e.check)
  if (!ended) return unchanged(work, `${task.id}에 끝낼 세션이 없음`)
  return { work: withTask(work, ended.task), effects: ended.effects }
}

/**
 * [재개]와 [세션 재개] (시나리오 3-4, 3-5, 4.4). 세션이 있던 task는 같은 옵션과 --resume으로 다시 열고,
 * 한 번도 띄우지 못한 task(대기열에서 재시작을 맞았거나 시작에 실패함)는 새 세션으로 시작한다.
 * 표시는 main이 띄운 결과(session.resumed, session.started, task.queued, session.failed)로 바꾼다.
 * 세션 상한을 넘으면 main이 대기열에 넣는다.
 */
function resume(work: WorkState, task: TaskRecord): Transition {
  if (work.status !== 'active') return unchanged(work, '진행 중인 Work가 아님')
  if (task.session?.alive || !RESUMABLE.includes(task.status)) {
    return unchanged(work, `${task.id}는 재개할 수 있는 상태가 아님`)
  }
  const effect: Effect = task.session
    ? { type: 'resumeTask', taskId: task.id }
    : { type: 'startTask', taskId: task.id, node: task.node, reason: task.reason }
  return { work, effects: [effect] }
}

/**
 * [이 단계 새 세션으로 다시] (시나리오 3-5, D114). 같은 노드의 새 task를 만들어 새 세션으로 시작한다.
 * 앞 task는 세션 종료로 남고 입력에 들어가지 않는다. 코드는 되돌리지 않는다.
 */
function retry(work: WorkState, task: TaskRecord, e: Retry): Transition {
  if (work.status !== 'active') return unchanged(work, '진행 중인 Work가 아님')
  if (task.status !== 'session_ended') {
    return unchanged(work, `${task.id}는 handoff 없이 끝난 세션이 아님`)
  }
  const created = newTask(work, task.node, e.at, 'resume')
  return {
    work: { ...work, tasks: [...work.tasks, created] },
    effects: [
      { type: 'startTask', taskId: created.id, node: created.node, reason: created.reason },
    ],
  }
}

// ---------- Work 조작 ----------

/** [이 단계 끝나면 멈춤] (시나리오 3-4). 지금 단계가 승인되면 다음 단계를 시작하지 않고 멈춘다 */
function stopAfter(work: WorkState, e: StopAfterStep): Transition {
  if (work.status !== 'active') return unchanged(work, '진행 중인 Work가 아님')
  if ((work.stop_after_step === true) === e.on) return unchanged(work)
  return { work: e.on ? { ...work, stop_after_step: true } : withoutStopAfter(work), effects: [] }
}

/**
 * 멈춘 Work의 [재개] (3.3, 시나리오 3-4). 멈추게 한 task의 기본 다음 단계를 시작한다.
 * 이전 단계 추천(D23)으로 멈췄으면 추천을 따르지 않고 기본 다음 단계로 간다. 추천을 따르는 단계 선택은 M4다.
 * 기본 다음 단계가 Work 완료면 Work를 완료한다(M3의 전달은 [완료만]뿐이다).
 */
function resumeWork(work: WorkState, e: ResumeWork): Transition {
  if (work.status !== 'stopped' || !work.stop) return unchanged(work, '멈춘 Work가 아님')
  const stopped = work.tasks.find((t) => t.id === work.stop?.task_id)
  const size = work.intent?.size
  if (!stopped || !size) return unchanged(work, '다음 단계를 정할 수 없음')
  const active: WorkState = { ...omit(work, 'stop'), status: 'active' }
  const nextNode = defaultNext(stopped.node, size)
  if (nextNode === WORK_COMPLETE) {
    return {
      work: { ...active, status: 'completed', completed_at: e.at },
      effects: [log(work, e.at, 'work.completed', { delivery: 'none' })],
    }
  }
  const created = newTask(active, nextNode, e.at)
  return {
    work: { ...active, tasks: [...active.tasks, created] },
    effects: [
      { type: 'startTask', taskId: created.id, node: created.node, reason: created.reason },
    ],
  }
}

/**
 * [Work 포기] (3.3). 살아 있는 세션을 끝내고 대기열에서 빼고 Work를 포기로 둔다. push/PR은 하지 않는다.
 * 끝낸 task는 승인 대기였어도 중단됨이다(포기한 Work의 task는 승인하지 않는다).
 */
function abandon(work: WorkState, e: Abandon): Transition {
  if (work.status !== 'active' && work.status !== 'stopped') {
    return unchanged(work, '포기할 수 있는 Work가 아님')
  }
  const task = currentTask(work)
  const ended = task ? endTask(work, task, e.at, 'abandoned') : null
  const rest = omit(ended ? withTask(work, ended.task) : work, 'stop', 'stop_after_step')
  return {
    work: { ...rest, status: 'abandoned', abandoned_at: e.at },
    effects: [...(ended?.effects ?? []), log(work, e.at, 'work.abandoned')],
  }
}

/** Work별 설정 (D72). 끝난 Work는 바꾸지 않는다 */
function updateSettings(work: WorkState, e: UpdateSettings): Transition {
  if (work.status !== 'active' && work.status !== 'stopped') {
    return unchanged(work, '끝난 Work의 설정은 바꾸지 않음')
  }
  return { work: { ...work, settings: e.settings }, effects: [] }
}

/**
 * 재시작 조정 (시나리오 9, D75, D78). 재시작 뒤에는 살아 있는 세션이 없다.
 * - "실행 중"이던 task(세션이 살아 있었거나 띄우는 중이었음)는 중단됨이다. 유효한 handoff가 있으면
 *   승인 대기나 막힘이다. 앱이 꺼진 동안 받지 못한 Stop을 이렇게 보충한다. 자동 재개와 자동 승인은 없다.
 * - 대기열의 task는 대기열을 비우고 중단됨으로 둔다.
 */
function restarted(work: WorkState, e: AppRestarted): Transition {
  const current = currentTask(work)
  const effects: Effect[] = []
  const tasks = work.tasks.map((t): TaskRecord => {
    const session = t.session?.alive ? { ...t.session, alive: false, ended_at: e.at } : t.session
    if (t !== current || work.status !== 'active') return { ...t, session }
    if (t.status === 'queued') {
      // 대기열을 비운다 (D78). 세션 없이 남는 표시는 3.3을 따른다(보통 중단됨)
      const status = withoutSession(e.check)
      effects.push(
        status === 'interrupted'
          ? log(work, e.at, 'task.interrupted', { reason: 'app_restart', queued: true }, t)
          : log(work, e.at, 'task.awaiting_approval', { reason: 'app_restart' }, t),
      )
      return { ...unqueued(t), status }
    }
    const running = t.session?.alive === true || (t.status === 'working' && !t.session?.alive)
    if (!running) return { ...t, session }
    const check = e.check ? summarize(e.check) : null
    const status = check ? handoffStatus(check) : null
    if (status) {
      if (status === 'awaiting_approval' && t.status !== 'awaiting_approval') {
        effects.push(log(work, e.at, 'task.awaiting_approval', { reason: 'app_restart' }, t))
      }
      return { ...t, session, status, check: check ?? t.check }
    }
    effects.push(log(work, e.at, 'task.interrupted', { reason: 'app_restart' }, t))
    return { ...t, session, status: 'interrupted', ...(check ? { check } : {}) }
  })
  const changed = tasks.some((t, i) => JSON.stringify(t) !== JSON.stringify(work.tasks[i]))
  return changed ? { work: { ...work, tasks }, effects } : unchanged(work)
}
