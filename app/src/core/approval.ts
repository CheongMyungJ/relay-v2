// 수동 승인의 판정 (4.1, D90, D112). machine의 승인과 승인 화면의 버튼이 같은 판정을 쓴다.
// 자동 승인 조건(4.3)은 M7에서 더한다.
import type { Size } from '../shared/contracts'
import type { ApprovalGate } from '../shared/views'
import type { CheckSummary, FormatIssue, TaskRecord, TaskStatus } from '../shared/work'
import { INTENT_DRAFT_FILE } from './validate'

export type { ApprovalGate }

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
