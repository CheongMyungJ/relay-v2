// 설정 화면의 짜임 (D527~D531): 구역, 칸의 이름과 한 줄 설명, 찾기, 기본값과 다른 칸, 단계별 진행 표의 줄, 진행 방식 묶음.
// 화면(Settings.tsx)이 이것으로 그리고 [단위] settings-view.test.ts가 규칙을 본다
import { changeDefaultEngine, changeDefaultModel } from '../../shared/agent'
import {
  AGENT_STEP_TITLES,
  AUTO_APPROVE_TITLES,
  DEFAULT_CONFIG,
  SETTING_GROUP_LABEL,
  SKILL_TITLES,
  groupShown,
  type AgentStepName,
  type AppConfig,
  type AutoApproveNode,
  type QuestionMode,
  type QuestionSkill,
  type SettingGroup,
} from '../../shared/config'
import type { WorkType } from '../../shared/work'

// ---------- 구역 (D527) ----------

export type SettingsSection = 'general' | 'agent' | 'steps' | 'pr' | 'advanced'

/** 왼쪽 목록의 차례. 자주 바꾸는 구역이 앞이고, 거의 바꾸지 않는 조정값은 고급에 모은다 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  'general',
  'agent',
  'steps',
  'pr',
  'advanced',
]

export const SECTION_LABEL: Readonly<Record<SettingsSection, string>> = {
  general: '일반',
  agent: '에이전트',
  steps: '단계별 진행',
  pr: 'PR',
  advanced: '고급',
}

// ---------- 하나짜리 칸 ----------

/** 단계별 진행 표 밖의 칸: 값 하나짜리 앱 설정 */
export type ScalarKey =
  | 'theme'
  | 'session_limit'
  | 'session_dir'
  | 'side_notice'
  | 'agent_engine'
  | 'agent_model'
  | 'agent_effort'
  | 'auto_approve_countdown_sec'
  | 'code_review'
  | 'pr_draft'
  | 'respond_auto_start'
  | 'respond_auto_round_max'
  | 'reply_signature'
  | 'pr_poll_interval_sec'
  | 'format_error_bounce_max'
  | 'handoff_body_warn_chars'
  | 'intent_warn_chars'
  | 'knowledge_review_engine'
  | 'knowledge_review_model'

export interface SettingEntry {
  key: ScalarKey
  section: SettingsSection
  /** 칸의 이름. 입력의 aria-label이기도 하다 */
  label: string
  /** 칸 아래에 늘 보이는 한 줄 설명 */
  help: string
}

/** 구역 안의 차례대로 둔다. 화면에 보이는 글에는 결정 번호와 단계 id를 적지 않는다 (D530) */
export const SETTING_ENTRIES: readonly SettingEntry[] = [
  {
    key: 'theme',
    section: 'general',
    label: '테마',
    help: '앱 화면의 밝기. 터미널은 늘 어둡습니다',
  },
  {
    key: 'session_limit',
    section: 'general',
    label: '세션 상한',
    help: '동시에 살아 있는 세션의 수. 넘으면 대기열에서 기다립니다',
  },
  {
    key: 'session_dir',
    section: 'general',
    label: '기본 세션 폴더',
    help: '[새 세션] 창에 채울 폴더(절대 경로). 비우면 <RELAY_HOME>/home/',
  },
  {
    key: 'side_notice',
    section: 'general',
    label: '곁 세션을 열 때 안내 보기',
    help: '곁 세션을 열 때 쓰임과 쓰는 법을 알리는 창을 띄웁니다',
  },
  {
    key: 'agent_engine',
    section: 'agent',
    label: '기본 엔진',
    help: 'Work의 단계를 돌리는 CLI. 단계마다 다르게 하려면 [단계별 진행]에서 고릅니다',
  },
  {
    key: 'agent_model',
    section: 'agent',
    label: '기본 모델',
    help: '비우면 엔진의 기본 모델을 씁니다',
  },
  {
    key: 'agent_effort',
    section: 'agent',
    label: '기본 추론 수준',
    help: '비우면 엔진의 기본을 씁니다',
  },
  {
    key: 'auto_approve_countdown_sec',
    section: 'steps',
    label: '자동 승인 카운트다운(초)',
    help: '자동 승인 전에 기다리는 초. 그사이 [취소]로 멈춥니다',
  },
  {
    key: 'code_review',
    section: 'steps',
    label: '독립 리뷰의 코드 리뷰',
    help: 'Work 마무리에 따로 돌리는 코드 리뷰. 끄면 판정표만 확인합니다',
  },
  {
    key: 'pr_draft',
    section: 'pr',
    label: 'draft PR로 만들기',
    help: 'Work 완료 화면의 [PR 생성]이 draft PR을 만듭니다',
  },
  {
    key: 'respond_auto_start',
    section: 'pr',
    label: '대응 자동 시작',
    help: 'PR에 새 코멘트나 실패한 CI가 들어오면 PR 대응 task를 저절로 시작합니다',
  },
  {
    key: 'respond_auto_round_max',
    section: 'pr',
    label: '자동 대응 라운드 상한',
    help: '사람이 누르지 않고 이어지는 대응 라운드의 상한. 닿으면 멈추고 알립니다',
  },
  {
    key: 'reply_signature',
    section: 'pr',
    label: '답글 표시 문구',
    help: '앱이 내 계정으로 게시하는 PR 답글 끝에 붙여 AI가 썼다고 알립니다',
  },
  {
    key: 'pr_poll_interval_sec',
    section: 'pr',
    label: 'PR 읽기 주기(초)',
    help: 'PR 진행인 Work의 PR을 읽는 주기',
  },
  {
    key: 'format_error_bounce_max',
    section: 'advanced',
    label: '형식 오류 되돌림 횟수',
    help: '에이전트가 쓴 handoff의 형식이 틀리면 고치라고 되돌리는 연속 횟수',
  },
  {
    key: 'handoff_body_warn_chars',
    section: 'advanced',
    label: 'handoff 본문 분량 경고 기준',
    help: '글자 수. 넘으면 경고만 합니다',
  },
  {
    key: 'intent_warn_chars',
    section: 'advanced',
    label: 'intent 분량 경고 기준',
    help: '글자 수. 넘으면 경고만 합니다',
  },
  {
    key: 'knowledge_review_engine',
    section: 'advanced',
    label: '지식 검토 엔진',
    help: '마무리 단계가 팀 지식을 바꾸면 따로 부르는 짧은 검토의 CLI',
  },
  {
    key: 'knowledge_review_model',
    section: 'advanced',
    label: '지식 검토 모델',
    help: '비우면 엔진의 기본(Claude Code는 sonnet)을 씁니다',
  },
]

export function scalarChanged(config: AppConfig, key: ScalarKey): boolean {
  return config[key] !== DEFAULT_CONFIG[key]
}

/** 칸 하나를 기본값으로 되돌린다. 엔진과 모델은 단계별 설정을 함께 맞추는 함수로 바꾼다 */
export function resetScalar(config: AppConfig, key: ScalarKey): AppConfig {
  if (key === 'agent_engine') return changeDefaultEngine(config, DEFAULT_CONFIG.agent_engine)
  if (key === 'agent_model') return changeDefaultModel(config, DEFAULT_CONFIG.agent_model)
  return { ...config, [key]: DEFAULT_CONFIG[key] }
}

// ---------- 단계별 진행 표 (D528) ----------

/** 표의 한 줄: 단계 하나의 자동 승인, 질문 방식, 엔진·모델·추론 수준 */
export interface StepRow {
  skill: AgentStepName
  title: string
  group: SettingGroup
  /** 자동 승인의 노드. 없으면 autoNote를 보인다 */
  auto: AutoApproveNode | null
  /** 질문 방식의 스킬. 없으면 questionNote를 보인다 */
  question: QuestionSkill | null
  autoNote: string
  questionNote: string
  /** 옛 Work에만 있는 단계 (verify, D501) */
  oldOnly: boolean
}

const AUTO_NODES = new Set<string>(AUTO_APPROVE_TITLES.map(([node]) => node))
const QUESTION_SKILLS = new Set<string>(SKILL_TITLES.map(([skill]) => skill))

/** 단계의 자동 승인 노드. PR 대응은 스킬이 pr-respond이고 노드가 respond다 */
function autoNode(skill: AgentStepName): AutoApproveNode | null {
  const node = skill === 'pr-respond' ? 'respond' : skill
  return AUTO_NODES.has(node) ? (node as AutoApproveNode) : null
}

function autoNote(skill: AgentStepName): string {
  if (skill === 'work-start' || skill === 'verify') return '늘 수동'
  if (skill === 'custom') return '유형마다'
  return '—'
}

function questionNote(skill: AgentStepName): string {
  if (skill === 'spec') return '늘 결정마다 확인'
  if (skill === 'custom') return '유형마다'
  return '—'
}

/** 상세 설정의 모든 단계와 곁 세션, 기본 세션. 차례는 AGENT_STEP_TITLES(노드의 화면 순서)다 */
export const STEP_ROWS: readonly StepRow[] = AGENT_STEP_TITLES.map(([skill, title, group]) => {
  const auto = autoNode(skill)
  const question = QUESTION_SKILLS.has(skill) ? (skill as QuestionSkill) : null
  return {
    skill,
    title,
    group,
    auto,
    question,
    autoNote: auto ? '' : autoNote(skill),
    questionNote: question ? '' : questionNote(skill),
    oldOnly: skill === 'verify',
  }
})

/** 줄의 찾기 글: 이름, 묶음 이름, 그 줄에서 고를 수 있는 것 */
function stepText(row: StepRow): string {
  return [
    row.title,
    SETTING_GROUP_LABEL[row.group],
    row.auto ? '자동 승인' : '',
    row.question ? '질문 방식' : '',
    '엔진 모델 추론 수준',
  ].join(' ')
}

export function stepChanged(config: AppConfig, row: StepRow): boolean {
  const agent = config.agent_steps[row.skill]
  return (
    (row.auto !== null &&
      config.auto_approve[row.auto] !== DEFAULT_CONFIG.auto_approve[row.auto]) ||
    (row.question !== null &&
      config.question_mode[row.question] !== DEFAULT_CONFIG.question_mode[row.question]) ||
    (agent !== undefined && Object.keys(agent).length > 0)
  )
}

/** 줄 하나를 기본값으로: 자동 승인, 질문 방식, 단계의 엔진·모델·추론 수준 */
export function resetStep(config: AppConfig, row: StepRow): AppConfig {
  const steps = Object.fromEntries(
    Object.entries(config.agent_steps).filter(([skill]) => skill !== row.skill),
  )
  return {
    ...config,
    auto_approve: row.auto
      ? { ...config.auto_approve, [row.auto]: DEFAULT_CONFIG.auto_approve[row.auto] }
      : config.auto_approve,
    question_mode: row.question
      ? { ...config.question_mode, [row.question]: DEFAULT_CONFIG.question_mode[row.question] }
      : config.question_mode,
    agent_steps: steps,
  }
}

/**
 * Work 설정과 새 Work의 고급 설정에 보이는 줄: 자동 승인이나 질문 방식이 있는 단계 가운데 그 유형에서 보이는 것 (D256, I57).
 * 커스텀 단계는 유형 정의에서 오므로 부르는 쪽이 따로 넣는다. type이 null이면(유형을 고르기 전) 모든 유형의 줄이다
 */
export function workStepRows(type: WorkType | null): StepRow[] {
  return STEP_ROWS.filter(
    (r) =>
      (r.auto !== null || r.question !== null) &&
      r.group !== 'custom' &&
      (type === null || groupShown(r.group, type)),
  )
}

// ---------- 진행 방식 묶음 (D529) ----------

export type ProgressPreset = 'careful' | 'default' | 'delegate'

export const PROGRESS_PRESETS: readonly ProgressPreset[] = ['careful', 'default', 'delegate']

export const PRESET_LABEL: Readonly<Record<ProgressPreset, string>> = {
  careful: '꼼꼼히',
  default: '기본',
  delegate: '맡기기',
}

export const PRESET_HINT: Readonly<Record<ProgressPreset, string>> = {
  careful: '모든 단계를 사람이 승인하고, 에이전트는 결정마다 묻습니다.',
  default:
    '방향을 정하는 설계와 계획만 사람이 승인하고 나머지는 자동 승인합니다. 에이전트는 초안을 먼저 씁니다.',
  delegate:
    '설계와 계획까지 자동 승인합니다. 사람은 의도와 Work 완료만 봅니다. 에이전트는 초안을 먼저 씁니다.',
}

/**
 * 묶음이 정하는 단계: PR 대응을 뺀 Work의 단계. PR 대응의 자동 승인은 push와 답글 게시로 밖에 나가는 일이라 묶음이 켜지
 * 않고 표에서 따로 고른다
 */
const PRESET_NODES = AUTO_APPROVE_TITLES.filter(([, , g]) => g !== 'pr').map(([node]) => node)
const PRESET_SKILLS = SKILL_TITLES.filter(([, , g]) => g !== 'pr').map(([skill]) => skill)

function presetAuto(preset: ProgressPreset, node: AutoApproveNode): boolean {
  if (preset === 'careful') return false
  if (preset === 'delegate') return true
  return DEFAULT_CONFIG.auto_approve[node]
}

function presetQuestion(preset: ProgressPreset, skill: QuestionSkill): QuestionMode {
  if (preset === 'careful') return 'confirm_each'
  if (preset === 'delegate') return 'draft_first'
  return DEFAULT_CONFIG.question_mode[skill]
}

export function applyPreset(config: AppConfig, preset: ProgressPreset): AppConfig {
  const auto = { ...config.auto_approve }
  for (const node of PRESET_NODES) auto[node] = presetAuto(preset, node)
  const modes = { ...config.question_mode }
  for (const skill of PRESET_SKILLS) modes[skill] = presetQuestion(preset, skill)
  return { ...config, auto_approve: auto, question_mode: modes }
}

/** 지금 값이 맞는 묶음. 어느 것과도 다르면 null(직접 고름)이다 */
export function presetOf(config: AppConfig): ProgressPreset | null {
  return (
    PROGRESS_PRESETS.find(
      (p) =>
        PRESET_NODES.every((n) => config.auto_approve[n] === presetAuto(p, n)) &&
        PRESET_SKILLS.every((s) => config.question_mode[s] === presetQuestion(p, s)),
    ) ?? null
  )
}

// ---------- 찾기와 바꾼 칸만 보기 (D527) ----------

/** 찾는 말의 낱말이 모두 들어 있으면 맞는다. 띄어쓰기는 보지 않는다("자동승인"도 "자동 승인"에 맞음) */
export function matches(query: string, text: string): boolean {
  const hay = text.toLowerCase().replace(/\s+/g, '')
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word))
}

export interface SectionView {
  entries: SettingEntry[]
  steps: StepRow[]
}

export interface SettingsFilter {
  query: string
  changedOnly: boolean
}

/** 찾는 말이나 바꾼 칸만 보기가 있으면 구역을 가로질러 고른다 */
export function filtering(filter: SettingsFilter): boolean {
  return filter.query.trim() !== '' || filter.changedOnly
}

/**
 * 구역마다 보일 칸과 표의 줄. 걸러 보지 않으면 구역의 모든 것이다. 찾기는 칸의 이름, 설명, 구역 이름에서 찾고, 바꾼 칸만
 * 보기는 기본값과 다른 것만 남긴다
 */
export function sectionViews(
  config: AppConfig,
  filter: SettingsFilter,
): Record<SettingsSection, SectionView> {
  const query = filter.query.trim()
  const keepEntry = (e: SettingEntry) =>
    (!query || matches(query, `${e.label} ${e.help} ${SECTION_LABEL[e.section]}`)) &&
    (!filter.changedOnly || scalarChanged(config, e.key))
  const keepStep = (r: StepRow) =>
    (!query || matches(query, `${stepText(r)} ${SECTION_LABEL.steps}`)) &&
    (!filter.changedOnly || stepChanged(config, r))
  return Object.fromEntries(
    SETTINGS_SECTIONS.map((s) => [
      s,
      {
        entries: SETTING_ENTRIES.filter((e) => e.section === s && keepEntry(e)),
        steps: s === 'steps' ? STEP_ROWS.filter(keepStep) : [],
      },
    ]),
  ) as Record<SettingsSection, SectionView>
}

/** 구역마다 기본값과 다른 칸과 줄의 수. 왼쪽 목록에 보인다 */
export function changedCounts(config: AppConfig): Record<SettingsSection, number> {
  const views = sectionViews(config, { query: '', changedOnly: true })
  return Object.fromEntries(
    SETTINGS_SECTIONS.map((s) => [s, views[s].entries.length + views[s].steps.length]),
  ) as Record<SettingsSection, number>
}
