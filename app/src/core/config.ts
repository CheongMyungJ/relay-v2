// 앱 설정(config.json, 5.1.1)과 Work별 설정(D72)의 검사. config.json을 읽을 때와 설정 화면(D70)이
// 같은 규칙을 쓴다. 바꾼 값은 바로 적용되고, 질문 방식만 다음에 시작하는 task부터 쓴다(D73). 자동 승인은 턴이 끝날 때의
// 설정으로 판정하고, 카운트다운 중에 끄면 바로 멈춘다(D128). 적용은 main이 한다.
import {
  AUTO_APPROVE_TITLES,
  DEFAULT_CONFIG,
  SKILL_TITLES,
  type AppConfig,
  type AutoApproveNode,
  type QuestionMode,
  type SkillName,
  type WorkSettings,
} from '../shared/config'
import type { NodeName } from '../shared/contracts'
import type { ProjectSettings } from '../shared/project'
import type { MergeMethod } from '../shared/work'
import { NODES } from './pipeline'

export const SKILLS: readonly SkillName[] = SKILL_TITLES.map(([skill]) => skill)

export const QUESTION_MODES: readonly QuestionMode[] = ['draft_first', 'confirm_each']

/** 자동 승인을 켤 수 있는 노드 (4.2). intake(의도 승인), review(D167), verify(Work 완료)는 늘 수동이다 */
export const AUTO_APPROVE_NODES: readonly AutoApproveNode[] = AUTO_APPROVE_TITLES.map(([n]) => n)

/**
 * 늘 수동인 노드: 자동 승인을 켤 수 있는 노드의 나머지. 의도 승인, 리뷰(D167), Work 완료다 (4.2). 자동 승인에
 * 이 키가 있으면 켜든 끄든 받지 않는다
 */
const MANUAL_NODES: readonly NodeName[] = NODES.filter(
  (n) => !(AUTO_APPROVE_NODES as readonly NodeName[]).includes(n),
)

/** 설정 화면에서 바꾸는 값 (D70) */
export const EDITABLE_KEYS = [
  'session_limit',
  'auto_approve',
  'auto_approve_countdown_sec',
  'question_mode',
  'pr_draft',
  'handoff_body_warn_chars',
  'intent_warn_chars',
  'format_error_bounce_max',
  'pr_poll_interval_sec',
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
  | 'pr_poll_interval_sec'

/**
 * 정수 값의 범위. 되돌림 횟수는 8을 넘겨도 소용이 없다: Stop 훅으로 연속 8번 이어 가면
 * Claude Code가 다음 막음을 무시한다(docs/implementation.md 3절, CLAUDE_CODE_STOP_HOOK_BLOCK_CAP).
 * PR 읽기 주기는 30초~1시간이다 **(기본값)**: 한 번 읽기가 GraphQL 1점과 REST 3번이라(S7) 30초여도 PR 하나에 시간당
 * 한도(각 5,000)의 약 7%다.
 */
const RANGES: Readonly<Record<IntegerKey, readonly [number, number]>> = {
  session_limit: [1, 20],
  format_error_bounce_max: [0, 8],
  handoff_body_warn_chars: [1, 1_000_000],
  intent_warn_chars: [1, 1_000_000],
  auto_approve_countdown_sec: [1, 3600],
  pr_poll_interval_sec: [30, 3600],
}

const NAMES: Readonly<Record<IntegerKey | 'question_mode' | 'pr_draft' | 'auto_approve', string>> =
  {
    session_limit: '세션 상한',
    format_error_bounce_max: '형식 오류 되돌림 횟수',
    handoff_body_warn_chars: 'handoff 본문 분량 경고 기준',
    intent_warn_chars: 'intent 분량 경고 기준',
    auto_approve_countdown_sec: '자동 승인 카운트다운',
    pr_poll_interval_sec: 'PR 읽기 주기',
    question_mode: '질문 방식',
    pr_draft: 'draft PR',
    auto_approve: '자동 승인',
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
 * 단계별 자동 승인 (4.2). 없는 단계는 빼고, 켤 수 없는 단계(intake, review, verify)와 모르는 단계, 참·거짓이
 * 아닌 값은 오류다 (D167)
 */
function autoApprove(v: unknown): Checked<Partial<Record<AutoApproveNode, boolean>>> {
  if (!isRecord(v)) return { ok: false, error: `${NAMES.auto_approve}: 객체여야 함` }
  const out: Partial<Record<AutoApproveNode, boolean>> = {}
  for (const [node, on] of Object.entries(v)) {
    if ((MANUAL_NODES as readonly string[]).includes(node)) {
      return {
        ok: false,
        error: `${NAMES.auto_approve}: ${node}는 켤 수 없음 (의도 승인, 리뷰, Work 완료는 늘 수동)`,
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
  if (data['auto_approve'] !== undefined) {
    const r = autoApprove(data['auto_approve'])
    if (r.ok) config.auto_approve = { ...config.auto_approve, ...r.value }
    else warnings.push(`config.json ${r.error}. 기본값을 씀`)
  }
  return { config, warnings }
}

/**
 * 설정 화면에서 바꾼 값을 적용한다 (D70). 바꿀 수 있는 키만 받고, 값이 틀리면 아무것도 바꾸지 않는다.
 * 질문 방식은 스킬마다, 자동 승인은 단계마다 덮어쓴다.
 */
export function applyConfigPatch(current: AppConfig, patch: unknown): Checked<AppConfig> {
  if (!isRecord(patch)) return { ok: false, error: '설정 값이 객체가 아님' }
  const next: AppConfig = {
    ...current,
    auto_approve: { ...current.auto_approve },
    question_mode: { ...current.question_mode },
  }
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
  return { ok: true, value: next }
}

const WORK_KEYS = ['auto_approve', 'question_mode'] as const

/**
 * Work별 설정 (D72): 단계별 자동 승인과 스킬별 질문 방식. 준 키만 돌려주고, 빈 값은 그 키를 앱 설정으로 되돌린다는
 * 뜻이다(mergeWorkSettings). 단계나 스킬을 빼면 앱 설정을 따른다.
 */
export function checkWorkSettings(input: unknown): Checked<WorkSettings> {
  if (!isRecord(input)) return { ok: false, error: 'Work 설정이 객체가 아님' }
  const out: WorkSettings = {}
  for (const [key, v] of Object.entries(input)) {
    if (!(WORK_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `Work 설정에서 바꿀 수 없는 값: ${key}` }
    }
    if (v === undefined) continue
    if (key === 'question_mode') {
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
 * Work 설정을 바꾼다 (D72). patch에 있는 키만 바꾸고, 빈 값이면 그 키를 지워 앱 설정을 따른다.
 * 자동 승인은 바로, 질문 방식은 다음에 시작하는 task부터 쓴다 (D73)
 */
export function mergeWorkSettings(current: WorkSettings, patch: WorkSettings): WorkSettings {
  const pick = <T extends object>(now: T | undefined, next: T | undefined): T | undefined =>
    next === undefined ? now : Object.keys(next).length ? { ...next } : undefined
  const auto = pick(current.auto_approve, patch.auto_approve)
  const modes = pick(current.question_mode, patch.question_mode)
  return {
    ...(auto ? { auto_approve: auto } : {}),
    ...(modes ? { question_mode: modes } : {}),
  }
}

// ---------- 프로젝트 설정 (5.1.2, D185) ----------

const MERGE_METHOD_VALUES: readonly MergeMethod[] = ['merge', 'squash', 'rebase']

/**
 * 프로젝트 설정 화면의 값 (5.1.2, D185): 받을 봇(D161, D197)과 기본 머지 방식(D177). 봇 이름은 앞뒤 공백을 떼고
 * 빈 이름과 같은 이름은 뺀다. 머지 방식은 merge, squash, rebase나 null(레포가 허용하는 첫 방식)이다
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
  const names = [...new Set(bots.map((b: string) => b.trim()).filter(Boolean))]
  return { ok: true, value: { allowed_bots: names, merge_method: method as MergeMethod | null } }
}
