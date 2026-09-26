// 앱 설정(config.json, 5.1.1)과 Work별 설정(D72)의 검사. config.json을 읽을 때와 설정 화면(D70)이
// 같은 규칙을 쓴다. 바꾼 값은 바로 적용되고, 질문 방식만 다음에 시작하는 task부터 쓴다(D73). 적용은 main이 한다.
import {
  DEFAULT_CONFIG,
  SKILL_TITLES,
  type AppConfig,
  type QuestionMode,
  type SkillName,
  type WorkSettings,
} from '../shared/config'

export const SKILLS: readonly SkillName[] = SKILL_TITLES.map(([skill]) => skill)

export const QUESTION_MODES: readonly QuestionMode[] = ['draft_first', 'confirm_each']

/** 설정 화면에서 바꾸는 값 (D70). 자동 승인과 카운트다운은 자동 승인을 넣는 M7에서 연다 */
export const EDITABLE_KEYS = [
  'session_limit',
  'question_mode',
  'pr_draft',
  'handoff_body_warn_chars',
  'intent_warn_chars',
  'format_error_bounce_max',
] as const

export type EditableKey = (typeof EDITABLE_KEYS)[number]

export type ConfigPatch = Partial<Pick<AppConfig, EditableKey>>

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string }

type IntegerKey =
  | 'session_limit'
  | 'format_error_bounce_max'
  | 'handoff_body_warn_chars'
  | 'intent_warn_chars'
  | 'auto_approve_countdown_sec'

/**
 * 정수 값의 범위. 되돌림 횟수는 8을 넘겨도 소용이 없다: Stop 훅으로 연속 8번 이어 가면
 * Claude Code가 다음 막음을 무시한다(docs/implementation.md 3절, CLAUDE_CODE_STOP_HOOK_BLOCK_CAP).
 */
const RANGES: Readonly<Record<IntegerKey, readonly [number, number]>> = {
  session_limit: [1, 20],
  format_error_bounce_max: [0, 8],
  handoff_body_warn_chars: [1, 1_000_000],
  intent_warn_chars: [1, 1_000_000],
  auto_approve_countdown_sec: [1, 3600],
}

const NAMES: Readonly<Record<IntegerKey | 'question_mode' | 'pr_draft', string>> = {
  session_limit: '세션 상한',
  format_error_bounce_max: '형식 오류 되돌림 횟수',
  handoff_body_warn_chars: 'handoff 본문 분량 경고 기준',
  intent_warn_chars: 'intent 분량 경고 기준',
  auto_approve_countdown_sec: '자동 승인 카운트다운',
  question_mode: '질문 방식',
  pr_draft: 'draft PR',
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function integer(key: IntegerKey, v: unknown): Checked<number> {
  const [min, max] = RANGES[key]
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    return { ok: false, error: `${NAMES[key]}: ${min}~${max}의 정수여야 함 (지금: ${String(v)})` }
  }
  return { ok: true, value: v }
}

/** 스킬별 질문 방식. 없는 스킬은 빼고, 모르는 스킬이나 값은 오류다 */
function questionModes(v: unknown): Checked<Partial<Record<SkillName, QuestionMode>>> {
  if (!isRecord(v)) return { ok: false, error: `${NAMES.question_mode}: 객체여야 함` }
  const out: Partial<Record<SkillName, QuestionMode>> = {}
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
    out[skill as SkillName] = mode as QuestionMode
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
  }
  for (const key of Object.keys(RANGES) as IntegerKey[]) {
    if (data[key] === undefined) continue
    const r = integer(key, data[key])
    if (r.ok) config[key] = r.value
    else warnings.push(`config.json ${r.error}. 기본값 ${String(DEFAULT_CONFIG[key])}을 씀`)
  }
  if (data['pr_draft'] !== undefined) {
    if (typeof data['pr_draft'] === 'boolean') config.pr_draft = data['pr_draft']
    else warnings.push('config.json pr_draft: true/false여야 함. 기본값을 씀')
  }
  if (data['question_mode'] !== undefined) {
    const r = questionModes(data['question_mode'])
    if (r.ok) config.question_mode = { ...config.question_mode, ...r.value }
    else warnings.push(`config.json ${r.error}. 기본값을 씀`)
  }
  const auto = data['auto_approve']
  if (auto !== undefined) {
    if (isRecord(auto) && Object.values(auto).every((v) => typeof v === 'boolean')) {
      for (const node of ['evidence', 'rca', 'fix'] as const) {
        const v = auto[node]
        if (typeof v === 'boolean') config.auto_approve[node] = v
      }
    } else {
      warnings.push('config.json auto_approve: 노드마다 true/false여야 함. 기본값을 씀')
    }
  }
  return { config, warnings }
}

/**
 * 설정 화면에서 바꾼 값을 적용한다 (D70). 바꿀 수 있는 키만 받고, 값이 틀리면 아무것도 바꾸지 않는다.
 * 질문 방식은 스킬마다 덮어쓴다.
 */
export function applyConfigPatch(current: AppConfig, patch: unknown): Checked<AppConfig> {
  if (!isRecord(patch)) return { ok: false, error: '설정 값이 객체가 아님' }
  const next: AppConfig = { ...current, question_mode: { ...current.question_mode } }
  for (const [key, v] of Object.entries(patch)) {
    if (!(EDITABLE_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `설정 화면에서 바꿀 수 없는 값: ${key}` }
    }
    if (key === 'pr_draft') {
      if (typeof v !== 'boolean')
        return { ok: false, error: `${NAMES.pr_draft}: true/false여야 함` }
      next.pr_draft = v
    } else if (key === 'question_mode') {
      const r = questionModes(v)
      if (!r.ok) return r
      next.question_mode = { ...next.question_mode, ...r.value }
    } else {
      const k = key as IntegerKey
      const r = integer(k, v)
      if (!r.ok) return r
      next[k] = r.value
    }
  }
  return { ok: true, value: next }
}

/**
 * Work별 설정 (D72). M3는 질문 방식만 덮어쓴다. 스킬을 빼면 앱 설정을 따른다.
 * 자동 승인 덮어쓰기는 M7에서 연다.
 */
export function checkWorkSettings(input: unknown): Checked<WorkSettings> {
  if (!isRecord(input)) return { ok: false, error: 'Work 설정이 객체가 아님' }
  for (const key of Object.keys(input)) {
    if (key !== 'question_mode')
      return { ok: false, error: `Work 설정에서 바꿀 수 없는 값: ${key}` }
  }
  if (input['question_mode'] === undefined) return { ok: true, value: {} }
  const r = questionModes(input['question_mode'])
  if (!r.ok) return r
  return { ok: true, value: Object.keys(r.value).length ? { question_mode: r.value } : {} }
}
