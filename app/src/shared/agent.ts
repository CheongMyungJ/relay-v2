/** relay가 실행하는 CLI 엔진. 모델/provider 설정과 구분한다 (docs/engines.md E2, E5). */
export const AGENT_ENGINES = ['claude', 'codex'] as const
export type AgentEngine = (typeof AGENT_ENGINES)[number]

export const AGENT_LABELS: Readonly<Record<AgentEngine, string>> = {
  claude: 'Claude Code',
  codex: 'Codex',
}

export function isAgentEngine(value: unknown): value is AgentEngine {
  return value === 'claude' || value === 'codex'
}

/** 엔진을 바꿔도 Claude 작업에 저장된 자동 승인 설정은 유지한다. */
export const AGENT_APPROVAL_NOTICE =
  'Codex 작업은 사람이 승인합니다. 자동 승인 설정은 Claude Code 작업에 적용됩니다.'
