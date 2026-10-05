// handoff 머리글의 타입 (I19). 원본은 docs/contracts의 JSON Schema(D84)이고,
// generated/는 npm run contracts가 만든다. 여기서는 앱이 자주 쓰는 부분에 이름을 붙인다.
// intent 초안에는 머리글이 없다 (D236, I58).
import type { Handoff } from './generated/handoff.v1'

export type { Handoff }

export type HandoffStatus = Handoff['status']
export type Decision = Handoff['decisions'][number]
export type RecommendedNext = NonNullable<Handoff['recommended_next']>

/** 파이프라인 노드 (3.1) */
export type NodeName = RecommendedNext['node']

/**
 * task의 노드 (3.1). 파이프라인 노드에 파이프라인 밖의 PR 대응(respond, D187, D188)을 더한다. PR 대응은 선택 가능한
 * 다음 단계가 없어 handoff의 recommended_next.node에는 쓸 수 없다(스키마에 없음)
 */
export type TaskNode = NodeName | 'respond'
