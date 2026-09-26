// 대화상자: 프로젝트 등록(시나리오 0), 새 Work(시나리오 1), 설정 화면(D70), Work 설정(D72),
// 확인 창([오류 무시하고 승인] 4.1, [Work 포기] 3.3).
import { useEffect, useState, type ReactNode } from 'react'
import {
  QUESTION_MODE_LABEL,
  SKILL_TITLES,
  type AppConfig,
  type QuestionMode,
  type SkillName,
} from '../../shared/config'
import type { ProjectInspection, ProjectView, WorkView } from '../../shared/views'
import { call } from './commands'

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

/** 프로젝트 등록: 폴더를 고르면 점검 표를 보이고, 기본 브랜치를 고쳐 등록한다 (시나리오 0, D67) */
export function ProjectDialog({ onClose }: { onClose: () => void }) {
  const [inspection, setInspection] = useState<ProjectInspection | null>(null)
  const [branch, setBranch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async () => {
    const dir = await window.relay.pickFolder()
    if (!dir) return
    setBusy(true)
    setError(null)
    try {
      const i = await window.relay.inspectProject(dir)
      setInspection(i)
      setBranch(i.defaultBranch ?? '')
    } finally {
      setBusy(false)
    }
  }

  const register = async () => {
    if (!inspection) return
    setBusy(true)
    const r = await call(() => window.relay.registerProject(inspection.path, branch))
    setBusy(false)
    if (r.ok) onClose()
    else setError(r.error)
  }

  return (
    <Modal title="프로젝트 추가" onClose={onClose}>
      <div className="row">
        <button onClick={() => void pick()} disabled={busy}>
          레포 폴더 고르기
        </button>
        {busy ? <span className="dim">점검하는 중…</span> : null}
      </div>
      {inspection ? (
        <>
          <div className="dim path">{inspection.path}</div>
          <table className="checks">
            <tbody>
              {inspection.checks.map((c) => (
                <tr key={c.id} className={c.ok ? 'ok' : c.blocking ? 'block' : 'warn'}>
                  <td className="mark">{c.ok ? '✓' : c.blocking ? '✕' : '!'}</td>
                  <td>{c.label}</td>
                  <td className="detail">{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <label className="field">
            기본 브랜치
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              aria-label="기본 브랜치"
            />
          </label>
        </>
      ) : null}
      {error ? <div className="error">{error}</div> : null}
      <div className="buttons">
        <button onClick={onClose}>취소</button>
        <button
          className="primary"
          disabled={busy || !inspection?.canRegister || !branch.trim()}
          onClick={() => void register()}
        >
          등록
        </button>
      </div>
    </Modal>
  )
}

/** 새 Work: 요청, 기준 브랜치, 기준 위치 (시나리오 1) */
export function NewWorkDialog({
  project,
  onClose,
  onCreated,
}: {
  project: ProjectView
  onClose: () => void
  onCreated: (workKey: string) => void
}) {
  const [request, setRequest] = useState('')
  const [branches, setBranches] = useState<string[]>([project.defaultBranch])
  const [branch, setBranch] = useState(project.defaultBranch)
  const [location, setLocation] = useState<'local' | 'remote'>('local')
  const [modes, setModes] = useState<Overrides>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const config = useConfig()

  useEffect(() => {
    void window.relay.branches(project.id).then((list) => {
      if (list.length) setBranches(list)
    })
  }, [project.id])

  const start = async () => {
    setBusy(true)
    setError(null)
    const r = await call(() =>
      window.relay.createWork(project.id, {
        request,
        baseBranch: branch,
        baseLocation: location,
        ...(Object.keys(modes).length ? { settings: { question_mode: modes } } : {}),
      }),
    )
    setBusy(false)
    if (r.ok) onCreated(r.workKey)
    else setError(r.error)
  }

  return (
    <Modal title={`새 Work · ${project.name}`} onClose={onClose}>
      <label className="field">
        요청
        <textarea
          aria-label="요청"
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          rows={10}
          placeholder="버그 설명, 로그, 이슈 내용을 붙여 넣으세요"
        />
      </label>
      <div className="row">
        <label className="field">
          기준 브랜치
          <select
            aria-label="기준 브랜치"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="field">
          <legend>기준 위치</legend>
          <label>
            <input
              type="radio"
              checked={location === 'local'}
              onChange={() => setLocation('local')}
            />
            로컬
          </label>
          <label
            title={project.origin ? 'git fetch 뒤 origin/<브랜치>에서 분기' : 'origin 원격이 없음'}
          >
            <input
              type="radio"
              disabled={!project.origin}
              checked={location === 'remote'}
              onChange={() => setLocation('remote')}
            />
            원격
          </label>
        </fieldset>
      </div>
      <details>
        <summary>이 Work의 질문 방식</summary>
        <QuestionModes config={config} value={modes} onChange={setModes} />
      </details>
      {error ? <div className="error">{error}</div> : null}
      <div className="buttons">
        <button onClick={onClose}>취소</button>
        <button className="primary" disabled={busy || !request.trim()} onClick={() => void start()}>
          {busy ? '만드는 중…' : '시작'}
        </button>
      </div>
    </Modal>
  )
}

// ---------- 질문 방식 (5.6.1, D26, D72) ----------

type Overrides = Partial<Record<SkillName, QuestionMode>>

/** 앱 설정. 대화상자를 열 때 읽는다 */
function useConfig(): AppConfig | null {
  const [config, setConfig] = useState<AppConfig | null>(null)
  useEffect(() => {
    void window.relay.config().then(setConfig)
  }, [])
  return config
}

const MODES = Object.entries(QUESTION_MODE_LABEL) as [QuestionMode, string][]

/** Work별 질문 방식 (D72). 고르지 않은 스킬은 앱 설정을 따른다 */
function QuestionModes({
  config,
  value,
  onChange,
}: {
  config: AppConfig | null
  value: Overrides
  onChange: (v: Overrides) => void
}) {
  const set = (skill: SkillName, mode: string) => {
    const rest = Object.fromEntries(Object.entries(value).filter(([k]) => k !== skill))
    onChange(mode ? { ...rest, [skill]: mode as QuestionMode } : rest)
  }
  return (
    <div className="form-grid">
      {SKILL_TITLES.map(([skill, title]) => (
        <label key={skill} className="form-row">
          <span>
            {title} <span className="dim">({skill})</span>
          </span>
          <select
            aria-label={`${title} 질문 방식`}
            value={value[skill] ?? ''}
            onChange={(e) => set(skill, e.target.value)}
          >
            <option value="">
              앱 설정 따름{config ? ` (${QUESTION_MODE_LABEL[config.question_mode[skill]]})` : ''}
            </option>
            {MODES.map(([mode, label]) => (
              <option key={mode} value={mode}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  )
}

/** Work 설정 (D72): 이 Work의 질문 방식. 다음에 시작하는 task부터 쓴다 (D73) */
export function WorkSettingsDialog({ work, onClose }: { work: WorkView; onClose: () => void }) {
  const [modes, setModes] = useState<Overrides>(work.settings.question_mode ?? {})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const config = useConfig()

  const save = async () => {
    setBusy(true)
    const r = await call(() => window.relay.updateWorkSettings(work.key, { question_mode: modes }))
    setBusy(false)
    if (r.ok) onClose()
    else setError(r.error)
  }

  return (
    <Modal title={`Work 설정 · ${work.workId}`} onClose={onClose}>
      <div className="dim">질문 방식은 다음에 시작하는 task부터 씁니다.</div>
      <QuestionModes config={config} value={modes} onChange={setModes} />
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

// ---------- 설정 화면 (D70) ----------

type NumberKey =
  'session_limit' | 'format_error_bounce_max' | 'handoff_body_warn_chars' | 'intent_warn_chars'

const NUMBERS: [NumberKey, string, string][] = [
  ['session_limit', '세션 상한', '살아 있는 세션의 합계. 넘으면 대기열에서 기다린다 (D18)'],
  ['format_error_bounce_max', '형식 오류 되돌림 횟수', 'Stop 훅으로 되돌리는 연속 횟수 (D21)'],
  ['handoff_body_warn_chars', 'handoff 본문 분량 경고 기준', '글자 수. 넘으면 경고만 한다'],
  ['intent_warn_chars', 'intent 분량 경고 기준', '글자 수. 넘으면 경고만 한다'],
]

/**
 * 앱 설정 (D70). 바꾸면 바로 적용하고, 질문 방식만 다음에 시작하는 task부터 쓴다 (D73).
 * 자동 승인과 카운트다운은 자동 승인을 넣는 M7에서 연다.
 */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const config = useConfig()
  const [draft, setDraft] = useState<AppConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const value = draft ?? config

  const save = async () => {
    if (!value) return
    setBusy(true)
    setError(null)
    const r = await call(() =>
      window.relay.updateConfig({
        session_limit: value.session_limit,
        question_mode: value.question_mode,
        format_error_bounce_max: value.format_error_bounce_max,
        handoff_body_warn_chars: value.handoff_body_warn_chars,
        intent_warn_chars: value.intent_warn_chars,
        pr_draft: value.pr_draft,
      }),
    )
    setBusy(false)
    if (r.ok) onClose()
    else setError(r.error)
  }

  return (
    <Modal title="설정" onClose={onClose}>
      {value ? (
        <>
          <div className="dim">
            바꾸면 바로 적용합니다. 질문 방식은 다음에 시작하는 task부터 씁니다.
          </div>
          <div className="form-grid">
            {NUMBERS.map(([key, label, hint]) => (
              <label key={key} className="form-row" title={hint}>
                <span>{label}</span>
                <input
                  type="number"
                  aria-label={label}
                  value={value[key]}
                  onChange={(e) => setDraft({ ...value, [key]: Number(e.target.value) })}
                />
              </label>
            ))}
            <label className="form-row" title="PR 생성은 M5에서 넣는다">
              <span>draft PR로 만들기</span>
              <input
                type="checkbox"
                aria-label="draft PR로 만들기"
                checked={value.pr_draft}
                onChange={(e) => setDraft({ ...value, pr_draft: e.target.checked })}
              />
            </label>
          </div>
          <h3>질문 방식</h3>
          <div className="form-grid">
            {SKILL_TITLES.map(([skill, title]) => (
              <label key={skill} className="form-row">
                <span>
                  {title} <span className="dim">({skill})</span>
                </span>
                <select
                  aria-label={`${title} 질문 방식`}
                  value={value.question_mode[skill]}
                  onChange={(e) =>
                    setDraft({
                      ...value,
                      question_mode: {
                        ...value.question_mode,
                        [skill]: e.target.value as QuestionMode,
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
              </label>
            ))}
          </div>
          <div className="dim">자동 승인과 카운트다운은 M7에서 설정합니다.</div>
        </>
      ) : (
        <div className="dim">불러오는 중…</div>
      )}
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

/** 확인 창 */
export function ConfirmDialog({
  title,
  children,
  confirm,
  onConfirm,
  onClose,
}: {
  title: string
  children: ReactNode
  confirm: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal title={title} onClose={onClose}>
      {children}
      <div className="buttons">
        <button onClick={onClose}>취소</button>
        <button className="danger" onClick={onConfirm}>
          {confirm}
        </button>
      </div>
    </Modal>
  )
}
