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

// ---------- 모델과 추론 수준 ----------

/** 추론 수준. Claude는 --effort, Codex는 model_reasoning_effort로 넘긴다 */
export const AGENT_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] as const
export type AgentEffort = (typeof AGENT_EFFORTS)[number]

export const EFFORT_LABEL: Readonly<Record<AgentEffort, string>> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
  max: 'max',
  ultra: 'ultra',
}

export interface AgentModel {
  id: string
  label: string
  /** 이 모델이 받는 추론 수준. 비면 추론 수준을 지원하지 않는다 */
  efforts: readonly AgentEffort[]
}

const CLAUDE_EFFORTS: readonly AgentEffort[] = ['low', 'medium', 'high', 'xhigh', 'max']
const CODEX_EFFORTS: readonly AgentEffort[] = AGENT_EFFORTS
const CODEX_NO_ULTRA: readonly AgentEffort[] = ['low', 'medium', 'high', 'xhigh', 'max']

/**
 * 엔진별 모델의 고정 목록 (사람이 정함). Claude는 CLI의 별칭이다(claude --help의 --model). Codex의 수준은
 * ~/.codex/models_cache.json의 supported_reasoning_levels에서 옮겼다. 새 모델이 나오면 여기를 고친다
 */
export const AGENT_MODELS: Readonly<Record<AgentEngine, readonly AgentModel[]>> = {
  claude: [
    { id: 'fable', label: 'fable', efforts: CLAUDE_EFFORTS },
    { id: 'opus', label: 'opus', efforts: CLAUDE_EFFORTS },
    { id: 'sonnet', label: 'sonnet', efforts: CLAUDE_EFFORTS },
    { id: 'haiku', label: 'haiku', efforts: [] },
  ],
  codex: [
    { id: 'gpt-6.1-sol', label: 'gpt-6.1-sol', efforts: CODEX_EFFORTS },
    { id: 'gpt-6-astra', label: 'gpt-6-astra', efforts: CODEX_EFFORTS },
    { id: 'gpt-6-sol', label: 'gpt-6-sol', efforts: CODEX_EFFORTS },
    { id: 'gpt-6-luna', label: 'gpt-6-luna', efforts: CODEX_NO_ULTRA },
    { id: 'gpt-5.6-sol', label: 'gpt-5.6-sol', efforts: CODEX_EFFORTS },
    { id: 'gpt-5.6-terra', label: 'gpt-5.6-terra', efforts: CODEX_EFFORTS },
    { id: 'gpt-5.6-luna', label: 'gpt-5.6-luna', efforts: CODEX_NO_ULTRA },
  ],
}

/** 모델이 "엔진 기본"(빈 값)일 때 고를 수 있는 추론 수준. 어떤 모델이 쓰일지 몰라 엔진의 전체 수준이다 */
export const ENGINE_DEFAULT_EFFORTS: Readonly<Record<AgentEngine, readonly AgentEffort[]>> = {
  claude: CLAUDE_EFFORTS,
  codex: CODEX_EFFORTS,
}

/** 그 엔진에 있는 모델인가. 빈 값은 엔진 기본이라 늘 있다 */
export function modelKnown(engine: AgentEngine, model: string): boolean {
  return model === '' || AGENT_MODELS[engine].some((m) => m.id === model)
}

/** 엔진·모델이 받는 추론 수준. 빈 목록이면 추론 수준을 지원하지 않는다 */
export function effortsFor(engine: AgentEngine, model: string): readonly AgentEffort[] {
  if (model === '') return ENGINE_DEFAULT_EFFORTS[engine]
  return AGENT_MODELS[engine].find((m) => m.id === model)?.efforts ?? []
}

/** 한 단계(스킬)의 실행 설정. 없는 키는 앱의 기본을 따른다 */
export interface AgentStep {
  engine?: AgentEngine
  model?: string
  effort?: string
}

/** task에 고정하는 실행 설정. 모델·추론 수준이 없으면 엔진의 기본이다 */
export interface ResolvedAgent {
  engine: AgentEngine
  model?: string
  effort?: string
}

export interface AgentConfig {
  agent_engine: AgentEngine
  agent_model?: string
  agent_effort?: string
  agent_steps?: Partial<Record<string, AgentStep>>
}

/**
 * 한 단계의 실행 설정을 정한다. 엔진 = 단계 ?? 기본. 모델·추론 수준 = 단계 ?? (엔진이 기본 엔진과 같으면 기본, 다르면
 * 엔진 기본). 기본 모델은 기본 엔진의 모델이라 다른 엔진에 물려주지 않는다. 그 엔진에 없는 모델과 고른 모델이 받지 않는
 * 추론 수준은 버린다
 */
export function resolveAgent(config: AgentConfig, skill: string): ResolvedAgent {
  const step = config.agent_steps?.[skill] ?? {}
  const engine = step.engine ?? config.agent_engine
  const inherit = engine === config.agent_engine
  const wantModel = step.model ?? (inherit ? (config.agent_model ?? '') : '')
  const model = modelKnown(engine, wantModel) ? wantModel : ''
  const wantEffort = step.effort ?? (inherit ? (config.agent_effort ?? '') : '')
  const effort = (effortsFor(engine, model) as readonly string[]).includes(wantEffort)
    ? wantEffort
    : ''
  return { engine, ...(model ? { model } : {}), ...(effort ? { effort } : {}) }
}
