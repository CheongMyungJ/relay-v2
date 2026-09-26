// 버그 수정 파이프라인: 노드 순서, S 빠른 경로, 선택 가능한 다음 단계 (3.1, 3.2, 3.4).
import type { SkillName } from '../shared/config'
import type { NodeName, Size } from '../shared/contracts'

export interface NodeInfo {
  node: NodeName
  skill: SkillName
  /** 화면 이름 (D109) */
  title: string
  /** 필수 산출물 (3.1). awaiting_approval일 때 task 디렉터리에 있어야 한다 (D30) */
  artifacts: readonly string[]
}

/** 파이프라인 순서 (3.1) */
export const NODES: readonly NodeName[] = ['intake', 'evidence', 'rca', 'fix', 'verify']

export const NODE_INFO: Readonly<Record<NodeName, NodeInfo>> = {
  intake: {
    node: 'intake',
    skill: 'work-start',
    title: '의도 정리',
    artifacts: ['intent.draft.md'],
  },
  evidence: {
    node: 'evidence',
    skill: 'evidence',
    title: '재현과 관찰',
    artifacts: ['evidence.md'],
  },
  rca: { node: 'rca', skill: 'root-cause', title: '원인 분석', artifacts: ['rca.md'] },
  fix: { node: 'fix', skill: 'fix', title: '수정', artifacts: ['fix.md'] },
  verify: {
    node: 'verify',
    skill: 'final-verify',
    title: '최종 검증',
    artifacts: ['verification.md', 'pr.md'],
  },
}

/** verify의 기본 다음 단계 (3.2) */
export const WORK_COMPLETE = 'complete'

export type NextStep = NodeName | typeof WORK_COMPLETE

/** S 빠른 경로에서 건너뛰는 노드 (3.4) */
const SKIPPED_ON_S: readonly NodeName[] = ['evidence', 'rca']

/** 이 크기로 지나는 노드 (3.4). S는 evidence와 rca를 건너뛰고, L은 M과 같다 */
export function route(size: Size): NodeName[] {
  return size === 'S' ? NODES.filter((n) => !SKIPPED_ON_S.includes(n)) : [...NODES]
}

/** 기본 다음 단계 (3.2): 파이프라인 순서상 다음 단계. S면 건너뛰기를 반영하고, verify 다음은 Work 완료다 */
export function defaultNext(node: NodeName, size: Size): NextStep {
  const onRoute = route(size)
  return NODES.slice(NODES.indexOf(node) + 1).find((n) => onRoute.includes(n)) ?? WORK_COMPLETE
}

/** 이전 단계 (3.2): 파이프라인에서 node보다 앞의 모든 단계. S 경로에서 건너뛴 evidence와 rca도 넣는다 */
export function previousSteps(node: NodeName): NodeName[] {
  return NODES.slice(0, NODES.indexOf(node))
}

export interface SelectableNext {
  defaultNext: NextStep
  previous: NodeName[]
}

/** 선택 가능한 다음 단계 (3.2). context.md에 넣고, handoff의 recommended_next는 이 안에서 고른다 */
export function selectableNext(node: NodeName, size: Size): SelectableNext {
  return { defaultNext: defaultNext(node, size), previous: previousSteps(node) }
}

/** recommended_next.node로 쓸 수 있는 노드: 이전 단계와, 노드라면 기본 다음 단계 */
export function recommendableNodes(node: NodeName, size: Size): NodeName[] {
  const { defaultNext: next, previous } = selectableNext(node, size)
  return next === WORK_COMPLETE ? previous : [...previous, next]
}

/** to가 from보다 앞 단계인가. 에이전트가 이전 단계를 추천하면 앱은 멈춘다 (D23) */
export function isPrevious(from: NodeName, to: NodeName): boolean {
  return NODES.indexOf(to) < NODES.indexOf(from)
}
