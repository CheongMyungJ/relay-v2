// 앱 설정(config.json, 5.1.1)과 Work별 설정(D72)의 검사. config.json을 읽을 때와 설정 화면(D70)이
// 같은 규칙을 쓴다. 바꾼 값은 바로 적용되고, 질문 방식만 다음에 시작하는 task부터 쓴다(D73). 자동 승인은 턴이 끝날 때의
// 설정으로 판정하고, 카운트다운 중에 끄면 바로 멈춘다(D128). 적용은 main이 한다.
import {
  AGENT_STEP_TITLES,
  AUTO_APPROVE_TITLES,
  DEFAULT_CONFIG,
  SKILL_TITLES,
  THEME_CHOICES,
  type AppConfig,
  type AutoApproveNode,
  type QuestionMode,
  type QuestionSkill,
  type SkillName,
  type ThemeChoice,
  type WorkSettings,
  type WorkSettingsPatch,
} from '../shared/config'
import type { NodeName } from '../shared/contracts'
import type { ProjectSettings } from '../shared/project'
import type { MergeMethod } from '../shared/work'
import { ALL_NODES } from './pipeline'
import {
  AGENT_LABELS,
  effortsFor,
  isAgentEngine,
  modelKnown,
  type AgentEngine,
  type AgentStep,
} from '../shared/agent'

/** 질문 방식을 고르는 스킬. spec은 없어 config.json에 있으면 모르는 스킬이다 (I104) */
const SKILLS: readonly QuestionSkill[] = SKILL_TITLES.map(([skill]) => skill)

const QUESTION_MODES: readonly QuestionMode[] = ['draft_first', 'confirm_each']

/**
 * 자동 승인을 켤 수 있는 노드 (4.2). intake(의도 승인)와 verify(리뷰와 검증 = Work 완료)는 늘 수동이다.
 * PR 대응(respond)은 켤 수 있다 (D169)
 */
export const AUTO_APPROVE_NODES: readonly AutoApproveNode[] = AUTO_APPROVE_TITLES.map(([n]) => n)

/**
 * 늘 수동인 노드: 자동 승인을 켤 수 있는 노드의 나머지. 의도 승인과 Work 완료다 (4.2). 자동 승인에
 * 이 키가 있으면 켜든 끄든 받지 않는다
 */
const MANUAL_NODES: readonly NodeName[] = ALL_NODES.filter(
  (n) => !(AUTO_APPROVE_NODES as readonly NodeName[]).includes(n),
)

/** 설정 화면에서 바꾸는 값 (D70) */
const EDITABLE_KEYS = [
  'agent_engine',
  'agent_model',
  'agent_effort',
  'agent_steps',
  'session_limit',
  'auto_approve',
  'auto_approve_countdown_sec',
  'question_mode',
  'pr_draft',
  'handoff_body_warn_chars',
  'intent_warn_chars',
  'format_error_bounce_max',
  'pr_poll_interval_sec',
  'respond_auto_start',
  'respond_auto_round_max',
  'reply_signature',
  'knowledge_review_engine',
  'knowledge_review_model',
  'theme',
] as const

export type EditableKey = (typeof EDITABLE_KEYS)[number]

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string }

type IntegerKey =
  | 'session_limit'
  | 'format_error_bounce_max'
  | 'handoff_body_warn_chars'
  | 'intent_warn_chars'
  | 'auto_approve_countdown_sec'
  | 'pr_poll_interval_sec'
  | 'respond_auto_round_max'

/**
 * 정수 값의 범위. 되돌림 횟수는 8을 넘겨도 소용이 없다: Stop 훅으로 연속 8번 이어 가면
 * Claude Code가 다음 막음을 무시한다(docs/implementation.md 3절, CLAUDE_CODE_STOP_HOOK_BLOCK_CAP).
 * PR 읽기 주기는 30초~1시간이다 **(기본값)**: 한 번 읽기가 GraphQL 1점과 REST 3번이라(S7) 30초여도 PR 하나에 시간당
 * 한도(각 5,000)의 약 7%다.
 * 자동 대응 라운드 상한은 1~20이다 **(기본값)**: 0은 자동 시작을 끈 것과 같아 받지 않는다(D171).
 */
const RANGES: Readonly<Record<IntegerKey, readonly [number, number]>> = {
  session_limit: [1, 20],
  format_error_bounce_max: [0, 8],
  handoff_body_warn_chars: [1, 1_000_000],
  intent_warn_chars: [1, 1_000_000],
  auto_approve_countdown_sec: [1, 3600],
  pr_poll_interval_sec: [30, 3600],
  respond_auto_round_max: [1, 20],
}

type BooleanKey = 'pr_draft' | 'respond_auto_start'

const NAMES: Readonly<
  Record<IntegerKey | BooleanKey | 'question_mode' | 'auto_approve' | 'reply_signature', string>
> = {
  session_limit: '세션 상한',
  format_error_bounce_max: '형식 오류 되돌림 횟수',
  handoff_body_warn_chars: 'handoff 본문 분량 경고 기준',
  intent_warn_chars: 'intent 분량 경고 기준',
  auto_approve_countdown_sec: '자동 승인 카운트다운',
  pr_poll_interval_sec: 'PR 읽기 주기',
  respond_auto_round_max: '자동 대응 라운드 상한',
  question_mode: '질문 방식',
  pr_draft: 'draft PR',
  respond_auto_start: '대응 자동 시작',
  auto_approve: '자동 승인',
  reply_signature: '답글 표시 문구',
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function agentEngine(v: unknown): Checked<AgentEngine> {
  return isAgentEngine(v)
    ? { ok: true, value: v }
    : { ok: false, error: '기본 엔진: claude | codex 중 하나여야 함' }
}

/** 지식 검토의 모델 이름 (D334): 비우면 엔진의 기본. 한 낱말(띄어쓰기 없음), 100자 이하 */
function reviewModel(v: unknown): Checked<string> {
  const t = typeof v === 'string' ? v.trim() : null
  if (t === null || /\s/.test(t) || t.length > 100) {
    return { ok: false, error: '지식 검토 모델: 띄어쓰기 없는 모델 이름이거나 비워야 함' }
  }
  return { ok: true, value: t }
}

function reviewEngine(v: unknown): Checked<AgentEngine> {
  return isAgentEngine(v)
    ? { ok: true, value: v }
    : { ok: false, error: '지식 검토 엔진: claude | codex 중 하나여야 함' }
}

/** 상세 설정의 단계와 화면 이름 */
const STEP_TITLE: ReadonlyMap<string, string> = new Map(
  AGENT_STEP_TITLES.map(([skill, title]) => [skill, title]),
)

const STEP_KEYS: readonly (keyof AgentStep)[] = ['engine', 'model', 'effort']

/** 기본 모델·추론 수준의 모양: 문자열. 엔진과 맞는지는 defaultFits가 본다 */
function agentText(name: string, v: unknown): Checked<string> {
  return typeof v === 'string'
    ? { ok: true, value: v.trim() }
    : { ok: false, error: `${name}: 문자열이어야 함` }
}

/** 상세 설정 한 단계의 모양. 빈 값은 기본을 따른다는 뜻이라 뺀다. 엔진과 맞는지는 stepFits가 본다 */
function agentStep(skill: string, v: unknown): Checked<AgentStep> {
  const title = STEP_TITLE.get(skill)
  if (!title) return { ok: false, error: `상세 설정: 모르는 단계 ${skill}` }
  if (!isRecord(v)) return { ok: false, error: `상세 설정(${title}): 객체여야 함` }
  const out: AgentStep = {}
  for (const [key, x] of Object.entries(v)) {
    if (!(STEP_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `상세 설정(${title}): 모르는 값 ${key}` }
    }
    if (x === undefined || x === '') continue
    if (key === 'engine') {
      if (!isAgentEngine(x)) {
        return { ok: false, error: `상세 설정(${title}): 엔진은 claude | codex 중 하나여야 함` }
      }
      out.engine = x
    } else if (typeof x !== 'string') {
      return { ok: false, error: `상세 설정(${title}): ${key}는 문자열이어야 함` }
    } else {
      out[key as 'model' | 'effort'] = x.trim()
    }
  }
  return { ok: true, value: out }
}

/** 기본 모델이 기본 엔진에 있는가. 틀리면 이유 */
function defaultModelFits(c: Pick<AppConfig, 'agent_engine' | 'agent_model'>): string | null {
  return modelKnown(c.agent_engine, c.agent_model)
    ? null
    : `기본 모델: ${AGENT_LABELS[c.agent_engine]}에 없는 모델 ${c.agent_model}`
}

/** 기본 추론 수준을 기본 엔진·모델이 받는가. 틀리면 이유 */
function defaultEffortFits(
  c: Pick<AppConfig, 'agent_engine' | 'agent_model' | 'agent_effort'>,
): string | null {
  const efforts: readonly string[] = effortsFor(c.agent_engine, c.agent_model)
  if (c.agent_effort === '' || efforts.includes(c.agent_effort)) return null
  const model = c.agent_model || `${AGENT_LABELS[c.agent_engine]} 기본 모델`
  return `기본 추론 수준: ${model}이 받지 않는 수준 ${c.agent_effort}`
}

/**
 * 한 단계의 모델이 그 단계의 엔진(단계 ?? 기본)에 있고, 추론 수준을 그 모델이 받는가. 모델을 정하지 않은 단계는 엔진의
 * 전체 수준을 받는다(물려받은 모델이 받지 않으면 실행 때 버린다, resolveAgent). 틀리면 이유
 */
function stepFits(engine: AgentEngine, skill: string, step: AgentStep): string | null {
  const title = STEP_TITLE.get(skill) ?? skill
  const e = step.engine ?? engine
  const model = step.model ?? ''
  if (!modelKnown(e, model)) return `상세 설정(${title}): ${AGENT_LABELS[e]}에 없는 모델 ${model}`
  const efforts: readonly string[] = effortsFor(e, model)
  if (step.effort !== undefined && !efforts.includes(step.effort)) {
    const name = model || `${AGENT_LABELS[e]} 기본 모델`
    return `상세 설정(${title}): ${name}이 받지 않는 추론 수준 ${step.effort}`
  }
  return null
}

/** 기본 모델·추론 수준과 상세 설정을 읽는다. 틀린 값은 그 값만 비워(엔진 기본, 기본 따름) 경고한다 */
function normalizeAgent(data: Record<string, unknown>, config: AppConfig, warnings: string[]) {
  for (const [key, name] of [
    ['agent_model', '기본 모델'],
    ['agent_effort', '기본 추론 수준'],
  ] as const) {
    if (data[key] === undefined) continue
    const r = agentText(name, data[key])
    if (r.ok) config[key] = r.value
    else warnings.push(`config.json ${r.error}. 엔진의 기본을 씀`)
  }
  const model = defaultModelFits(config)
  if (model) {
    warnings.push(`config.json ${model}. 엔진의 기본을 씀`)
    config.agent_model = ''
  }
  const effort = defaultEffortFits(config)
  if (effort) {
    warnings.push(`config.json ${effort}. 엔진의 기본을 씀`)
    config.agent_effort = ''
  }
  const steps = data['agent_steps']
  if (steps === undefined) return
  if (!isRecord(steps)) {
    warnings.push('config.json 상세 설정: 객체여야 함. 모든 단계가 기본을 따름')
    return
  }
  for (const [skill, v] of Object.entries(steps)) {
    const r = agentStep(skill, v)
    const why = r.ok ? stepFits(config.agent_engine, skill, r.value) : r.error
    if (why) warnings.push(`config.json ${why}. 이 단계는 기본을 따름`)
    else if (r.ok && Object.keys(r.value).length) config.agent_steps[skill as SkillName] = r.value
  }
}

/** 화면 테마 (D335) */
function theme(v: unknown): Checked<ThemeChoice> {
  const found = THEME_CHOICES.find((t) => t === v)
  return found
    ? { ok: true, value: found }
    : { ok: false, error: '테마: system | dark | light 중 하나여야 함' }
}

function integer(key: IntegerKey, v: unknown): Checked<number> {
  const [min, max] = RANGES[key]
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    return { ok: false, error: `${NAMES[key]}: ${min}~${max}의 정수여야 함 (지금: ${String(v)})` }
  }
  return { ok: true, value: v }
}

/** 참·거짓 값: draft PR(D71), 대응 자동 시작(D154) */
const BOOLEAN_KEYS: readonly BooleanKey[] = ['pr_draft', 'respond_auto_start']

/** 답글 표시 문구의 길이 상한 (D173, 기본값) */
const SIGNATURE_MAX = 200

/**
 * 답글 끝에 붙이는 표시 문구 (D173): 비어 있지 않은 한 줄이고 200자 이하다 **(기본값)**. 앞뒤 공백은 뗀다. 답글이 사람
 * 계정으로 올라가므로 AI가 썼다는 표시는 늘 붙인다
 */
function signature(v: unknown): Checked<string> {
  const t = typeof v === 'string' ? v.trim() : ''
  if (!t) return { ok: false, error: `${NAMES.reply_signature}: 비어 있지 않은 글이어야 함` }
  if (/[\r\n]/.test(t)) return { ok: false, error: `${NAMES.reply_signature}: 한 줄이어야 함` }
  if ([...t].length > SIGNATURE_MAX) {
    return { ok: false, error: `${NAMES.reply_signature}: ${SIGNATURE_MAX}자 이하여야 함` }
  }
  return { ok: true, value: t }
}

/** 스킬별 질문 방식. 없는 스킬은 빼고, 모르는 스킬이나 값은 오류다 */
function questionModes(v: unknown): Checked<Partial<Record<QuestionSkill, QuestionMode>>> {
  if (!isRecord(v)) return { ok: false, error: `${NAMES.question_mode}: 객체여야 함` }
  const out: Partial<Record<QuestionSkill, QuestionMode>> = {}
  for (const [skill, mode] of Object.entries(v)) {
    if (!(SKILLS as readonly string[]).includes(skill)) {
      return { ok: false, error: `${NAMES.question_mode}: 모르는 스킬 ${skill}` }
    }
    if (!(QUESTION_MODES as readonly unknown[]).includes(mode)) {
      return {
        ok: false,
        error: `${NAMES.question_mode}(${skill}): ${QUESTION_MODES.join(' | ')} 중 하나여야 함`,
      }
    }
    out[skill as QuestionSkill] = mode as QuestionMode
  }
  return { ok: true, value: out }
}

/**
 * 단계별 자동 승인 (4.2). 없는 단계는 빼고, 켤 수 없는 단계(intake, verify)와 모르는 단계, 참·거짓이
 * 아닌 값은 오류다
 */
function autoApprove(v: unknown): Checked<Partial<Record<AutoApproveNode, boolean>>> {
  if (!isRecord(v)) return { ok: false, error: `${NAMES.auto_approve}: 객체여야 함` }
  const out: Partial<Record<AutoApproveNode, boolean>> = {}
  for (const [node, on] of Object.entries(v)) {
    if ((MANUAL_NODES as readonly string[]).includes(node)) {
      return {
        ok: false,
        error: `${NAMES.auto_approve}: ${node}는 켤 수 없음 (의도 승인, Work 완료는 늘 수동)`,
      }
    }
    if (!(AUTO_APPROVE_NODES as readonly string[]).includes(node)) {
      return { ok: false, error: `${NAMES.auto_approve}: 모르는 단계 ${node}` }
    }
    if (typeof on !== 'boolean') {
      return { ok: false, error: `${NAMES.auto_approve}(${node}): true/false여야 함` }
    }
    out[node as AutoApproveNode] = on
  }
  return { ok: true, value: out }
}

/**
 * config.json의 내용을 앱 설정으로 읽는다. 없는 키는 기본값을 쓰고, 값이 틀린 키도 기본값을 쓰며 경고한다.
 * 정의되지 않은 키는 무시한다.
 */
export function normalizeConfig(data: unknown): { config: AppConfig; warnings: string[] } {
  const warnings: string[] = []
  if (!isRecord(data)) {
    return { config: DEFAULT_CONFIG, warnings: ['config.json이 객체가 아니어서 기본값을 씀'] }
  }
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    auto_approve: { ...DEFAULT_CONFIG.auto_approve },
    question_mode: { ...DEFAULT_CONFIG.question_mode },
    agent_steps: {},
  }
  if (data['agent_engine'] !== undefined) {
    const r = agentEngine(data['agent_engine'])
    if (r.ok) config.agent_engine = r.value
    else warnings.push(`config.json ${r.error}. 기본값 claude를 씀`)
  }
  normalizeAgent(data, config, warnings)
  for (const key of Object.keys(RANGES) as IntegerKey[]) {
    if (data[key] === undefined) continue
    const r = integer(key, data[key])
    if (r.ok) config[key] = r.value
    else warnings.push(`config.json ${r.error}. 기본값 ${String(DEFAULT_CONFIG[key])}을 씀`)
  }
  for (const key of BOOLEAN_KEYS) {
    const v = data[key]
    if (v === undefined) continue
    if (typeof v === 'boolean') config[key] = v
    else warnings.push(`config.json ${key}: true/false여야 함. 기본값을 씀`)
  }
  if (data['reply_signature'] !== undefined) {
    const r = signature(data['reply_signature'])
    if (r.ok) config.reply_signature = r.value
    else warnings.push(`config.json ${r.error}. 기본값을 씀`)
  }
  if (data['knowledge_review_engine'] !== undefined) {
    const r = reviewEngine(data['knowledge_review_engine'])
    if (r.ok) config.knowledge_review_engine = r.value
    else warnings.push(`config.json ${r.error}. 기본값 claude를 씀`)
  }
  if (data['knowledge_review_model'] !== undefined) {
    const r = reviewModel(data['knowledge_review_model'])
    if (r.ok) config.knowledge_review_model = r.value
    else warnings.push(`config.json ${r.error}. 엔진의 기본을 씀`)
  }
  if (data['theme'] !== undefined) {
    const r = theme(data['theme'])
    if (r.ok) config.theme = r.value
    else warnings.push(`config.json ${r.error}. 기본값 system을 씀`)
  }
  if (data['question_mode'] !== undefined) {
    const r = questionModes(data['question_mode'])
    if (r.ok) config.question_mode = { ...config.question_mode, ...r.value }
    else warnings.push(`config.json ${r.error}. 기본값을 씀`)
  }
  if (data['auto_approve'] !== undefined) {
    const r = autoApprove(data['auto_approve'])
    if (r.ok) config.auto_approve = { ...config.auto_approve, ...r.value }
    else warnings.push(`config.json ${r.error}. 기본값을 씀`)
  }
  return { config, warnings }
}

/**
 * 설정 화면에서 바꾼 값을 적용한다 (D70). 바꿀 수 있는 키만 받고, 값이 틀리면 아무것도 바꾸지 않는다.
 * 질문 방식은 스킬마다, 자동 승인과 상세 설정은 단계마다 덮어쓴다. 상세 설정의 빈 객체는 그 단계를 지운다. 엔진·모델·
 * 추론 수준은 바꾼 뒤의 값끼리 맞아야 한다.
 */
export function applyConfigPatch(current: AppConfig, patch: unknown): Checked<AppConfig> {
  if (!isRecord(patch)) return { ok: false, error: '설정 값이 객체가 아님' }
  const next: AppConfig = {
    ...current,
    auto_approve: { ...current.auto_approve },
    question_mode: { ...current.question_mode },
    agent_steps: { ...current.agent_steps },
  }
  for (const [key, v] of Object.entries(patch)) {
    if (!(EDITABLE_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `설정 화면에서 바꿀 수 없는 값: ${key}` }
    }
    if (key === 'agent_engine') {
      const r = agentEngine(v)
      if (!r.ok) return r
      next.agent_engine = r.value
    } else if (key === 'agent_model' || key === 'agent_effort') {
      const r = agentText(key === 'agent_model' ? '기본 모델' : '기본 추론 수준', v)
      if (!r.ok) return r
      next[key] = r.value
    } else if (key === 'agent_steps') {
      if (!isRecord(v)) return { ok: false, error: '상세 설정: 객체여야 함' }
      for (const [skill, step] of Object.entries(v)) {
        const r = agentStep(skill, step)
        if (!r.ok) return r
        if (Object.keys(r.value).length) next.agent_steps[skill as SkillName] = r.value
        else delete next.agent_steps[skill as SkillName]
      }
    } else if (key === 'knowledge_review_engine') {
      const r = reviewEngine(v)
      if (!r.ok) return r
      next.knowledge_review_engine = r.value
    } else if (key === 'knowledge_review_model') {
      const r = reviewModel(v)
      if (!r.ok) return r
      next.knowledge_review_model = r.value
    } else if (key === 'theme') {
      const r = theme(v)
      if (!r.ok) return r
      next.theme = r.value
    } else if ((BOOLEAN_KEYS as readonly string[]).includes(key)) {
      const k = key as BooleanKey
      if (typeof v !== 'boolean') return { ok: false, error: `${NAMES[k]}: true/false여야 함` }
      next[k] = v
    } else if (key === 'reply_signature') {
      const r = signature(v)
      if (!r.ok) return r
      next.reply_signature = r.value
    } else if (key === 'question_mode') {
      const r = questionModes(v)
      if (!r.ok) return r
      next.question_mode = { ...next.question_mode, ...r.value }
    } else if (key === 'auto_approve') {
      const r = autoApprove(v)
      if (!r.ok) return r
      next.auto_approve = { ...next.auto_approve, ...r.value }
    } else {
      const k = key as IntegerKey
      const r = integer(k, v)
      if (!r.ok) return r
      next[k] = r.value
    }
  }
  const why =
    defaultModelFits(next) ??
    defaultEffortFits(next) ??
    Object.entries(next.agent_steps)
      .map(([skill, step]) => stepFits(next.agent_engine, skill, step))
      .find((w) => w !== null)
  if (why) return { ok: false, error: why }
  return { ok: true, value: next }
}

const WORK_KEYS = ['auto_approve', 'question_mode', 'respond_auto_start'] as const

/**
 * Work별 설정 (D72): 단계별 자동 승인, 스킬별 질문 방식, 대응 자동 시작(D154). 준 키만 돌려주고, 빈 값은 그 키를 앱
 * 설정으로 되돌린다는 뜻이다(mergeWorkSettings): 자동 승인과 질문 방식은 빈 객체, 대응 자동 시작은 null이다. 단계나
 * 스킬을 빼면 앱 설정을 따른다.
 */
export function checkWorkSettings(input: unknown): Checked<WorkSettingsPatch> {
  if (!isRecord(input)) return { ok: false, error: 'Work 설정이 객체가 아님' }
  const out: WorkSettingsPatch = {}
  for (const [key, v] of Object.entries(input)) {
    if (!(WORK_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `Work 설정에서 바꿀 수 없는 값: ${key}` }
    }
    if (v === undefined) continue
    if (key === 'respond_auto_start') {
      if (v !== null && typeof v !== 'boolean') {
        return { ok: false, error: `${NAMES.respond_auto_start}: true/false나 null이어야 함` }
      }
      out.respond_auto_start = v
    } else if (key === 'question_mode') {
      const r = questionModes(v)
      if (!r.ok) return r
      out.question_mode = r.value
    } else {
      const r = autoApprove(v)
      if (!r.ok) return r
      out.auto_approve = r.value
    }
  }
  return { ok: true, value: out }
}

/**
 * Work 설정을 바꾼다 (D72). patch에 있는 키만 바꾸고, 빈 값(빈 객체, null)이면 그 키를 지워 앱 설정을 따른다.
 * 자동 승인과 대응 자동 시작은 바로, 질문 방식은 다음에 시작하는 task부터 쓴다 (D73). 대응 자동 시작을 켜도 이미 받은
 * 새 항목으로는 시작하지 않는다 (D210)
 */
export function mergeWorkSettings(current: WorkSettings, patch: WorkSettingsPatch): WorkSettings {
  const pick = <T extends object>(now: T | undefined, next: T | undefined): T | undefined =>
    next === undefined ? now : Object.keys(next).length ? { ...next } : undefined
  const auto = pick(current.auto_approve, patch.auto_approve)
  const modes = pick(current.question_mode, patch.question_mode)
  const start =
    patch.respond_auto_start === undefined
      ? current.respond_auto_start
      : (patch.respond_auto_start ?? undefined)
  return {
    ...(auto ? { auto_approve: auto } : {}),
    ...(modes ? { question_mode: modes } : {}),
    ...(start === undefined ? {} : { respond_auto_start: start }),
  }
}

// ---------- 프로젝트 설정 (5.1.2, D185) ----------

const MERGE_METHOD_VALUES: readonly MergeMethod[] = ['merge', 'squash', 'rebase']

/**
 * 프로젝트 설정 화면의 값 (5.1.2, D185): 받을 봇(D161, D197)과 기본 머지 방식(D177), 이슈 기록(D337). 봇 이름은 앞뒤
 * 공백을 떼고 빈 이름과 같은 이름은 뺀다. 머지 방식은 merge, squash, rebase나 null(레포가 허용하는 첫 방식)이다. 이슈 기록이
 * 없으면 바꾸지 않는다
 */
export function checkProjectSettings(input: unknown): Checked<ProjectSettings> {
  if (!isRecord(input)) return { ok: false, error: '프로젝트 설정이 객체가 아님' }
  const bots = input['allowed_bots']
  if (!Array.isArray(bots) || !bots.every((b) => typeof b === 'string')) {
    return { ok: false, error: '받을 봇: 문자열 목록이어야 함' }
  }
  const method = input['merge_method']
  if (method !== null && !(MERGE_METHOD_VALUES as readonly unknown[]).includes(method)) {
    return {
      ok: false,
      error: `기본 머지 방식: ${MERGE_METHOD_VALUES.join(' | ')}나 null이어야 함`,
    }
  }
  const issueLog = input['issue_log']
  if (issueLog !== undefined && typeof issueLog !== 'boolean') {
    return { ok: false, error: '이슈 기록: true/false여야 함' }
  }
  const names = [...new Set(bots.map((b: string) => b.trim()).filter(Boolean))]
  return {
    ok: true,
    value: {
      allowed_bots: names,
      merge_method: method as MergeMethod | null,
      ...(issueLog === undefined ? {} : { issue_log: issueLog }),
    },
  }
}
