// 버그 수정 파이프라인: 노드 순서와 선택 가능한 다음 단계 (3.1, 3.2).
// 경로는 하나다. 크기(size)는 없다 (D227).
// PR 대응 task(노드 respond)는 파이프라인 밖이다 (D187, D188): 순서, 단계 선택에 없고 선택 가능한 다음 단계가 없다.
import type { SkillName } from '../shared/config'
import type { NodeName, TaskNode } from '../shared/contracts'

export interface NodeInfo {
  node: TaskNode
  skill: SkillName
  /** 화면 이름 (D109) */
  title: string
  /** 필수 산출물 (3.1). awaiting_approval일 때 task 디렉터리에 있어야 한다 (D30) */
  artifacts: readonly string[]
}

/**
 * 파이프라인 순서 (3.1, D227). 모든 Work가 이 순서를 모두 지난다. 되감기와 건너뛰기, 이전 단계는 이 순서로
 * 가른다(6.2). fix는 재현과 원인 분석을 함께 하고(D228), verify는 리뷰와 최종 검증을 함께 한다 (D229)
 */
export const NODES: readonly NodeName[] = ['intake', 'fix', 'verify']

/** PR 대응 task의 노드 (D187). 파이프라인 밖이다 (D188) */
export const RESPOND = 'respond' as const

/** 파이프라인 노드인가. PR 대응(respond)은 아니다 (D188) */
export function isPipelineNode(node: TaskNode): node is NodeName {
  return node !== RESPOND
}

export const NODE_INFO: Readonly<Record<TaskNode, NodeInfo>> = {
  intake: {
    node: 'intake',
    skill: 'work-start',
    title: '의도 정리',
    artifacts: ['intent.draft.md'],
  },
  fix: { node: 'fix', skill: 'fix', title: '원인 분석과 수정', artifacts: ['fix.md'] },
  verify: {
    node: 'verify',
    skill: 'verify',
    title: '리뷰와 검증',
    artifacts: ['review.md', 'verification.md', 'pr.md'],
  },
  // replies.md는 이번 라운드에 코멘트 항목이 있을 때만 필수다 (5.2, D190). core/validate가 본다
  respond: { node: 'respond', skill: 'pr-respond', title: 'PR 대응', artifacts: ['response.md'] },
}

/** verify의 기본 다음 단계 (3.2) */
export const WORK_COMPLETE = 'complete'

export type NextStep = NodeName | typeof WORK_COMPLETE

/** 기본 다음 단계 (3.2): 파이프라인에서 node 다음 단계. verify 다음은 Work 완료다 */
export function defaultNext(node: NodeName): NextStep {
  return NODES[NODES.indexOf(node) + 1] ?? WORK_COMPLETE
}

/** 이전 단계 (3.2): node보다 앞의 모든 단계 */
export function previousSteps(node: NodeName): NodeName[] {
  return NODES.slice(0, NODES.indexOf(node))
}

export interface SelectableNext {
  defaultNext: NextStep
  previous: NodeName[]
}

/** 선택 가능한 다음 단계 (3.2). context.md에 넣고, handoff의 recommended_next는 이 안에서 고른다 */
export function selectableNext(node: NodeName): SelectableNext {
  return { defaultNext: defaultNext(node), previous: previousSteps(node) }
}

/**
 * recommended_next.node로 쓸 수 있는 노드: 이전 단계와, 노드라면 기본 다음 단계. PR 대응 task는 선택 가능한 다음 단계가
 * 없어 null만 쓴다 (3.2, D188)
 */
export function recommendableNodes(node: TaskNode): NodeName[] {
  if (!isPipelineNode(node)) return []
  const { defaultNext: next, previous } = selectableNext(node)
  return next === WORK_COMPLETE ? previous : [...previous, next]
}

/** to가 from보다 앞 단계인가. 에이전트가 이전 단계를 추천하면 앱은 멈춘다 (D23). PR 대응 task에는 앞 단계가 없다 */
export function isPrevious(from: TaskNode, to: NodeName): boolean {
  return isPipelineNode(from) && NODES.indexOf(to) < NODES.indexOf(from)
}
