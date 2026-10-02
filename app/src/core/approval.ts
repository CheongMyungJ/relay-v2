// 승인의 판정: 수동 승인 (4.1, D90, D112), 자동 승인의 방식과 조건 (4.2, 4.3, D72, D129), 사이드바 배지의
// 우선순위 (D80). machine의 승인과 자동 승인 카운트다운, 승인 화면의 버튼이 같은 판정을 쓴다.
import { AGENT_APPROVAL_NOTICE, type AgentEngine } from '../shared/agent'
import { agentLabel, knownTaskEngine } from './agent'
import type { AppConfig, AutoApproveNode, WorkSettings } from '../shared/config'
import type { AnyHandoff, TaskNode } from '../shared/contracts'
import type { ApprovalGate, Badge, BadgeKind } from '../shared/views'
import type {
  AutoHoldReason,
  CheckSummary,
  FormatIssue,
  TaskRecord,
  TaskStatus,
  WorkState,
  WorkType,
} from '../shared/work'
import { AUTO_APPROVE_NODES } from './config'
import { RESPOND, defaultNext, isPipelineNode } from './pipeline'
import { isRespondPending } from './respond'
import { INTENT_DRAFT_FILE, REPLIES_FILE, isValid } from './validate'

export type { ApprovalGate, Badge, BadgeKind }

/**
 * 에이전트가 턴을 끝낸 뒤라 사람이 승인할 수 있는 상태 (D112).
 * 형식 오류가 끝까지 남으면 Stop 뒤에는 대기, 세션이 끝났으면 세션 종료로 남는다 (4.1).
 */
export const REVIEWABLE: readonly TaskStatus[] = ['awaiting_approval', 'idle', 'session_ended']

/**
 * 넘길 수 없는 오류: intake에서 intent 초안의 머리글 오류와 초안 없음(D90), PR 대응에서 replies.md의 오류(D204).
 * 머리글이 틀리거나 초안이 없으면 앱이 intent.md를 만들 수 없고, 답글은 밖으로 나가 되돌릴 수 없어 추측 없이 게시한다
 */
function unignorable(node: TaskRecord['node'], issue: FormatIssue): boolean {
  if (node === RESPOND) return issue.file === REPLIES_FILE
  return node === 'intake' && issue.file === INTENT_DRAFT_FILE && issue.part !== 'body'
}

/**
 * 승인 버튼의 판정. check는 판정하는 때에 다시 한 형식 검사다.
 * - [승인]: handoff가 awaiting_approval이고 남은 오류가 없다.
 * - [오류 무시하고 승인]: handoff가 있고 오류가 남았으며, 넘길 수 없는 오류가 없다.
 *   status가 blocked로 읽히면 주지 않는다 (4.4). 머리글을 읽을 수 없는 경우는 준다 (D112).
 */
export function approvalGate(
  task: Pick<TaskRecord, 'node' | 'status'>,
  check: CheckSummary,
): ApprovalGate {
  const { errors } = check
  const blocking = errors.filter((e) => unignorable(task.node, e))
  const ready = REVIEWABLE.includes(task.status) && check.handoff_present
  return {
    approve: ready && check.status === 'awaiting_approval' && errors.length === 0,
    force: ready && check.status !== 'blocked' && errors.length > 0 && blocking.length === 0,
    errors,
    blocking,
  }
}

// ---------- 자동 승인 (4.2, 4.3) ----------

export type ApprovalMode = 'manual' | 'auto'

/**
 * 자동 승인을 켤 수 있는 노드인가. intake(의도 승인)와 verify(리뷰와 검증 = Work 완료)는 늘 수동이다 (4.2).
 * 기능 추가의 design과 implement(D234, D249), 리팩터링의 refactor(D276), PR 대응은 fix처럼 켤 수 있다 (D169)
 */
export function autoApprovable(node: TaskNode): node is AutoApproveNode {
  return (AUTO_APPROVE_NODES as readonly TaskNode[]).includes(node)
}

/** 승인 방식. intake와 verify는 항상 수동이고, Codex는 수동이고, Claude의 나머지는 Work 설정, 앱 설정 순서로 본다 (4.2, D72, D169) */
export function approvalMode(
  config: Pick<AppConfig, 'auto_approve'>,
  settings: WorkSettings,
  node: TaskNode,
  engine: AgentEngine | null = 'claude',
): ApprovalMode {
  if (engine !== 'claude' || !autoApprovable(node)) return 'manual'
  return (settings.auto_approve?.[node] ?? config.auto_approve[node]) ? 'auto' : 'manual'
}

/**
 * Stop 본문의 background_tasks나 session_crons가 비어 있지 않다: 세션이 끝난 것이 아니라 백그라운드 작업이나
 * 예약된 깨우기를 기다리며 쉬는 중이다(Claude Code 문서 hooks). 필드가 없으면(목록을 읽지 못함) 비어 있는 것으로
 * 본다 (D129)
 */
export function pendingBackground(body: Readonly<Record<string, unknown>>): boolean {
  const pending = (v: unknown) => Array.isArray(v) && v.length > 0
  return pending(body['background_tasks']) || pending(body['session_crons'])
}

export interface AutoApproveInput {
  node: TaskNode
  /** Work의 업무 유형. 기본 다음 단계가 유형마다 다르다 (3.2) */
  type: WorkType
  /** 판정하는 때의 형식 검사. 머리글(handoffHeader)에서 조건을 읽는다 */
  check: CheckSummary & { handoffHeader?: AnyHandoff | null }
  /** Stop 때 백그라운드 작업이나 예약된 깨우기가 남아 있었다 (pendingBackground, D129) */
  background: boolean
}

/**
 * 자동 승인 조건 (4.3, D129)에서 어긴 것. 비어 있으면 모두 만족한다:
 * handoff 형식이 유효하고 awaiting_approval, open_questions가 비어 있음, intent_deviation이 없음,
 * recommended_next가 null이거나 기본 다음 단계, Stop 때 백그라운드 작업과 예약된 깨우기가 없음.
 * "턴이 끝난 뒤 새 요청이 없음"은 machine이 새 요청(UserPromptSubmit)을 받으면 카운트다운을 멈추는 것으로 지킨다.
 * 모든 조건은 에이전트가 쓴 내용과 에이전트의 세션이다(D7). 커밋 안 된 변경은 조건이 아니다(승인 화면의 경고).
 */
export function autoApproveHolds(input: AutoApproveInput): AutoHoldReason[] {
  const { check } = input
  const h = check.handoffHeader
  if (!isValid(check) || check.status !== 'awaiting_approval' || !h) return ['invalid']
  const out: AutoHoldReason[] = []
  if (h.open_questions.length > 0) out.push('open_questions')
  if (h.intent_deviation) out.push('intent_deviation')
  const rec = h.recommended_next
  if (rec && (!isPipelineNode(input.node) || rec.node !== defaultNext(input.type, input.node))) {
    out.push('recommended_next')
  }
  if (input.background) out.push('background')
  return out
}

/** 자동 승인하지 않은 까닭의 화면 문구 (승인 화면과 알림) */
export const AUTO_HOLD_LABEL: Readonly<Record<AutoHoldReason, string>> = {
  open_questions: '열린 질문이 있음',
  intent_deviation: '의도와 어긋남(intent_deviation)이 있음',
  recommended_next: '기본 다음 단계가 아닌 단계를 추천함',
  background: '턴이 끝날 때 백그라운드 작업이나 예약된 깨우기가 남아 있었음',
  completion_unknown: 'Codex의 미완료 작업 여부를 확인할 수 없어 사람이 승인해야 함',
  invalid: '다시 읽은 handoff가 유효하지 않음',
  cancel: '[취소]를 누름',
  interrupt: '[즉시 중단]을 누름',
  quit: '카운트다운 중에 앱을 끔',
  step: '[단계 선택]을 누름',
  session: '카운트다운 중에 세션이 끝남',
  settings: '카운트다운 중에 자동 승인을 끔',
  restart: '앱을 다시 켜며 승인 대기가 됨 (재시작 경로는 자동 승인하지 않음)',
  operation: '끊긴 작업이 있음',
  pr_closed: 'PR이 닫혀 있음 (닫힌 PR은 승인을 받지 않음, D179)',
}

/** 사람이 앱에서 한 일이라 알리지 않는 까닭 (D130, D145). 재시작 조정은 알리지 않는다 (D121) */
const QUIET_HOLDS: readonly AutoHoldReason[] = [
  'cancel',
  'interrupt',
  'quit',
  'step',
  'settings',
  'restart',
]

/** 이 까닭으로 자동 승인하지 않았으면 알린다: 사람이 누르지 않았는데 사람이 필요해졌다 (D81, D130) */
export function holdNeedsNotice(reasons: readonly AutoHoldReason[]): boolean {
  return reasons.some((r) => !QUIET_HOLDS.includes(r))
}

/** 자동 승인하지 않은 까닭을 한 줄로 */
export function holdText(reasons: readonly AutoHoldReason[]): string {
  return reasons.map((r) => AUTO_HOLD_LABEL[r]).join(', ')
}

export interface AutoApproveNote {
  /** 지금 설정으로 자동 승인이 켜진 단계다 */
  on: boolean
  /** 켜진 단계의 승인 대기인데 카운트다운하지 않는 까닭. 카운트다운 중이거나 할 말이 없으면 null */
  hold: string | null
}

/**
 * 승인 화면의 자동 승인 안내 (D83, D128~D131). 켜진 단계의 승인 대기인데 카운트다운하지 않으면 까닭을 보인다.
 * 까닭이 적혀 있지 않으면 자동 승인을 켜기 전에 턴이 끝난 것이다 (D128). 승인한 뒤 push나 답글 게시가 실패해 승인
 * 대기로 남은 PR 대응 task는 보이지 않는다: 세션이 끝나 판정할 턴이 없고, 실패와 [다시 시도]는 강조 영역이 보인다
 */
export function autoApproveNote(
  work: Pick<WorkState, 'settings'>,
  task: Pick<TaskRecord, 'node' | 'status' | 'countdown' | 'auto_hold' | 'respond' | 'engine'>,
  config: AppConfig,
): AutoApproveNote {
  const engine = knownTaskEngine(task)
  const on = approvalMode(config, work.settings, task.node, engine) === 'auto'
  if (engine === null)
    return { on: false, hold: `${agentLabel(task)}. 이 세션은 재개할 수 없습니다.` }
  if (engine === 'codex') {
    return {
      on: false,
      hold:
        task.status === 'awaiting_approval' && !task.respond?.failure
          ? AGENT_APPROVAL_NOTICE
          : null,
    }
  }
  if (!on || task.status !== 'awaiting_approval' || task.countdown || task.respond?.failure) {
    return { on, hold: null }
  }
  const next = '다음 턴이 끝날 때 다시 판정합니다.'
  const hold = task.auto_hold
    ? `자동 승인하지 않음: ${holdText(task.auto_hold.reasons)}. ${next}`
    : `자동 승인은 턴이 끝날 때 판정합니다. 이 결과는 사람이 승인합니다. ${next}`
  return { on, hold }
}

// ---------- 사이드바 배지 (D80) ----------

/**
 * 배지 우선순위 (D80, D121, D183). 상태가 겹치면 앞의 것을 보인다:
 * 끊긴 작업 > 질문 대기·입력 필요 > 승인 대기 > 막힘 > 멈춤 > 자동 대응 멈춤 > 대응 거리 있음 > PR 닫힘 >
 * 머지 가능 > 세션 종료(handoff 없음) > 작업 중 > 대기 > 대기열 > 리뷰·CI 대기 > 중단됨 > 완료·포기·보관됨
 */
export const BADGE_ORDER: readonly BadgeKind[] = [
  'recovery',
  'asking',
  'awaiting_approval',
  'blocked',
  'stopped',
  'auto_paused',
  'pr_items',
  'pr_closed',
  'mergeable',
  'session_ended',
  'working',
  'idle',
  'queued',
  'pr_waiting',
  'interrupted',
  'done',
]

/**
 * 사람이 필요한 상태. 색으로 강조한다 (D80, D183). 끊긴 작업은 재시작 조정과 코드를 바꾼 뒤 실패한 되감기(D136)에서
 * 생기고, 재시작 조정은 알리지 않는다 (D121). OS 알림은 task 상태는 배지가 바뀔 때(D81), PR 진행은 읽은 결과로(D184) 보낸다
 */
export const HUMAN_BADGES: readonly BadgeKind[] = [
  'recovery',
  'asking',
  'awaiting_approval',
  'blocked',
  'stopped',
  'auto_paused',
  'pr_items',
  'pr_closed',
  'mergeable',
  'session_ended',
]

const TASK_BADGE: Readonly<Record<TaskStatus, BadgeKind | null>> = {
  asking: 'asking',
  input_needed: 'asking',
  awaiting_approval: 'awaiting_approval',
  blocked: 'blocked',
  session_ended: 'session_ended',
  working: 'working',
  idle: 'idle',
  queued: 'queued',
  interrupted: 'interrupted',
  approved: null,
  discarded: null,
}

const BADGE_LABEL: Readonly<Record<BadgeKind, string>> = {
  recovery: '끊긴 작업',
  asking: '질문 대기',
  awaiting_approval: '승인 대기',
  blocked: '막힘',
  stopped: '멈춤',
  auto_paused: '자동 대응 멈춤',
  session_ended: '세션 종료',
  working: '작업 중',
  idle: '대기',
  queued: '대기열',
  pr_items: '대응 거리 있음',
  pr_closed: 'PR 닫힘',
  mergeable: '머지 가능',
  pr_waiting: '리뷰·CI 대기',
  interrupted: '중단됨',
  done: '완료',
}

const DONE_LABEL: Readonly<Partial<Record<WorkState['status'], string>>> = {
  completed: '완료',
  abandoned: '포기',
  archived: '보관됨',
}

/**
 * Work의 배지 (D80). 끊긴 작업이 있으면 끝난 Work라도 "끊긴 작업"이다 (D121). 끝난 Work(완료, 포기, 보관됨)는
 * 그 상태를 보이고, 그 밖에는 Work의 멈춤과 지금 task의 표시 가운데 우선순위가 앞선 것을 보인다.
 * 입력 필요는 질문 대기와 같은 자리에 "입력 필요"로 보인다. PR 진행인 Work는 PR의 세부 상태(core/pr prBadgeKind,
 * D183)를 main이 넘긴다. 넘기지 않으면 리뷰·CI 대기다. PR 대응 task가 끝나기 전까지는 그 task의 상태만 보인다 (D183)
 */
export function badge(work: WorkState, pr?: BadgeKind): Badge {
  if (work.operation?.interrupted_at !== undefined) {
    return { kind: 'recovery', label: BADGE_LABEL.recovery, hot: true }
  }
  const done = DONE_LABEL[work.status]
  if (done) return { kind: 'done', label: done, hot: false }
  const task = work.tasks[work.tasks.length - 1]
  const kinds: BadgeKind[] = []
  if (work.status === 'stopped') kinds.push('stopped')
  if (work.status === 'pr' && !(task && isRespondPending(task))) kinds.push(pr ?? 'pr_waiting')
  const fromTask = task ? TASK_BADGE[task.status] : null
  if (fromTask) kinds.push(fromTask)
  const kind = [...BADGE_ORDER].find((k) => kinds.includes(k)) ?? 'working'
  const label =
    kind === 'asking' && task?.status === 'input_needed' ? '입력 필요' : BADGE_LABEL[kind]
  return { kind, label, hot: HUMAN_BADGES.includes(kind) }
}
