// review.mjs의 타입 (앱과 [단위] 시험이 TypeScript에서 부른다)
export interface ReviewClaim {
  id: string
  section: string
  body: Record<string, unknown>
}
export interface ReviewItem {
  key: string
  claim: string
  kind: 'value' | 'configs' | 'statement'
  text: string
}
export interface BlindAnswer {
  status: string
  text?: string
  values?: { configs: string[]; value: string }[]
  configs?: string[]
  anchors?: unknown[]
}
export declare const REVIEW_BATCH: number
export declare const SAMPLE_RATE: number
export declare function riskClass(claim: { section: string; body: Record<string, unknown> }): string | null | undefined
export declare function sampled(id: string, rate?: number): boolean
export declare function wantsReview(claim: ReviewClaim): boolean
export declare function reviewOrder(claim: ReviewClaim): number
export declare function reviewBatches<T extends ReviewClaim>(claims: T[], size?: number): T[][]
export declare function reviewItem(claim: { section: string; body: Record<string, unknown> }): {
  kind: 'value' | 'configs' | 'statement'
  text: string
}
export declare function reviewItems(claims: ReviewClaim[]): ReviewItem[]
export declare function unitKey(unit: string): string
export declare function valueCandidates(text: string, declared?: string): { x: number; key: string }[]
export declare function compareAnswer(
  claim: { section: string; body: Record<string, unknown> },
  kind: 'value' | 'configs',
  answer: BlindAnswer,
  confirmed: string[],
): { result: 'agree' | 'conflict' | 'unanswered'; note: string }
export declare const VERDICT_STATUS: Record<
  'refuted' | 'overclaimed' | 'needs_more' | 'not_refuted',
  'refuted' | 'overclaim' | 'needs_more' | null
>
