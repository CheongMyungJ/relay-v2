// 업무 유형별 파이프라인: 노드 순서와 선택 가능한 다음 단계 (3.1, 3.2, D232).
// 유형마다 경로는 하나다. 크기(size)는 없다 (D227). 순서에 기대는 함수는 유형을 함께 받는다 (I57).
// PR 대응 task(노드 respond)는 파이프라인 밖이다 (D187, D188): 순서, 단계 선택에 없고 선택 가능한 다음 단계가 없다.
import type { SkillName } from '../shared/config'
import type { NodeName, TaskNode } from '../shared/contracts'
import type { WorkState, WorkType } from '../shared/work'

export interface NodeInfo {
  node: TaskNode
  skill: SkillName
  /** 화면 이름 (D109) */
  title: string
  /** 필수 산출물 (3.1). awaiting_approval일 때 task 디렉터리에 있어야 한다 (D30) */
  artifacts: readonly string[]
}

/**
 * 유형별 파이프라인 순서 (3.1, D227, D232). Work는 그 유형의 순서를 모두 지난다. 되감기와 건너뛰기, 이전 단계는 이
 * 순서로 가른다(6.2). fix는 재현과 원인 분석을 함께 하고(D228), design은 설계와 구현 계획을 함께 하고(D232),
 * verify는 리뷰와 최종 검증을 함께 한다 (D229)
 */
export const PIPELINES: Readonly<Record<WorkType, readonly NodeName[]>> = {
  bugfix: ['intake', 'fix', 'verify'],
  feature: ['intake', 'design', 'implement', 'verify'],
}

/** 모든 파이프라인 노드. 노드 이름이 맞는지만 볼 때 쓴다 (I57) */
export const ALL_NODES: readonly NodeName[] = ['intake', 'fix', 'design', 'implement', 'verify']

/** Work의 업무 유형. work.json에 type이 없으면 버그 수정이다 (D256, I58) */
export function workType(work: Pick<WorkState, 'type'>): WorkType {
  return work.type ?? 'bugfix'
}

/** 그 유형의 파이프라인에 있는 노드인가 */
export function inPipeline(type: WorkType, node: TaskNode): node is NodeName {
  return (PIPELINES[type] as readonly TaskNode[]).includes(node)
}

/**
 * [현재 코드 위에서 이어서](6.2)를 주는 단계: 버그 수정의 fix, 기능 추가의 design과 implement (D254).
 * design은 코드를 바꾸지 않고 design.md만 고치며, 이어지는 implement가 그 코드 위에서 고친다
 */
export const KEEP_CODE_NODES: Readonly<Record<WorkType, readonly NodeName[]>> = {
  bugfix: ['fix'],
  feature: ['design', 'implement'],
}

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
  design: { node: 'design', skill: 'design', title: '설계와 계획', artifacts: ['design.md'] },
  implement: { node: 'implement', skill: 'implement', title: '구현', artifacts: ['implement.md'] },
  verify: {
    node: 'verify',
    skill: 'verify',
    title: '리뷰와 검증',
    artifacts: ['verification.md', 'pr.md'],
  },
  // replies.md는 이번 라운드에 코멘트 항목이 있을 때만 필수다 (5.2, D190). core/validate가 본다
  respond: { node: 'respond', skill: 'pr-respond', title: 'PR 대응', artifacts: ['response.md'] },
}

/** verify의 기본 다음 단계 (3.2) */
export const WORK_COMPLETE = 'complete'

export type NextStep = NodeName | typeof WORK_COMPLETE

const order = (type: WorkType, node: NodeName) => PIPELINES[type].indexOf(node)

/**
 * 기본 다음 단계 (3.2): 그 유형의 파이프라인에서 node 다음 단계. verify 다음은 Work 완료다. 파이프라인에 없는
 * 노드는 다음 단계가 없어 Work 완료로 본다
 */
export function defaultNext(type: WorkType, node: NodeName): NextStep {
  const i = order(type, node)
  return i < 0 ? WORK_COMPLETE : (PIPELINES[type][i + 1] ?? WORK_COMPLETE)
}

/** 이전 단계 (3.2): 그 유형의 파이프라인에서 node보다 앞의 모든 단계 */
export function previousSteps(type: WorkType, node: NodeName): NodeName[] {
  const i = order(type, node)
  return i < 0 ? [] : PIPELINES[type].slice(0, i)
}

export interface SelectableNext {
  defaultNext: NextStep
  previous: NodeName[]
}

/** 선택 가능한 다음 단계 (3.2). context.md에 넣고, handoff의 recommended_next는 이 안에서 고른다 */
export function selectableNext(type: WorkType, node: NodeName): SelectableNext {
  return { defaultNext: defaultNext(type, node), previous: previousSteps(type, node) }
}

/**
 * recommended_next.node로 쓸 수 있는 노드: 이전 단계와, 노드라면 기본 다음 단계. PR 대응 task는 선택 가능한 다음 단계가
 * 없어 null만 쓴다 (3.2, D188)
 */
export function recommendableNodes(type: WorkType, node: TaskNode): NodeName[] {
  if (!isPipelineNode(node)) return []
  const { defaultNext: next, previous } = selectableNext(type, node)
  return next === WORK_COMPLETE ? previous : [...previous, next]
}

/**
 * to가 그 유형의 파이프라인에서 from보다 앞 단계인가. 에이전트가 이전 단계를 추천하면 앱은 멈춘다 (D23).
 * PR 대응 task에는 앞 단계가 없다
 */
export function isPrevious(type: WorkType, from: TaskNode, to: NodeName): boolean {
  if (!isPipelineNode(from) || !inPipeline(type, to) || !inPipeline(type, from)) return false
  return order(type, to) < order(type, from)
}
