// rules.mjs의 타입 (앱의 반영 검사와 [어댑터] 시험이 TypeScript에서 부른다)
export interface Rule {
  id: string
  text: string
  needs?: string
  check?: (result: unknown, ctx?: RuleContext) => string[]
}
export interface RuleContext {
  /** 패킷이나 survey가 준 구성 이름 (config_known) */
  configs?: string[]
  /** 구성별 빌드 인덱스 (config_active) */
  build?: unknown
}
export declare const RULES: Rule[]
export declare function checkResult(
  result: unknown,
  ctx?: RuleContext,
): { rule: string; problem: string }[]
