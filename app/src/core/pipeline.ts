// 업무 유형별 파이프라인: 노드 순서와 선택 가능한 다음 단계 (3.1, 3.2, D232).
// 유형마다 경로는 하나다. 크기(size)는 없다 (D227). 순서에 기대는 함수는 유형을 함께 받는다 (I57).
// PR 대응 task(노드 respond)는 파이프라인 밖이다 (D187, D188): 순서, 단계 선택에 없고 선택 가능한 다음 단계가 없다.
import type { SkillName } from '../shared/config'
import type { NodeName, TaskNode } from '../shared/contracts'
import { WORK_TYPES, type WorkState, type WorkType } from '../shared/work'

export interface NodeInfo {
  node: TaskNode
  skill: SkillName
  /** 화면 이름 (D109) */
  title: string
  /** 필수 산출물 (3.1). awaiting_approval일 때 task 디렉터리에 있어야 한다 (D30) */
  artifacts: readonly string[]
  /**
   * 앱이 run을 돌리는 단계(요구사항 추출의 extract, 결정 92). 스킬을 배포하지 않고 CLI 세션을 띄우지 않는다. 산출물은 앱이
   * 기록에서 렌더링한다(결정 99)
   */
  appRun?: true
}

/**
 * 유형별 파이프라인 순서 (3.1, D227, D232). Work는 그 유형의 순서를 모두 지난다. 되감기와 건너뛰기, 이전 단계는 이
 * 순서로 가른다(6.2). fix는 재현과 원인 분석을 함께 하고(D228), design은 설계와 구현 계획을 함께 하고(D232),
 * refactor는 계획, 안전망, 구조 변경을 함께 하고(D258), spec은 주제 목록과 문답과 설계 문서 쓰기를 함께 하고(D350, D352),
 * execute는 진행 방식을 정하지 않고 계획과 작업을 함께 하고(D302), verify는 리뷰와 최종 검증을 함께 한다 (D229)
 */
export const PIPELINES: Readonly<Record<WorkType, readonly NodeName[]>> = {
  bugfix: ['intake', 'fix', 'verify'],
  feature: ['intake', 'design', 'implement', 'verify'],
  refactor: ['intake', 'refactor', 'verify'],
  spec: ['intake', 'spec', 'verify'],
  general: ['intake', 'execute', 'verify'],
  // 요구사항 추출: extract는 앱이 run을 돌리는 단계다 (requirements-extraction-flow.md 4절, 결정 92)
  requirements: ['intake', 'extract', 'verify'],
}

/** Work의 업무 유형. work.json에 type이 없으면 버그 수정이다 (D256, I58) */
export function workType(work: Pick<WorkState, 'type'>): WorkType {
  return work.type ?? 'bugfix'
}

/** 그 유형의 파이프라인에 있는 노드인가 */
export function inPipeline(type: WorkType, node: TaskNode): node is NodeName {
  return (PIPELINES[type] as readonly TaskNode[]).includes(node)
}

const CONTINUE =
  '[현재 코드 위에서 이어서]: 폐기된 시도의 커밋이 남아 있다. 그 위에서 이어서 고친다.'

/**
 * [현재 코드 위에서 이어서](6.2)를 주는 단계 하나: context.md 안내와, 이름이 "현재 문서 위에서 이어서"이고 처음부터
 * 체크되어 있는지(doc). 코드 처리(백업 브랜치, 커밋 유지)는 doc이어도 같다 (D365, I105)
 */
export interface KeepCode {
  note: string
  doc?: true
}

/**
 * [현재 코드 위에서 이어서](6.2)를 주는 단계와 그 단계의 context.md 안내 (6.2, D254, D278, PR #24 리뷰). 제공 여부, 안내,
 * 이름과 처음 체크가 한 표에서 나오므로 단계를 더할 때 어긋나지 않는다 (PR #36 리뷰). design은 코드를 바꾸지 않고
 * design.md만 고치며, 이어지는 implement가 그 코드 위에서 고친다. refactor는 안전망 커밋을 다시 만들지 않고 폐기된
 * refactor.md의 해시를 이어 적는다. execute는 폐기된 execution.md를 참고해 새 execution.md를 쓴다 (D316, I85). spec은
 * [현재 문서 위에서 이어서]이고 처음부터 체크되어 있다. 문서의 결정을 그대로 두고 사람의 추가 지시에서 시작하며, verify에서
 * 되감아 폐기된 verification.md가 있으면 그 다시 볼 결정도 본다. 폐기된 시도의 사람 결정은 새 handoff에 옮겨 적는다
 * (D365, I105, I115)
 */
export const KEEP_CODE: Readonly<Record<WorkType, Readonly<Partial<Record<NodeName, KeepCode>>>>> =
  {
    bugfix: { fix: { note: CONTINUE } },
    feature: {
      design: {
        note: '[현재 코드 위에서 이어서]: 폐기된 시도의 커밋이 남아 있다. 지금 코드를 읽고 `design.md`를 고친다. 코드는 바꾸지 않는다. 이어지는 구현이 그 코드 위에서 고친다.',
      },
      implement: { note: CONTINUE },
    },
    refactor: {
      refactor: {
        note: `${CONTINUE} 안전망 커밋은 다시 만들지 않는다. 아래 폐기된 \`refactor.md\`의 \`안전망 커밋\` 해시를 새 \`refactor.md\`에 그대로 적는다. 더 필요한 안전망 테스트는 구조를 더 바꾸기 전에 따로 커밋하고 표에 (추가)로 적으며, 기준 코드 결과는 안전망 커밋에 그 테스트 파일만 얹어 돌려 얻는다(스킬의 절차).`,
      },
    },
    spec: {
      spec: {
        note: '[현재 문서 위에서 이어서]: 폐기된 시도가 설계 문서에 적은 것이 그대로 남아 있다(커밋했든 안 했든). 문서의 결정을 그대로 두고 사람의 추가 지시에서 시작한다. 아래 폐기된 산출물에 `verification.md`가 있으면 그 `다시 볼 결정`도 본다. 폐기된 `spec.md`를 참고해 새 `spec.md`를 쓰고, 폐기된 시도에서 사람이 정한 결정(폐기된 `spec.md` 옆의 `handoff.md`나 `문답 기록`)을 새 handoff의 `decisions`에 `by: human`으로 옮겨 적는다.',
        doc: true,
      },
    },
    general: {
      execute: {
        note: `${CONTINUE} 아래 폐기된 \`execution.md\`를 참고해 새 \`execution.md\`를 쓴다.`,
      },
    },
    requirements: {},
  }

/**
 * [현재 코드 위에서 이어서]를 주는 단계 (6.2). KEEP_CODE에서 나오므로 유형을 더해도 여기는 고치지 않는다
 * (PR #29 리뷰)
 */
export const KEEP_CODE_NODES: Readonly<Record<WorkType, readonly NodeName[]>> = Object.fromEntries(
  WORK_TYPES.map((t) => [t, Object.keys(KEEP_CODE[t]) as NodeName[]]),
) as Record<WorkType, NodeName[]>

/** 단계 선택 대화상자의 [현재 코드 위에서 이어서] 이름. 설계의 spec은 [현재 문서 위에서 이어서]다 (D365, I105) */
export function keepLabel(type: WorkType, node: NodeName): string {
  return KEEP_CODE[type][node]?.doc ? '현재 문서 위에서 이어서' : '현재 코드 위에서 이어서'
}

/**
 * 되감기로 고르면 [현재 코드 위에서 이어서]가 처음부터 체크되어 있는가. 설계의 spec만 참이다: 이 유형에서 되감는 까닭은
 * 대부분 결정 한두 개를 다시 보는 것이다 (D365, I105)
 */
export function keepDefault(type: WorkType, node: NodeName): boolean {
  return KEEP_CODE[type][node]?.doc === true
}

/** 앱이 run을 돌리는 단계인가 (결정 92): 세션 대신 run 루프를 시작하고 멈춘다 */
export function appRun(node: TaskNode): boolean {
  return NODE_INFO[node].appRun === true
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
  extract: {
    node: 'extract',
    skill: 'extract',
    title: '요구사항 추출',
    artifacts: ['extraction.md'],
    appRun: true,
  },
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
  return inPipeline(type, from) && inPipeline(type, to) && order(type, to) < order(type, from)
}

/**
 * 에이전트의 추천 때문에 승인 뒤 멈추는가 (D23): 그 유형의 이전 단계나 같은 단계이거나, 이 유형의 파이프라인에 없는
 * 노드다. 같은 단계와 파이프라인 밖 노드는 형식 오류지만 [오류 무시하고 승인]으로 넘어올 수 있다. 되돌아가거나 다시
 * 하자는 추천을 Work 완료로 넘기지 않게 멈추고 사람이 단계를 고른다. PR 대응 task는 추천이 없다 (D188)
 */
export function stopsForRecommendation(type: WorkType, from: TaskNode, to: NodeName): boolean {
  if (!inPipeline(type, from)) return false
  return isPrevious(type, from, to) || to === from || !inPipeline(type, to)
}
