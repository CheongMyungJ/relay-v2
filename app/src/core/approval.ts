// 수동 승인의 판정 (4.1, D90, D112)과 사이드바 배지의 우선순위 (D80).
// machine의 승인과 승인 화면의 버튼이 같은 판정을 쓴다. 자동 승인 조건(4.3)은 M7에서 더한다.
import type { Size } from '../shared/contracts'
import type { ApprovalGate, Badge, BadgeKind } from '../shared/views'
import type { CheckSummary, FormatIssue, TaskRecord, TaskStatus, WorkState } from '../shared/work'
import { INTENT_DRAFT_FILE } from './validate'

export type { ApprovalGate, Badge, BadgeKind }

/**
 * 에이전트가 턴을 끝낸 뒤라 사람이 승인할 수 있는 상태 (D112).
 * 형식 오류가 끝까지 남으면 Stop 뒤에는 대기, 세션이 끝났으면 세션 종료로 남는다 (4.1).
 */
export const REVIEWABLE: readonly TaskStatus[] = ['awaiting_approval', 'idle', 'session_ended']

/** 사람이 승인 화면에서 size를 고르면 풀리는 오류: intent 초안 머리글의 size (4.1) */
export function resolvedBySize(issue: FormatIssue): boolean {
  return issue.file === INTENT_DRAFT_FILE && issue.part === 'header' && issue.field === 'size'
}

/**
 * 넘길 수 없는 오류 (D90): intake에서 intent 초안의 머리글 오류와 초안 없음.
 * 머리글이 틀리거나 초안이 없으면 앱이 intent.md를 만들 수 없다.
 */
function unignorable(node: TaskRecord['node'], issue: FormatIssue): boolean {
  return node === 'intake' && issue.file === INTENT_DRAFT_FILE && issue.part !== 'body'
}

/**
 * 승인 버튼의 판정. check는 판정하는 때에 다시 한 형식 검사이고,
 * size는 intake에서 사람이 고른 크기다. 다른 노드에서는 넘기지 않는다.
 * - [승인]: handoff가 awaiting_approval이고 남은 오류가 없다.
 * - [오류 무시하고 승인]: handoff가 있고 오류가 남았으며, 넘길 수 없는 오류가 없다.
 *   status가 blocked로 읽히면 주지 않는다 (4.4). 머리글을 읽을 수 없는 경우는 준다 (D112).
 */
export function approvalGate(
  task: Pick<TaskRecord, 'node' | 'status'>,
  check: CheckSummary,
  size?: Size,
): ApprovalGate {
  const errors =
    size && task.node === 'intake' ? check.errors.filter((e) => !resolvedBySize(e)) : check.errors
  const blocking = errors.filter((e) => unignorable(task.node, e))
  const ready = REVIEWABLE.includes(task.status) && check.handoff_present
  return {
    approve: ready && check.status === 'awaiting_approval' && errors.length === 0,
    force: ready && check.status !== 'blocked' && errors.length > 0 && blocking.length === 0,
    errors,
    blocking,
  }
}

// ---------- 사이드바 배지 (D80) ----------

/**
 * 배지 우선순위 (D80). 상태가 겹치면 앞의 것을 보인다:
 * 질문 대기·입력 필요 > 승인 대기 > 막힘 > 멈춤 > 세션 종료(handoff 없음) > 작업 중 > 대기 > 대기열 > 중단됨 > 완료·포기
 */
export const BADGE_ORDER: readonly BadgeKind[] = [
  'asking',
  'awaiting_approval',
  'blocked',
  'stopped',
  'session_ended',
  'working',
  'idle',
  'queued',
  'interrupted',
  'done',
]

/** 사람이 필요한 상태. 색으로 강조하고 OS 알림을 보낸다 (D80, D81) */
export const HUMAN_BADGES: readonly BadgeKind[] = BADGE_ORDER.slice(0, 5)

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
}

const BADGE_LABEL: Readonly<Record<BadgeKind, string>> = {
  asking: '질문 대기',
  awaiting_approval: '승인 대기',
  blocked: '막힘',
  stopped: '멈춤',
  session_ended: '세션 종료',
  working: '작업 중',
  idle: '대기',
  queued: '대기열',
  interrupted: '중단됨',
  done: '완료',
}

/**
 * Work의 배지 (D80). 끝난 Work(완료, 포기)는 그 상태를 보이고, 그 밖에는 Work의 멈춤과 지금 task의
 * 표시 가운데 우선순위가 앞선 것을 보인다. 입력 필요는 질문 대기와 같은 자리에 "입력 필요"로 보인다.
 */
export function badge(work: WorkState): Badge {
  if (work.status === 'completed' || work.status === 'abandoned') {
    return { kind: 'done', label: work.status === 'completed' ? '완료' : '포기', hot: false }
  }
  const task = work.tasks[work.tasks.length - 1]
  const kinds: BadgeKind[] = []
  if (work.status === 'stopped') kinds.push('stopped')
  const fromTask = task ? TASK_BADGE[task.status] : null
  if (fromTask) kinds.push(fromTask)
  const kind = [...BADGE_ORDER].find((k) => kinds.includes(k)) ?? 'working'
  const label =
    kind === 'asking' && task?.status === 'input_needed' ? '입력 필요' : BADGE_LABEL[kind]
  return { kind, label, hot: HUMAN_BADGES.includes(kind) }
}
