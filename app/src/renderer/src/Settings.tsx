// 설정 화면(D70, D527~D531)과 Work 설정(D72). 앱 설정은 구역(일반, 에이전트, 단계별 진행, PR, 고급)으로 나누고, 찾기와
// 바꾼 설정만 보기로 구역을 가로질러 고른다. 단계의 자동 승인, 질문 방식, 엔진·모델·추론 수준은 단계별 진행 표 하나에
// 모은다. Work 설정과 새 Work의 고급 설정은 같은 표에서 이 Work만 다르게 할 값을 고른다
import { useEffect, useState, type ReactNode } from 'react'
import {
  AGENT_APPROVAL_NOTICE,
  AGENT_ENGINES,
  AGENT_LABELS,
  AGENT_MODELS,
  changeDefaultEngine,
  changeDefaultModel,
  changeStepEngine,
  customModel,
  effortsFor,
  setAgentStep,
  stepModel,
  type AgentEngine,
  type AgentStep,
} from '../../shared/agent'
import {
  AGENT_STEP_TITLES,
  AUTO_APPROVE_TITLES,
  QUESTION_MODE_LABEL,
  SETTING_GROUP_LABEL,
  SKILL_TITLES,
  THEME_CHOICES,
  THEME_LABEL,
  groupShown,
  type AppConfig,
  type AutoApproveNode,
  type QuestionMode,
  type QuestionSkill,
  type SettingGroup,
  type ThemeChoice,
} from '../../shared/config'
import { WORK_TYPE_LABEL, type WorkType } from '../../shared/work'
import type { WorkView } from '../../shared/views'
import { call } from './commands'
import { Modal } from './Modal'
import {
  PRESET_HINT,
  PRESET_LABEL,
  PROGRESS_PRESETS,
  SECTION_LABEL,
  SETTINGS_SECTIONS,
  applyPreset,
  changedCounts,
  filtering,
  presetOf,
  resetScalar,
  resetStep,
  scalarChanged,
  sectionViews,
  stepChanged,
  workStepRows,
  type ScalarKey,
  type SectionView,
  type SettingEntry,
  type SettingsSection,
  type StepRow,
} from './settingsView'

/** 앱 설정. 대화상자를 열 때 읽는다 */
export function useConfig(): AppConfig | null {
  const [config, setConfig] = useState<AppConfig | null>(null)
  useEffect(() => {
    void window.relay.config().then(setConfig)
  }, [])
  return config
}

/** 설정 목록의 묶음 차례 (D256). 커스텀 단계는 일반 뒤, PR 대응 앞이다 */
const GROUPS: readonly SettingGroup[] = [
  'common',
  'bugfix',
  'feature',
  'refactor',
  'spec',
  'general',
  'custom',
  'pr',
]

/** 줄을 묶음마다 모은다. 빈 묶음은 뺀다 */
function byGroup<T extends { group: SettingGroup }>(rows: readonly T[]): [SettingGroup, T[]][] {
  return GROUPS.map((g): [SettingGroup, T[]] => [g, rows.filter((r) => r.group === g)]).filter(
    ([, list]) => list.length > 0,
  )
}

/** 그 유형에서 보이는 단계의 값만 남긴다 (D256) */
export function only<K extends string, V>(
  value: Partial<Record<K, V>>,
  items: readonly (readonly [K, string, SettingGroup])[],
  type: WorkType,
): Partial<Record<K, V>> {
  const shown = new Set(items.filter(([, , g]) => groupShown(g, type)).map(([k]) => k))
  return Object.fromEntries(Object.entries(value).filter(([k]) => shown.has(k as K))) as Partial<
    Record<K, V>
  >
}

const MODES = Object.entries(QUESTION_MODE_LABEL) as [QuestionMode, string][]

const onOff = (on: boolean) => (on ? '켜짐' : '꺼짐')

// ---------- 모델과 추론 수준 고르기 ----------

/** 모델 고르기에서 직접 입력을 뜻하는 값. 모델 이름에 쓸 수 없는 띄어쓰기로 시작한다 */
const CUSTOM_OPTION = ' custom'

/**
 * 엔진의 모델 고르기. 첫 선택지(빈 값)는 엔진 기본이나 기본 따름이다. 목록에 없는 모델은 [직접 입력]으로 쓸 수 있고, 앱이
 * 확인하지 않는다고 알린다
 */
function ModelSelect(props: {
  label: string
  engine: AgentEngine
  value: string
  empty: string
  onChange: (model: string) => void
}) {
  const [typing, setTyping] = useState(false)
  const custom = typing || customModel(props.engine, props.value)
  return (
    <span className="model-select">
      <select
        aria-label={props.label}
        value={custom ? CUSTOM_OPTION : props.value}
        onChange={(e) => {
          const picked = e.target.value
          setTyping(picked === CUSTOM_OPTION)
          props.onChange(picked === CUSTOM_OPTION ? '' : picked)
        }}
      >
        <option value="">{props.empty}</option>
        {AGENT_MODELS[props.engine].map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
        <option value={CUSTOM_OPTION}>직접 입력…</option>
      </select>
      {custom ? (
        <>
          <input
            aria-label={`${props.label} 직접 입력`}
            placeholder="모델 이름"
            value={props.value}
            onChange={(e) => props.onChange(e.target.value.trim())}
          />
          <span className="dim">
            직접 입력한 모델은 앱이 확인하지 않습니다. 이름이 틀리거나 고른 추론 수준을 받지 않으면
            CLI가 실패할 수 있습니다.
          </span>
        </>
      ) : null}
    </span>
  )
}

/** 추론 수준 고르기. 엔진·모델이 추론 수준을 지원하지 않으면 끄고 그렇다고 보인다 */
function EffortSelect(props: {
  label: string
  engine: AgentEngine
  model: string
  value: string
  empty: string
  onChange: (effort: string) => void
}) {
  const efforts = effortsFor(props.engine, props.model)
  const none = efforts.length === 0
  return (
    <span className="effort-select">
      <select
        aria-label={props.label}
        value={none ? '' : props.value}
        disabled={none}
        onChange={(e) => props.onChange(e.target.value)}
      >
        <option value="">{props.empty}</option>
        {efforts.map((effort) => (
          <option key={effort} value={effort}>
            {effort}
          </option>
        ))}
      </select>
      {none ? <span className="dim">이 모델은 추론 수준을 지원하지 않음</span> : null}
      {!none &&
      props.value !== '' &&
      (props.model === '' || customModel(props.engine, props.model)) ? (
        <span className="dim">
          {props.model === '' ? '엔진 기본 모델' : '직접 입력한 모델'}이 이 수준을 받지 않으면 CLI가
          거절하거나 무시할 수 있음
        </span>
      ) : null}
    </span>
  )
}

// ---------- 설정 줄 ----------

/**
 * 설정 한 줄: 이름과 한 줄 설명, 고르는 칸. 기본값과 다르면 표시와 [기본값으로](Work 설정은 [앱 설정으로])가 붙는다 (D531)
 */
function SettingRow({
  label,
  help,
  changed,
  resetLabel,
  onReset,
  children,
}: {
  label: string
  help?: ReactNode
  changed: boolean
  resetLabel: string
  onReset: () => void
  children: ReactNode
}) {
  return (
    <div className={changed ? 'setting-row changed' : 'setting-row'}>
      <div className="setting-name">
        <span className="setting-label">{label}</span>
        {changed ? (
          <button className="link" aria-label={`${label} ${resetLabel}`} onClick={onReset}>
            {resetLabel}
          </button>
        ) : null}
        {help ? <div className="dim setting-help">{help}</div> : null}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  )
}

/** 하나짜리 칸의 고르는 칸 */
function ScalarControl({
  entry,
  value,
  onChange,
}: {
  entry: SettingEntry
  value: AppConfig
  onChange: (next: AppConfig) => void
}) {
  const { key, label } = entry
  const set = <K extends ScalarKey>(k: K, v: AppConfig[K]) => onChange({ ...value, [k]: v })
  switch (key) {
    case 'theme':
      return (
        <select
          aria-label={label}
          value={value.theme}
          onChange={(e) => set('theme', e.target.value as ThemeChoice)}
        >
          {THEME_CHOICES.map((t) => (
            <option key={t} value={t}>
              {THEME_LABEL[t]}
            </option>
          ))}
        </select>
      )
    case 'agent_engine':
    case 'knowledge_review_engine':
      return (
        <select
          aria-label={label}
          value={value[key]}
          onChange={(e) => {
            const engine = e.target.value as AgentEngine
            onChange(
              key === 'agent_engine'
                ? changeDefaultEngine(value, engine)
                : { ...value, knowledge_review_engine: engine },
            )
          }}
        >
          {AGENT_ENGINES.map((engine) => (
            <option key={engine} value={engine}>
              {AGENT_LABELS[engine]}
            </option>
          ))}
        </select>
      )
    case 'agent_model':
      return (
        <ModelSelect
          label={label}
          engine={value.agent_engine}
          value={value.agent_model}
          empty="엔진 기본"
          onChange={(model) => onChange(changeDefaultModel(value, model))}
        />
      )
    case 'agent_effort':
      return (
        <EffortSelect
          label={label}
          engine={value.agent_engine}
          model={value.agent_model}
          value={value.agent_effort}
          empty="엔진 기본"
          onChange={(effort) => set('agent_effort', effort)}
        />
      )
    case 'side_notice':
    case 'code_review':
    case 'pr_draft':
    case 'respond_auto_start':
      return (
        <input
          type="checkbox"
          aria-label={label}
          checked={value[key]}
          onChange={(e) => set(key, e.target.checked)}
        />
      )
    case 'session_limit':
    case 'auto_approve_countdown_sec':
    case 'respond_auto_round_max':
    case 'pr_poll_interval_sec':
    case 'format_error_bounce_max':
    case 'handoff_body_warn_chars':
    case 'intent_warn_chars':
      return (
        <input
          type="number"
          aria-label={label}
          value={value[key]}
          onChange={(e) => set(key, Number(e.target.value))}
        />
      )
    case 'session_dir':
    case 'reply_signature':
    case 'knowledge_review_model':
      return (
        <input
          type="text"
          aria-label={label}
          placeholder={
            key === 'session_dir'
              ? '<RELAY_HOME>/home/'
              : key === 'knowledge_review_model'
                ? value.knowledge_review_engine === 'claude'
                  ? 'sonnet'
                  : 'CLI 기본'
                : ''
          }
          value={value[key]}
          onChange={(e) => set(key, e.target.value)}
        />
      )
  }
}

// ---------- 단계별 진행 표 (D528) ----------

/** 단계의 엔진·모델·추론 수준을 한 줄로: 고르지 않았으면 기본 따름 */
function agentSummary(step: AgentStep | undefined): string {
  const parts = [
    step?.engine ? AGENT_LABELS[step.engine] : '',
    step?.model ?? '',
    step?.effort ?? '',
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '기본 따름'
}

/** 진행 방식 묶음 (D529): 고르면 PR 대응을 뺀 단계의 자동 승인과 질문 방식을 그 묶음으로 바꾼다 */
function PresetPicker({
  value,
  onChange,
}: {
  value: AppConfig
  onChange: (next: AppConfig) => void
}) {
  const current = presetOf(value)
  return (
    <div className="field">
      진행 방식
      <div className="work-type" role="radiogroup" aria-label="진행 방식">
        {PROGRESS_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={current === p}
            className={current === p ? 'primary' : ''}
            title={PRESET_HINT[p]}
            onClick={() => onChange(applyPreset(value, p))}
          >
            {PRESET_LABEL[p]}
          </button>
        ))}
      </div>
      <div className="work-type-hint">
        {current
          ? PRESET_HINT[current]
          : '직접 고른 값입니다. 묶음을 누르면 아래 표의 자동 승인과 질문 방식을 그 묶음으로 바꿉니다.'}{' '}
        묶음은 PR 대응 줄을 바꾸지 않습니다.
      </div>
    </div>
  )
}

/** 앱 설정의 단계별 진행 표: 단계마다 자동 승인, 질문 방식, 엔진·모델·추론 수준 */
function StepTable({
  rows,
  value,
  onChange,
}: {
  rows: readonly StepRow[]
  value: AppConfig
  onChange: (next: AppConfig) => void
}) {
  const [agentOpen, setAgentOpen] = useState(false)
  return (
    <div className="step-table">
      <div className="step-head">
        <span>단계</span>
        <span>자동 승인</span>
        <span>질문 방식</span>
        <span>
          엔진·모델{' '}
          <button
            className="link"
            aria-expanded={agentOpen}
            onClick={() => setAgentOpen((o) => !o)}
          >
            {agentOpen ? '접기' : '단계마다 고르기'}
          </button>
        </span>
      </div>
      {byGroup(rows).map(([group, list]) => (
        <div
          key={group}
          className="form-group"
          role="group"
          aria-label={SETTING_GROUP_LABEL[group]}
        >
          <div className="form-group-title">{SETTING_GROUP_LABEL[group]}</div>
          {list.map((row) => {
            const step = value.agent_steps[row.skill] ?? {}
            const engine = step.engine ?? value.agent_engine
            const setStep = (next: AgentStep) =>
              onChange({
                ...value,
                agent_steps: setAgentStep(value.agent_steps, row.skill, next, value),
              })
            const changed = stepChanged(value, row)
            return (
              <div key={row.skill} className={changed ? 'step-row changed' : 'step-row'}>
                <span className="setting-name">
                  <span className="setting-label">{row.title}</span>
                  {row.oldOnly ? <span className="dim"> 옛 Work만</span> : null}
                  {changed ? (
                    <button
                      className="link"
                      aria-label={`${row.title} 기본값으로`}
                      onClick={() => onChange(resetStep(value, row))}
                    >
                      기본값으로
                    </button>
                  ) : null}
                </span>
                <span>
                  {row.auto ? (
                    <input
                      type="checkbox"
                      aria-label={`${row.title} 자동 승인`}
                      checked={value.auto_approve[row.auto]}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          auto_approve: {
                            ...value.auto_approve,
                            [row.auto as AutoApproveNode]: e.target.checked,
                          },
                        })
                      }
                    />
                  ) : (
                    <span className="dim">{row.autoNote}</span>
                  )}
                </span>
                <span>
                  {row.question ? (
                    <select
                      aria-label={`${row.title} 질문 방식`}
                      value={value.question_mode[row.question]}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          question_mode: {
                            ...value.question_mode,
                            [row.question as QuestionSkill]: e.target.value as QuestionMode,
                          },
                        })
                      }
                    >
                      {MODES.map(([mode, label]) => (
                        <option key={mode} value={mode}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="dim">{row.questionNote}</span>
                  )}
                </span>
                <span className="dim">{agentSummary(value.agent_steps[row.skill])}</span>
                {agentOpen ? (
                  <div className="step-agent">
                    <select
                      aria-label={`${row.title} 엔진`}
                      value={step.engine ?? ''}
                      onChange={(e) =>
                        setStep(
                          changeStepEngine(
                            value,
                            step,
                            (e.target.value || undefined) as AgentEngine | undefined,
                          ),
                        )
                      }
                    >
                      <option value="">앱 기본 따름</option>
                      {AGENT_ENGINES.map((e) => (
                        <option key={e} value={e}>
                          {AGENT_LABELS[e]}
                        </option>
                      ))}
                    </select>
                    <ModelSelect
                      label={`${row.title} 모델`}
                      engine={engine}
                      value={step.model ?? ''}
                      empty="기본 따름"
                      onChange={(model) => setStep({ ...step, model })}
                    />
                    <EffortSelect
                      label={`${row.title} 추론 수준`}
                      engine={engine}
                      model={stepModel(value, step)}
                      value={step.effort ?? ''}
                      empty="기본 따름"
                      onChange={(effort) => setStep({ ...step, effort })}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ))}
      {agentOpen ? (
        <div className="dim">
          고르지 않은 값은 [에이전트]의 기본을 따릅니다. 단계의 엔진이 기본 엔진과 다르면 그 엔진의
          기본 모델·추론 수준을 씁니다.
        </div>
      ) : null}
    </div>
  )
}

// ---------- 앱 설정 (D70, D527) ----------

/** 구역 맨 위의 안내. 걸러 볼 때(찾기, 바꾼 설정만)는 보이지 않는다. 단계별 진행은 묶음과 표 위의 안내다 */
function SectionIntro({ section }: { section: SettingsSection }) {
  switch (section) {
    case 'agent':
      return (
        <div className="dim">
          새로 만드는 task부터 씁니다. 기존 task를 재개하면 원래 엔진·모델·추론 수준을 씁니다.
        </div>
      )
    case 'pr':
      return (
        <div className="dim">
          PR 대응의 자동 승인은 [단계별 진행]의 PR 대응 줄에서 고릅니다. Codex 대응 결과의 push와
          답글 게시는 사람이 승인한 뒤 실행합니다.
        </div>
      )
    case 'advanced':
      return <div className="dim">거의 바꿀 일이 없는 조정값입니다.</div>
    default:
      return null
  }
}

/** 구역 하나의 내용: 안내, 단계별 진행이면 묶음과 표, 그리고 하나짜리 칸들 */
function SectionBody({
  section,
  view,
  full,
  value,
  onChange,
}: {
  section: SettingsSection
  view: SectionView
  /** 걸러 보지 않고 구역을 통째로 본다 */
  full: boolean
  value: AppConfig
  onChange: (next: AppConfig) => void
}) {
  const codex =
    value.agent_engine === 'codex' ||
    Object.values(value.agent_steps).some((s) => s?.engine === 'codex')
  return (
    <>
      {full ? <SectionIntro section={section} /> : null}
      {full && section === 'steps' ? <PresetPicker value={value} onChange={onChange} /> : null}
      {section === 'steps' && (full || view.steps.length) ? (
        <div className="dim">
          {AGENT_APPROVAL_NOTICE} 자동 승인을 켠 단계는 조건을 만족하면 카운트다운 뒤 승인합니다.
          카운트다운 중에 끄면 멈춥니다. 질문 방식은 다음에 시작하는 task부터 씁니다.
        </div>
      ) : null}
      {section === 'agent' && codex ? <div className="notice">{AGENT_APPROVAL_NOTICE}</div> : null}
      {view.steps.length ? <StepTable rows={view.steps} value={value} onChange={onChange} /> : null}
      {view.entries.length ? (
        <div className="setting-rows">
          {view.entries.map((entry) => (
            <SettingRow
              key={entry.key}
              label={entry.label}
              help={entry.help}
              changed={scalarChanged(value, entry.key)}
              resetLabel="기본값으로"
              onReset={() => onChange(resetScalar(value, entry.key))}
            >
              <ScalarControl entry={entry} value={value} onChange={onChange} />
            </SettingRow>
          ))}
        </div>
      ) : null}
    </>
  )
}

/**
 * 앱 설정 (D70, D527). 바꾸면 [저장]으로 한 번에 쓰고 바로 적용한다. 질문 방식만 다음에 시작하는 task부터 쓴다 (D73).
 * 자동 승인은 턴이 끝날 때의 설정으로 판정하고, 카운트다운 중에 끄면 멈춘다. 카운트다운 초는 다음 카운트다운부터 쓴다 (D128)
 */
export function SettingsDialog({
  onClose,
  onCustomTypes,
}: {
  onClose: () => void
  /** 업무 유형 화면을 연다 (D459) */
  onCustomTypes?: () => void
}) {
  const config = useConfig()
  const [draft, setDraft] = useState<AppConfig | null>(null)
  const [section, setSection] = useState<SettingsSection>('general')
  const [query, setQuery] = useState('')
  const [changedOnly, setChangedOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const value = draft ?? config
  const filter = { query, changedOnly }
  const narrowed = filtering(filter)

  const save = async () => {
    if (!value) return
    setBusy(true)
    setError(null)
    const r = await call(() =>
      window.relay.updateConfig({
        agent_engine: value.agent_engine,
        agent_model: value.agent_model,
        agent_effort: value.agent_effort,
        // 상세 설정은 단계마다 덮어쓴다. 기본을 따르는 단계는 빈 객체로 지운다
        agent_steps: Object.fromEntries(
          AGENT_STEP_TITLES.map(([skill]) => [skill, value.agent_steps[skill] ?? {}]),
        ),
        session_limit: value.session_limit,
        auto_approve: value.auto_approve,
        auto_approve_countdown_sec: value.auto_approve_countdown_sec,
        question_mode: value.question_mode,
        format_error_bounce_max: value.format_error_bounce_max,
        handoff_body_warn_chars: value.handoff_body_warn_chars,
        intent_warn_chars: value.intent_warn_chars,
        pr_draft: value.pr_draft,
        side_notice: value.side_notice,
        pr_poll_interval_sec: value.pr_poll_interval_sec,
        respond_auto_start: value.respond_auto_start,
        respond_auto_round_max: value.respond_auto_round_max,
        code_review: value.code_review,
        reply_signature: value.reply_signature,
        knowledge_review_engine: value.knowledge_review_engine,
        knowledge_review_model: value.knowledge_review_model,
        theme: value.theme,
        session_dir: value.session_dir,
      }),
    )
    setBusy(false)
    if (r.ok) onClose()
    else setError(r.error)
  }

  const views = value ? sectionViews(value, filter) : null
  const counts = value ? changedCounts(value) : null
  const shown = views
    ? narrowed
      ? SETTINGS_SECTIONS.filter((s) => views[s].entries.length || views[s].steps.length)
      : [section]
    : []

  return (
    <Modal title="설정" onClose={onClose} className="settings">
      <div className="settings-top">
        <input
          type="search"
          aria-label="설정 찾기"
          placeholder="설정 찾기 (예: 자동 승인, 모델, 테마)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // 찾는 말이 있으면 Escape는 창을 닫지 않고 지운다
            if (e.key === 'Escape' && query) {
              e.preventDefault()
              setQuery('')
            }
          }}
        />
        <label className="toggle">
          <input
            type="checkbox"
            aria-label="바꾼 설정만 보기"
            checked={changedOnly}
            onChange={(e) => setChangedOnly(e.target.checked)}
          />
          바꾼 설정만 보기
        </label>
      </div>
      <div className="settings-body">
        <nav className="settings-nav" aria-label="설정 구역">
          {SETTINGS_SECTIONS.map((s) => (
            <button
              key={s}
              aria-label={SECTION_LABEL[s]}
              aria-current={!narrowed && s === section ? 'page' : undefined}
              onClick={() => {
                setSection(s)
                setQuery('')
                setChangedOnly(false)
              }}
            >
              <span>{SECTION_LABEL[s]}</span>
              {counts?.[s] ? (
                <span className="changed-count" title="기본값과 다른 설정 수">
                  {counts[s]}
                </span>
              ) : null}
            </button>
          ))}
          {onCustomTypes ? (
            <>
              <hr />
              <button onClick={onCustomTypes} title="커스텀 유형을 만들고 고칩니다">
                업무 유형…
              </button>
            </>
          ) : null}
        </nav>
        <div className="settings-pane">
          {!value || !views ? (
            <div className="dim">불러오는 중…</div>
          ) : (
            <>
              {shown.map((s) => (
                <section key={s} className="settings-section" aria-label={SECTION_LABEL[s]}>
                  <h3>{SECTION_LABEL[s]}</h3>
                  <SectionBody
                    section={s}
                    view={views[s]}
                    full={!narrowed}
                    value={value}
                    onChange={setDraft}
                  />
                </section>
              ))}
              {narrowed && shown.length === 0 ? (
                <div className="dim">
                  {query.trim() ? '맞는 설정이 없습니다.' : '기본값과 다른 설정이 없습니다.'}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="buttons">
        <button onClick={onClose}>취소</button>
        <button className="primary" disabled={busy || !value} onClick={() => void save()}>
          저장
        </button>
      </div>
    </Modal>
  )
}

// ---------- 이 Work만 다르게 (D72, D531) ----------

export type AutoOverrides = Partial<Record<AutoApproveNode, boolean>>
export type ModeOverrides = Partial<Record<QuestionSkill, QuestionMode>>

/** 켜기·끄기를 덮어쓰는 고르기의 값: 빈 값은 따름 */
const pickOf = (v: boolean | undefined) => (v === undefined ? '' : v ? 'on' : 'off')
const fromPick = (v: string) => (v ? v === 'on' : undefined)

/** 키 하나를 바꾸거나(값이 있으면) 지운다(없으면) */
function put<K extends string, V>(
  value: Partial<Record<K, V>>,
  key: K,
  next: V | undefined,
): Partial<Record<K, V>> {
  const rest = Object.fromEntries(Object.entries(value).filter(([k]) => k !== key)) as Partial<
    Record<K, V>
  >
  return next === undefined ? rest : { ...rest, [key]: next }
}

/** 커스텀 유형의 단계: 자동 승인 기본값은 유형 정의(type.json)의 것이다 (D457) */
interface CustomStep {
  id: string
  title: string
  autoApprove: boolean
}

/**
 * 이 Work의 단계별 진행 (D72, D256, D457): 앱 설정의 표와 같은 줄과 차례로, 고른 유형의 단계만 보인다. 고르지 않은 칸은 앱
 * 설정(커스텀 단계는 유형 정의)을 따르고, 고른 줄은 표시와 [앱 설정으로]가 붙는다
 */
export function WorkStepOverrides({
  config,
  type,
  auto,
  onAuto,
  modes,
  onModes,
  customSteps,
  customAuto,
  onCustomAuto,
}: {
  config: AppConfig | null
  type: WorkType | null
  auto: AutoOverrides
  onAuto: (v: AutoOverrides) => void
  modes: ModeOverrides
  onModes: (v: ModeOverrides) => void
  customSteps?: readonly CustomStep[]
  customAuto: Record<string, boolean>
  onCustomAuto: (v: Record<string, boolean>) => void
}) {
  const rows: { group: SettingGroup; node: ReactNode }[] = [
    ...workStepRows(type).map((row) => {
      const autoValue = row.auto ? auto[row.auto] : undefined
      const modeValue = row.question ? modes[row.question] : undefined
      const changed = autoValue !== undefined || modeValue !== undefined
      return {
        group: row.group,
        node: (
          <div key={row.skill} className={changed ? 'step-row changed' : 'step-row'}>
            <span className="setting-name">
              <span className="setting-label">{row.title}</span>
              {row.oldOnly ? <span className="dim"> 옛 Work만</span> : null}
              {changed ? (
                <button
                  className="link"
                  aria-label={`${row.title} 앱 설정으로`}
                  onClick={() => {
                    if (row.auto) onAuto(put(auto, row.auto, undefined))
                    if (row.question) onModes(put(modes, row.question, undefined))
                  }}
                >
                  앱 설정으로
                </button>
              ) : null}
            </span>
            <span>
              {row.auto ? (
                <select
                  aria-label={`${row.title} 자동 승인`}
                  value={pickOf(autoValue)}
                  onChange={(e) =>
                    onAuto(put(auto, row.auto as AutoApproveNode, fromPick(e.target.value)))
                  }
                >
                  <option value="">
                    앱 설정 따름{config ? ` (${onOff(config.auto_approve[row.auto])})` : ''}
                  </option>
                  <option value="on">켜기</option>
                  <option value="off">끄기</option>
                </select>
              ) : (
                <span className="dim">{row.autoNote}</span>
              )}
            </span>
            <span>
              {row.question ? (
                <select
                  aria-label={`${row.title} 질문 방식`}
                  value={modeValue ?? ''}
                  onChange={(e) =>
                    onModes(
                      put(
                        modes,
                        row.question as QuestionSkill,
                        (e.target.value || undefined) as QuestionMode | undefined,
                      ),
                    )
                  }
                >
                  <option value="">
                    앱 설정 따름
                    {config ? ` (${QUESTION_MODE_LABEL[config.question_mode[row.question]]})` : ''}
                  </option>
                  {MODES.map(([mode, label]) => (
                    <option key={mode} value={mode}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="dim">{row.questionNote}</span>
              )}
            </span>
          </div>
        ),
      }
    }),
    ...(customSteps ?? []).map((s) => {
      const v = customAuto[s.id]
      return {
        group: 'custom' as const,
        node: (
          <div key={`custom:${s.id}`} className={v !== undefined ? 'step-row changed' : 'step-row'}>
            <span className="setting-name">
              <span className="setting-label">{s.title}</span>
              {v !== undefined ? (
                <button
                  className="link"
                  aria-label={`${s.title} 유형 기본값으로`}
                  onClick={() =>
                    onCustomAuto(put(customAuto, s.id, undefined) as Record<string, boolean>)
                  }
                >
                  유형 기본값으로
                </button>
              ) : null}
            </span>
            <span>
              <select
                aria-label={`${s.title} 자동 승인`}
                value={pickOf(v)}
                onChange={(e) =>
                  onCustomAuto(
                    put(customAuto, s.id, fromPick(e.target.value)) as Record<string, boolean>,
                  )
                }
              >
                <option value="">유형 기본값 따름 ({onOff(s.autoApprove)})</option>
                <option value="on">켜기</option>
                <option value="off">끄기</option>
              </select>
            </span>
            <span className="dim">유형마다</span>
          </div>
        ),
      }
    }),
  ]
  return (
    <div className="step-table overrides">
      <div className="step-head">
        <span>단계</span>
        <span>자동 승인</span>
        <span>질문 방식</span>
      </div>
      {byGroup(rows).map(([group, list]) => (
        <div
          key={group}
          className="form-group"
          role="group"
          aria-label={group === 'custom' ? '커스텀 단계' : SETTING_GROUP_LABEL[group]}
        >
          <div className="form-group-title">
            {group === 'custom' ? '커스텀 단계' : SETTING_GROUP_LABEL[group]}
          </div>
          {list.map((r) => r.node)}
        </div>
      ))}
    </div>
  )
}

/** 켜기·끄기를 이 Work만 다르게 하는 줄: 앱 설정 따름, 켜기, 끄기 */
function OnOffOverride({
  label,
  help,
  app,
  value,
  onChange,
}: {
  label: string
  help: string
  app: boolean | null
  value: boolean | undefined
  onChange: (v: boolean | undefined) => void
}) {
  return (
    <SettingRow
      label={label}
      help={help}
      changed={value !== undefined}
      resetLabel="앱 설정으로"
      onReset={() => onChange(undefined)}
    >
      <select
        aria-label={label}
        value={pickOf(value)}
        onChange={(e) => onChange(fromPick(e.target.value))}
      >
        <option value="">앱 설정 따름{app === null ? '' : ` (${onOff(app)})`}</option>
        <option value="on">켜기</option>
        <option value="off">끄기</option>
      </select>
    </SettingRow>
  )
}

/** 이 Work의 독립 리뷰의 코드 리뷰 (D72, D497). 리뷰를 요청할 때의 값을 쓴다 */
export function CodeReviewOverride({
  config,
  value,
  onChange,
}: {
  config: AppConfig | null
  value: boolean | undefined
  onChange: (v: boolean | undefined) => void
}) {
  return (
    <OnOffOverride
      label="독립 리뷰의 코드 리뷰"
      help="Work 마무리에 따로 돌리는 코드 리뷰. 끄면 판정표만 확인합니다"
      app={config ? config.code_review : null}
      value={value}
      onChange={onChange}
    />
  )
}

/**
 * Work 설정 (D72): 이 Work의 단계별 진행(자동 승인, 질문 방식), 독립 리뷰, 대응 자동 시작. 차례는 앱 설정과 같다 (D531).
 * 자동 승인은 바로 적용하고(턴이 끝날 때의 설정으로 판정, 카운트다운 중에 끄면 멈춤, D128), 질문 방식은 다음에 시작하는
 * task부터 쓴다 (D73). 대응 자동 시작은 다음에 들어오는 새 항목부터 쓴다 (D210). PR 진행 중에도 연다 (D209)
 */
export function WorkSettingsDialog({ work, onClose }: { work: WorkView; onClose: () => void }) {
  const [modes, setModes] = useState<ModeOverrides>(work.settings.question_mode ?? {})
  const [auto, setAuto] = useState<AutoOverrides>(work.settings.auto_approve ?? {})
  const [customAuto, setCustomAuto] = useState<Record<string, boolean>>(
    work.settings.custom_auto_approve ?? {},
  )
  const [autoStart, setAutoStart] = useState<boolean | undefined>(work.settings.respond_auto_start)
  const [codeReview, setCodeReview] = useState<boolean | undefined>(work.settings.code_review)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const config = useConfig()
  // 보이지 않는 다른 유형의 단계 값은 남기지 않는다. 사람이 보거나 지울 수 없어서다 (D256, PR #23 리뷰)
  const shownAuto = only(auto, AUTO_APPROVE_TITLES, work.type)
  const shownModes = only(modes, SKILL_TITLES, work.type)
  const shownCustom = work.customType ? customAuto : {}
  const count =
    Object.keys(shownAuto).length +
    Object.keys(shownModes).length +
    Object.keys(shownCustom).length +
    (autoStart === undefined ? 0 : 1) +
    (codeReview === undefined ? 0 : 1)

  const save = async () => {
    setBusy(true)
    const r = await call(() =>
      window.relay.updateWorkSettings(work.key, {
        auto_approve: shownAuto,
        ...(work.customType ? { custom_auto_approve: customAuto } : {}),
        question_mode: shownModes,
        respond_auto_start: autoStart ?? null,
        code_review: codeReview ?? null,
      }),
    )
    setBusy(false)
    if (r.ok) onClose()
    else setError(r.error)
  }

  return (
    <Modal
      title={`Work 설정 · ${work.workId} (${work.customType?.name ?? WORK_TYPE_LABEL[work.type]})`}
      onClose={onClose}
    >
      <div className="dim">이 Work에만 쓰는 값입니다. 고르지 않은 칸은 앱 설정을 따릅니다.</div>
      {count ? (
        <div className="notice">
          이 Work만 다르게 한 설정 {count}개{' '}
          <button
            className="link"
            onClick={() => {
              setAuto({})
              setModes({})
              setCustomAuto({})
              setAutoStart(undefined)
              setCodeReview(undefined)
            }}
          >
            모두 앱 설정으로
          </button>
        </div>
      ) : null}
      <h3>단계별 진행</h3>
      <div className="dim">
        {AGENT_APPROVAL_NOTICE} 자동 승인은 바로 적용합니다. 턴이 끝날 때의 설정으로 판정하고,
        카운트다운 중에 끄면 멈춥니다. 질문 방식은 다음에 시작하는 task부터 씁니다. Work의 마지막
        단계(Work 완료 화면)는 늘 수동입니다.
      </div>
      <WorkStepOverrides
        config={config}
        type={work.type}
        auto={auto}
        onAuto={setAuto}
        modes={modes}
        onModes={setModes}
        customSteps={work.customType?.steps}
        customAuto={customAuto}
        onCustomAuto={setCustomAuto}
      />
      <div className="setting-rows">
        <CodeReviewOverride config={config} value={codeReview} onChange={setCodeReview} />
      </div>
      <h3>PR</h3>
      <div className="setting-rows">
        <OnOffOverride
          label="대응 자동 시작"
          help="켜도 이미 받은 항목으로는 시작하지 않고, 다음에 새 항목이 들어오면 함께 시작합니다"
          app={config ? config.respond_auto_start : null}
          value={autoStart}
          onChange={setAutoStart}
        />
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="buttons">
        <button onClick={onClose}>취소</button>
        <button className="primary" disabled={busy} onClick={() => void save()}>
          저장
        </button>
      </div>
    </Modal>
  )
}
