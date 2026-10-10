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

export interface AgentModel {
  id: string
  label: string
  /** 이 모델이 받는 추론 수준. 비면 추론 수준을 지원하지 않는다 */
  efforts: readonly AgentEffort[]
}

/** ultra를 뺀 수준. Claude 모델과 ultra가 없는 Codex 모델이 받는다 */
const UP_TO_MAX: readonly AgentEffort[] = ['low', 'medium', 'high', 'xhigh', 'max']

/**
 * 엔진별 모델의 고정 목록 (사람이 정함). Claude는 CLI의 별칭이다(claude --help의 --model). Codex의 수준은
 * ~/.codex/models_cache.json의 supported_reasoning_levels에서 옮겼다. 새 모델이 나오면 여기를 고친다
 */
export const AGENT_MODELS: Readonly<Record<AgentEngine, readonly AgentModel[]>> = {
  claude: [
    { id: 'fable', label: 'fable', efforts: UP_TO_MAX },
    { id: 'opus', label: 'opus', efforts: UP_TO_MAX },
    { id: 'sonnet', label: 'sonnet', efforts: UP_TO_MAX },
    { id: 'haiku', label: 'haiku', efforts: [] },
  ],
  codex: [
    { id: 'gpt-6.1-sol', label: 'gpt-6.1-sol', efforts: AGENT_EFFORTS },
    { id: 'gpt-6-astra', label: 'gpt-6-astra', efforts: AGENT_EFFORTS },
    { id: 'gpt-6-sol', label: 'gpt-6-sol', efforts: AGENT_EFFORTS },
    { id: 'gpt-6-luna', label: 'gpt-6-luna', efforts: UP_TO_MAX },
    { id: 'gpt-5.6-sol', label: 'gpt-5.6-sol', efforts: AGENT_EFFORTS },
    { id: 'gpt-5.6-terra', label: 'gpt-5.6-terra', efforts: AGENT_EFFORTS },
    { id: 'gpt-5.6-luna', label: 'gpt-5.6-luna', efforts: UP_TO_MAX },
  ],
}

/**
 * 모델이 "엔진 기본"(빈 값)일 때 고를 수 있는 추론 수준. 어떤 모델이 쓰일지 몰라 엔진의 전체 수준이다. CLI의 기본 모델이
 * 받지 않는 수준이면 CLI가 거절하거나 무시할 수 있어 설정 화면이 그렇게 알린다
 */
export const ENGINE_DEFAULT_EFFORTS: Readonly<Record<AgentEngine, readonly AgentEffort[]>> = {
  claude: UP_TO_MAX,
  codex: AGENT_EFFORTS,
}

/** 그 엔진의 고정 목록에 있는 모델인가. 빈 값은 엔진 기본이라 늘 있다 */
export function modelListed(engine: AgentEngine, model: string): boolean {
  return model === '' || AGENT_MODELS[engine].some((m) => m.id === model)
}

/** 그 엔진에는 없고 다른 엔진의 목록에 있는 모델인가. 엔진을 바꾼 뒤 남은 모델이라 늘 틀리다 */
function foreignModel(engine: AgentEngine, model: string): boolean {
  return !modelListed(engine, model) && AGENT_ENGINES.some((e) => modelListed(e, model))
}

/**
 * 직접 입력한 모델 이름의 모양. 앱은 그 모델이 있는지, 어떤 추론 수준을 받는지 확인하지 않는다(사람이 정함: 허용하되 앱이
 * 보장하지 않는다고 알린다). 이름은 CLI 인자로 넘어가고 Windows에서는 cmd.exe를 거치므로(adapters/exec.ts) 영문·숫자로
 * 시작하고 영문·숫자와 . _ - : / @ [ ]만 쓴다
 */
const CUSTOM_MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/@[\]-]{0,99}$/

/** 직접 입력한 모델인가: 비어 있지 않고 그 엔진의 목록에 없다 */
export function customModel(engine: AgentEngine, model: string): boolean {
  return !modelListed(engine, model)
}

/**
 * 엔진·모델이 받는 추론 수준. 빈 목록이면 추론 수준을 지원하지 않는다. 엔진 기본과 직접 입력한 모델은 받는 수준을 몰라
 * 엔진의 전체 수준이고, 다른 엔진의 모델은 쓸 수 없어 없다
 */
export function effortsFor(engine: AgentEngine, model: string): readonly AgentEffort[] {
  const listed = AGENT_MODELS[engine].find((m) => m.id === model)
  if (listed) return listed.efforts
  return foreignModel(engine, model) ? [] : ENGINE_DEFAULT_EFFORTS[engine]
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

/** 앱 설정의 기본 엔진·모델·추론 수준과 상세 설정. 빈 값은 엔진 기본(기본 줄)이나 기본 따름(단계)이다 */
export interface AgentDefaults<K extends string = string> {
  agent_engine: AgentEngine
  agent_model: string
  agent_effort: string
  agent_steps: Partial<Record<K, AgentStep>>
}

/** 해석에 넘기는 설정. 기본 엔진 말고는 없어도 된다 */
export type AgentConfig = Pick<AgentDefaults, 'agent_engine'> &
  Partial<Omit<AgentDefaults, 'agent_engine'>>

/** 단계가 기본 모델·추론 수준을 물려받는가. 기본 모델은 기본 엔진의 모델이라 단계 엔진이 같을 때만 물려받는다 */
function inherits(config: AgentConfig, step: AgentStep): boolean {
  return (step.engine ?? config.agent_engine) === config.agent_engine
}

/** 단계가 쓸 엔진: 단계 ?? 기본 */
export function stepEngine(config: AgentConfig, skill: string): AgentEngine {
  return config.agent_steps?.[skill]?.engine ?? config.agent_engine
}

/**
 * 단계가 쓸 모델: 단계 ?? (단계 엔진이 기본 엔진과 같으면 기본 모델, 다르면 엔진 기본). 단계의 추론 수준은 이 모델이 받는
 * 것만 고를 수 있다. 설정 화면, 저장 검사(stepError), 해석(resolveAgent)이 같이 쓴다
 */
export function stepModel(config: AgentConfig, step: AgentStep): string {
  return step.model || (inherits(config, step) ? (config.agent_model ?? '') : '')
}

/**
 * 한 단계의 실행 설정을 정한다. 엔진 = 단계 ?? 기본. 모델·추론 수준 = 단계 ?? (엔진이 기본 엔진과 같으면 기본, 다르면
 * 엔진 기본). 저장 검사를 지난 설정이면 버릴 것이 없지만, 그 엔진에 없는 모델과 고른 모델이 받지 않는 추론 수준은 버린다.
 * fixed는 엔진을 고를 수 없는 단계의 엔진이다(요구사항 추출의 extract는 늘 Claude Code, 결정 92)
 */
export function resolveAgent(
  config: AgentConfig,
  skill: string,
  fixed?: AgentEngine,
): ResolvedAgent {
  const set = config.agent_steps?.[skill] ?? {}
  const step = fixed ? { ...set, engine: fixed } : set
  const engine = step.engine ?? config.agent_engine
  const wantModel = stepModel(config, step)
  const model = modelError(engine, wantModel) ? '' : wantModel
  const wantEffort = step.effort ?? (inherits(config, step) ? (config.agent_effort ?? '') : '')
  const effort = effortError(engine, model, wantEffort) ? '' : wantEffort
  return { engine, ...(model ? { model } : {}), ...(effort ? { effort } : {}) }
}

// ---------- 맞는지 보기 (저장 검사와 설정 화면이 같이 쓴다) ----------

/**
 * 모델을 그 엔진에 쓸 수 있는가: 목록에 있거나, 직접 입력한 이름이 CUSTOM_MODEL 모양이다. 다른 엔진의 목록에 있는 모델은
 * 거절한다. 틀리면 이유
 */
export function modelError(engine: AgentEngine, model: string): string | null {
  if (modelListed(engine, model)) return null
  if (foreignModel(engine, model)) return `${AGENT_LABELS[engine]}에 없는 모델 ${model}`
  return CUSTOM_MODEL.test(model)
    ? null
    : `직접 입력한 모델 ${model}: 영문·숫자로 시작하고 영문·숫자와 . _ - : / @ [ ]만 쓸 수 있음(100자까지)`
}

/** 엔진·모델이 추론 수준을 받는가. 빈 값(엔진 기본)은 늘 받는다. 틀리면 이유 */
export function effortError(engine: AgentEngine, model: string, effort: string): string | null {
  if (effort === '' || (effortsFor(engine, model) as readonly string[]).includes(effort))
    return null
  return `${model || `${AGENT_LABELS[engine]} 기본 모델`}이 받지 않는 추론 수준 ${effort}`
}

/** 한 단계가 맞는가: 모델이 단계 엔진에 있고, 추론 수준을 단계가 쓸 모델(stepModel)이 받는가. 틀리면 이유 */
export function stepError(config: AgentConfig, step: AgentStep): string | null {
  const engine = step.engine ?? config.agent_engine
  return (
    modelError(engine, step.model ?? '') ??
    effortError(engine, stepModel(config, step), step.effort ?? '')
  )
}

// ---------- 설정 화면에서 바꾸기 ----------

/**
 * 엔진이나 모델을 바꾼 뒤 그 줄의 모델·추론 수준을 맞춘다: 다른 엔진의 모델은 엔진 기본으로, 모델이 받지 않는 추론 수준은
 * 엔진 기본으로 되돌린다. 빈 값과 직접 입력한 모델은 그대로 둔다(틀린 모양은 저장할 때 거절한다)
 */
export function fitAgent(
  engine: AgentEngine,
  model: string,
  effort: string,
): { model: string; effort: string } {
  const m = foreignModel(engine, model) ? '' : model
  const e = effortError(engine, m, effort) ? '' : effort
  return { model: m, effort: e }
}

/** 단계의 빈 값(기본 따름)을 뺀다 */
function compactStep(step: AgentStep): AgentStep {
  return {
    ...(step.engine ? { engine: step.engine } : {}),
    ...(step.model ? { model: step.model } : {}),
    ...(step.effort ? { effort: step.effort } : {}),
  }
}

/**
 * 단계의 모델을 단계 엔진(단계 ?? 기본)에 맞추고, 추론 수준을 단계가 쓸 모델(stepModel)에 맞춘다. 모델을 정하지 않은
 * 단계는 물려받는 기본 모델이 받지 않는 수준을 비운다. 그래서 저장값이 화면(기본 따름)과 같다
 */
function fitStep(config: AgentConfig, step: AgentStep): AgentStep {
  const engine = step.engine ?? config.agent_engine
  const model = foreignModel(engine, step.model ?? '') ? '' : (step.model ?? '')
  const effort = step.effort ?? ''
  const fitted = effortError(engine, stepModel(config, { ...step, model }), effort) ? '' : effort
  return compactStep({ ...step, model, effort: fitted })
}

/**
 * 상세 설정의 한 단계만 바꾼다. 다른 단계는 그대로다. 그 단계의 모델·추론 수준을 단계 엔진과 단계가 쓸 모델에 맞추고(기본
 * 모델을 물려받도록 화면의 설정을 준다. 없으면 단계 엔진만으로 맞춘다), 모두 비면 단계를 지운다
 */
export function setAgentStep<S extends Partial<Record<string, AgentStep>>>(
  steps: S,
  skill: string,
  step: AgentStep,
  config?: AgentConfig,
): S {
  const base = config ?? (step.engine ? { agent_engine: step.engine } : undefined)
  const next = base ? fitStep(base, step) : compactStep(step)
  const rest = Object.entries(steps).filter(([k]) => k !== skill)
  return Object.fromEntries(Object.keys(next).length ? [...rest, [skill, next]] : rest) as S
}

/** 기본 줄을 바꾼 뒤 모든 단계를 다시 맞춘다. 모두 빈 단계는 지운다 */
function fitSteps<T extends AgentDefaults<K>, K extends string>(c: T): T {
  const steps: Partial<Record<K, AgentStep>> = {}
  for (const [skill, step] of Object.entries(c.agent_steps) as [K, AgentStep][]) {
    const next = fitStep(c, step)
    if (Object.keys(next).length) steps[skill] = next
  }
  return { ...c, agent_steps: steps }
}

/** 엔진이 바뀐 줄의 모델: 새 엔진의 목록에 없으면(직접 입력한 이름 포함) 엔진 기본으로 되돌린다 */
function keepListed(engine: AgentEngine, model: string): string {
  return modelListed(engine, model) ? model : ''
}

/**
 * 기본 엔진을 바꾼다: 기본 모델·추론 수준과 단계들을 새 엔진에 맞춘다. 엔진이 함께 바뀌는 줄(기본 줄과 엔진을 정하지 않은
 * 단계)의 직접 입력한 모델은 앞 엔진의 이름이라 비운다
 */
export function changeDefaultEngine<T extends AgentDefaults<K>, K extends string>(
  c: T,
  engine: AgentEngine,
): T {
  const fit = fitAgent(engine, keepListed(engine, c.agent_model), c.agent_effort)
  const steps: Partial<Record<K, AgentStep>> = {}
  for (const [skill, step] of Object.entries(c.agent_steps) as [K, AgentStep][]) {
    steps[skill] = step.engine ? step : { ...step, model: keepListed(engine, step.model ?? '') }
  }
  return fitSteps({
    ...c,
    agent_engine: engine,
    agent_model: fit.model,
    agent_effort: fit.effort,
    agent_steps: steps,
  })
}

/** 기본 모델을 바꾼다: 기본 추론 수준과, 기본 모델을 물려받는 단계의 추론 수준을 새 모델에 맞춘다 */
export function changeDefaultModel<T extends AgentDefaults<K>, K extends string>(
  c: T,
  model: string,
): T {
  const fit = fitAgent(c.agent_engine, model, c.agent_effort)
  return fitSteps({ ...c, agent_model: fit.model, agent_effort: fit.effort })
}

/** 단계의 엔진을 바꾼다(빈 값은 기본 따름). 쓸 엔진이 바뀌면 새 엔진의 목록에 없는 모델(직접 입력 포함)을 비운다 */
export function changeStepEngine(
  config: AgentConfig,
  step: AgentStep,
  engine: AgentEngine | undefined,
): AgentStep {
  const after = engine ?? config.agent_engine
  const same = (step.engine ?? config.agent_engine) === after
  return { ...step, engine, model: same ? step.model : keepListed(after, step.model ?? '') }
}
