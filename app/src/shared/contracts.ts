// handoff와 intent 초안 머리글의 타입 (I19). 원본은 docs/contracts의 JSON Schema(D84)이고,
// generated/는 npm run contracts가 만든다. 여기서는 앱이 자주 쓰는 부분에 이름을 붙인다.
import type { Handoff } from './generated/handoff.v1'
import type { IntentDraft } from './generated/intent-draft.v1'

export type { Handoff, IntentDraft }

export type HandoffStatus = Handoff['status']
export type Decision = Handoff['decisions'][number]
export type IntentDeviation = NonNullable<Handoff['intent_deviation']>
export type RecommendedNext = NonNullable<Handoff['recommended_next']>

/** 파이프라인 노드 (3.1) */
export type NodeName = RecommendedNext['node']

/** intent 크기 (5.3). S면 evidence와 rca를 건너뛰고, L은 M과 같다 */
export type Size = IntentDraft['size']
