// handoff 머리글과 지식 파일 머리글의 타입 (I19). 원본은 docs/contracts의 JSON Schema(D84)이고,
// generated/는 npm run contracts가 만든다. 여기서는 앱이 자주 쓰는 부분에 이름을 붙인다.
// intent 초안에는 머리글이 없다 (D236, I58).
// handoff는 형식 버전 2가 지금 버전이고(I70), 버전 1로 시작한 task는 버전 1의 타입으로 읽는다.
import type { Handoff } from './generated/handoff.v2'
import type { Handoff as HandoffV1 } from './generated/handoff.v1'
import type { KnowledgeEntry as KnowledgeEntryHeader } from './generated/knowledge-entry.v1'

export type { Handoff, HandoffV1, KnowledgeEntryHeader }

/** 검사한 handoff 머리글 (I70). 버전 1과 2가 같이 가진 필드는 좁히지 않고 읽고, 지식 필드는 handoffV2로 좁힌다 */
export type AnyHandoff = Handoff | HandoffV1

export type HandoffStatus = Handoff['status']
export type Decision = Handoff['decisions'][number]
export type IntentDeviation = NonNullable<Handoff['intent_deviation']>
export type RecommendedNext = NonNullable<Handoff['recommended_next']>
/** handoff v2의 지식 후보 하나 (D295, D299) */
export type KnowledgeCandidateField = NonNullable<Handoff['knowledge_candidates']>[number]
/** handoff v2의 틀렸다는 보고 하나 (D318) */
export type KnowledgeFeedbackField = NonNullable<Handoff['knowledge_feedback']>[number]

/** 파이프라인 노드 (3.1) */
export type NodeName = RecommendedNext['node']

/**
 * task의 노드 (3.1). 파이프라인 노드에 파이프라인 밖의 PR 대응(respond, D187, D188)을 더한다. PR 대응은 선택 가능한
 * 다음 단계가 없어 handoff의 recommended_next.node에는 쓸 수 없다(스키마에 없음)
 */
export type TaskNode = NodeName | 'respond'
