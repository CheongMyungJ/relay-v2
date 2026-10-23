// 업무 유형별 파이프라인: 노드 순서와 다음 단계 (3.1, 3.2, D232).
// 유형마다 경로는 하나이고 앞으로만 간다 (D227, D418). 순서에 기대는 함수는 유형을 함께 받는다 (I57).
// PR 대응 task(노드 respond)는 파이프라인 밖이다 (D187, D188): 순서에 없고 다음 단계가 없다.
// 커스텀 유형(D447)은 노드 custom을 단계 수만큼 지나고, 단계마다의 이름과 산출물은 work.json의 custom_type에서 읽는다 (D458, D462).
import type { SkillName } from '../shared/config'
import type { NodeName, TaskNode } from '../shared/contracts'
import type { CustomStep, TaskRecord, WorkState, WorkType } from '../shared/work'

export interface NodeInfo {
  node: TaskNode
  skill: SkillName
  /** 화면 이름 (D109) */
  title: string
  /** 필수 산출물 (3.1). awaiting_approval일 때 task 디렉터리에 있어야 한다 (D30) */
  artifacts: readonly string[]
}

/**
 * 유형별 파이프라인 순서 (3.1, D227, D232). Work는 그 유형의 순서를 앞으로만 모두 지난다 (D418). fix는 재현과 원인 분석을 함께 하고(D228), design은 설계와 구현 계획을 함께 하고(D232),
 * refactor는 계획, 안전망, 구조 변경을 함께 하고(D258), spec은 주제 목록과 문답과 설계 문서 쓰기를 함께 하고(D350, D352),
 * execute는 진행 방식을 정하지 않고 계획과 작업을 함께 하고(D302), verify는 리뷰와 최종 검증을 함께 한다 (D229)
 */
export const PIPELINES: Readonly<Record<WorkType, readonly NodeName[]>> = {
  bugfix: ['intake', 'fix', 'verify'],
  feature: ['intake', 'design', 'implement', 'verify'],
  refactor: ['intake', 'refactor', 'verify'],
  spec: ['intake', 'spec', 'verify'],
  general: ['intake', 'execute', 'verify'],
  // 커스텀 단계는 단계마다 custom이 하나씩 든다. 실제 순서는 stagesOf가 Work의 custom_type에서 만든다
  custom: ['intake', 'custom', 'verify'],
}

/** Work의 업무 유형. work.json에 type이 없으면 버그 수정이다 (D256, I58) */
export function workType(work: Pick<WorkState, 'type'>): WorkType {
  return work.type ?? 'bugfix'
}

/** 그 유형의 파이프라인에 있는 노드인가 */
export function inPipeline(type: WorkType, node: TaskNode): node is NodeName {
  return (PIPELINES[type] as readonly TaskNode[]).includes(node)
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
  refactor: {
    node: 'refactor',
    skill: 'refactor',
    title: '계획과 리팩터링',
    artifacts: ['refactor.md'],
  },
  spec: { node: 'spec', skill: 'spec', title: '설계 문답', artifacts: ['spec.md'] },
  execute: { node: 'execute', skill: 'execute', title: '실행', artifacts: ['execution.md'] },
  // 산출물은 단계마다 <단계 id>.md다 (D453). taskArtifacts가 task의 step으로 정한다
  custom: { node: 'custom', skill: 'custom', title: '커스텀 단계', artifacts: [] },
  verify: {
    node: 'verify',
    skill: 'verify',
    title: '리뷰와 검증',
    artifacts: ['verification.md', 'pr.md'],
  },
  // replies.md는 이번 라운드에 코멘트 항목이 있을 때만 필수다 (5.2, D190). core/validate가 본다
  respond: { node: 'respond', skill: 'pr-respond', title: 'PR 대응', artifacts: ['response.md'] },
}

/**
 * 모든 파이프라인 노드. 노드 이름이 맞는지만 볼 때 쓴다 (I57). 어떤 노드가 드는지는 PIPELINES에서 파생해 따로 고치지
 * 않고, 순서는 NODE_INFO(화면 목록의 순서)를 따른다
 */
export const ALL_NODES: readonly NodeName[] = (Object.keys(NODE_INFO) as TaskNode[]).filter(
  (n): n is NodeName =>
    Object.values(PIPELINES).some((p) => (p as readonly TaskNode[]).includes(n)),
)

/** verify의 기본 다음 단계 (3.2) */
export const WORK_COMPLETE = 'complete'

export type NextStep = NodeName | typeof WORK_COMPLETE

/** 그 유형의 파이프라인에서 node의 순서. 없으면 -1이다 */
export const order = (type: WorkType, node: NodeName) => PIPELINES[type].indexOf(node)

/**
 * 기본 다음 단계 (3.2): 그 유형의 파이프라인에서 node 다음 단계. verify 다음은 Work 완료다. 파이프라인에 없는
 * 노드는 다음 단계가 없어 Work 완료로 본다. 커스텀 유형은 단계가 여럿이라 nextStage를 쓴다
 */
export function defaultNext(type: WorkType, node: NodeName): NextStep {
  const i = order(type, node)
  return i < 0 ? WORK_COMPLETE : (PIPELINES[type][i + 1] ?? WORK_COMPLETE)
}

/** 파이프라인의 한 자리: 노드와, 커스텀 단계면 단계 id (D462) */
export interface Stage {
  node: NodeName
  step?: string
}

/**
 * Work의 파이프라인 자리 순서. 기본 유형은 PIPELINES이고, 커스텀 유형은 intake, 복사한 단계마다 custom, verify다
 * (D447, D458). 커스텀인데 custom_type이 없으면(깨진 기록) 가운데 단계 없이 intake, verify다
 */
export function stagesOf(work: Pick<WorkState, 'type' | 'custom_type'>): Stage[] {
  const type = workType(work)
  if (type !== 'custom') return PIPELINES[type].map((node) => ({ node }))
  const steps = work.custom_type?.steps ?? []
  return [
    { node: 'intake' },
    ...steps.map((s): Stage => ({ node: 'custom', step: s.id })),
    { node: 'verify' },
  ]
}

/** 같은 자리인가 */
const sameStage = (a: Stage, b: Stage) => a.node === b.node && (a.step ?? '') === (b.step ?? '')

/**
 * 기본 다음 단계 (3.2)를 Work에서 정한다: 기본 유형은 defaultNext와 같고, 커스텀 유형은 다음 커스텀 단계나 verify다.
 * 파이프라인에 없는 자리는 Work 완료다
 */
export function nextStage(
  work: Pick<WorkState, 'type' | 'custom_type'>,
  from: Stage,
): Stage | typeof WORK_COMPLETE {
  const stages = stagesOf(work)
  const i = stages.findIndex((s) => sameStage(s, from))
  return i < 0 ? WORK_COMPLETE : (stages[i + 1] ?? WORK_COMPLETE)
}

/** task의 자리 */
export const stageOf = (task: Pick<TaskRecord, 'node' | 'step'>): Stage | null =>
  isPipelineNode(task.node)
    ? { node: task.node, ...(task.step !== undefined ? { step: task.step } : {}) }
    : null

/** 커스텀 단계 task의 단계 정의. 커스텀 단계가 아니거나 정의에 없으면 undefined다 */
export function customStep(
  work: Pick<WorkState, 'custom_type'>,
  task: Pick<TaskRecord, 'node' | 'step'>,
): CustomStep | undefined {
  if (task.node !== 'custom') return undefined
  return work.custom_type?.steps.find((s) => s.id === task.step)
}

/** task의 화면 이름 (D109). 커스텀 단계는 type.json의 이름이고, task를 만들 때 옮긴 것을 쓴다 (D462) */
export function nodeTitle(task: Pick<TaskRecord, 'node' | 'step' | 'step_title'>): string {
  if (task.node !== 'custom') return NODE_INFO[task.node].title
  return task.step_title ?? task.step ?? NODE_INFO.custom.title
}

/** task의 화면 이름. 옮긴 이름이 없는 커스텀 단계 task는 Work의 정의에서 찾는다 */
export function taskTitle(
  work: Pick<WorkState, 'custom_type'>,
  task: Pick<TaskRecord, 'node' | 'step' | 'step_title'>,
): string {
  return task.step_title ?? customStep(work, task)?.title ?? nodeTitle(task)
}

/** 자리의 화면 이름. 커스텀 단계는 Work의 정의에서 찾는다 */
export function stageTitle(work: Pick<WorkState, 'custom_type'>, stage: Stage): string {
  return taskTitle(work, stage)
}

/** 커스텀 단계 산출물의 기본 절 (D453) */
export const CUSTOM_DEFAULT_SECTIONS: readonly string[] = ['한 일', '완료조건별 자체 확인']

/** 커스텀 단계의 산출물 파일 이름 (D453) */
export const customArtifact = (step: string) => `${step}.md`

/** task의 필수 산출물 (3.1). 커스텀 단계는 <단계 id>.md 하나다 (D453) */
export function taskArtifacts(task: Pick<TaskRecord, 'node' | 'step'>): readonly string[] {
  return task.node === 'custom' && task.step
    ? [customArtifact(task.step)]
    : NODE_INFO[task.node].artifacts
}

/** 커스텀 단계 산출물의 절. 정의가 비었으면 기본 두 절이다 (D453) */
export function customSections(step: { readonly sections: readonly string[] }): readonly string[] {
  return step.sections.length ? step.sections : CUSTOM_DEFAULT_SECTIONS
}
