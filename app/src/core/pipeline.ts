// 버그 수정 파이프라인: 노드 순서, 크기별 경로, 선택 가능한 다음 단계 (3.1, 3.2, 3.4).
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

/**
 * 파이프라인 순서 (3.1). 되감기와 건너뛰기, 이전 단계는 이 순서로 가른다(6.2). investigate는 M 경로에서
 * evidence와 rca를 대신하고(D147), 한 Work는 크기에 따라 둘 중 한쪽만 지난다(steps)
 */
export const NODES: readonly NodeName[] = [
  'intake',
  'investigate',
  'evidence',
  'rca',
  'fix',
  'verify',
]

export const NODE_INFO: Readonly<Record<NodeName, NodeInfo>> = {
  intake: {
    node: 'intake',
    skill: 'work-start',
    title: '의도 정리',
    artifacts: ['intent.draft.md'],
  },
  investigate: {
    node: 'investigate',
    skill: 'investigate',
    title: '재현과 원인 분석',
    artifacts: ['evidence.md', 'rca.md'],
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

/**
 * 이 크기의 Work가 고를 수 있는 단계 (3.4, D149). 경로(route)의 단계에 더해, S는 fix가 막혔을 때 되돌아갈
 * investigate를 가진다(D66). M은 evidence와 rca를, L은 investigate를 고를 수 없다. 같은 산출물(evidence.md,
 * rca.md)을 쓰는 task가 한 Work에 둘 생기지 않게 하려는 것이다. 크기를 바꾸려면 intake로 되감는다 (6.3)
 */
const STEPS: Readonly<Record<Size, readonly NodeName[]>> = {
  S: ['intake', 'investigate', 'fix', 'verify'],
  M: ['intake', 'investigate', 'fix', 'verify'],
  L: ['intake', 'evidence', 'rca', 'fix', 'verify'],
}

/** S 빠른 경로에서 건너뛰는 노드 (3.4) */
const SKIPPED_ON_S: readonly NodeName[] = ['investigate']

/** 이 크기의 Work가 고를 수 있는 단계. 파이프라인 순서다 (D149) */
export function steps(size: Size): NodeName[] {
  return [...STEPS[size]]
}

/**
 * 이 크기로 지나는 노드 (3.4). S는 intake → fix → verify, M은 evidence와 rca를 합친 investigate를 지나고(D147),
 * L은 evidence와 rca를 따로 지난다
 */
export function route(size: Size): NodeName[] {
  return steps(size).filter((n) => size !== 'S' || !SKIPPED_ON_S.includes(n))
}

/** 기본 다음 단계 (3.2): 이 크기의 경로에서 node 다음 단계. verify 다음은 Work 완료다 */
export function defaultNext(node: NodeName, size: Size): NextStep {
  const onRoute = route(size)
  return NODES.slice(NODES.indexOf(node) + 1).find((n) => onRoute.includes(n)) ?? WORK_COMPLETE
}

/**
 * 이전 단계 (3.2, D149): 이 크기가 고를 수 있는 단계 가운데 node보다 앞의 모든 단계.
 * S 경로에서 건너뛴 investigate도 넣는다
 */
export function previousSteps(node: NodeName, size: Size): NodeName[] {
  const selectable = steps(size)
  return NODES.slice(0, NODES.indexOf(node)).filter((n) => selectable.includes(n))
}

export interface SelectableNext {
  defaultNext: NextStep
  previous: NodeName[]
}

/** 선택 가능한 다음 단계 (3.2). context.md에 넣고, handoff의 recommended_next는 이 안에서 고른다 */
export function selectableNext(node: NodeName, size: Size): SelectableNext {
  return { defaultNext: defaultNext(node, size), previous: previousSteps(node, size) }
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
