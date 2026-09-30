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
