// rules.mjs의 타입 (앱의 반영 검사와 [어댑터] 시험이 TypeScript에서 부른다)
export interface Rule {
  id: string
  text: string
  needs?: string
  /** 이 종류의 결과에만 건다. 없으면 모든 종류 */
  kinds?: string[]
  check?: (result: unknown, ctx?: RuleContext) => string[]
}
export interface RuleContext {
  /** 패킷이나 survey가 준 구성 이름 (config_known) */
  configs?: string[]
  /** 구성별 빌드 인덱스 (config_active) */
  build?: unknown
  /** 패킷과 기록 목록이 준 전역 ID (global_refs) */
  ids?: string[]
  /** 전역 ID → 주장의 절 이름 (link_shape) */
  sections?: Record<string, string>
  /** 결과의 run 종류. 있으면 그 종류의 규칙만 돈다 */
  kind?: string
}
export declare const RULES: Rule[]
export declare function rulesFor(kind: string): Rule[]
export declare function checkResult(
  result: unknown,
  ctx?: RuleContext,
): { rule: string; problem: string }[]
