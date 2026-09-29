// 대화상자: 프로젝트 등록(시나리오 0), 프로젝트 설정(D185), 새 Work(시나리오 1), 설정 화면(D70),
// Work 설정(D72: 자동 승인, 질문 방식, 대응 자동 시작. PR 진행 중에도 연다, D209), 단계 선택(6.2, D82), 커밋 안 된 변경의 선택지(7-5), Work 정리(시나리오 8, D178),
// 확인 창([오류 무시하고 승인] 4.1, [Work 포기] 3.3, [머지 없이 끝내기] D179).
import { useEffect, useState, type ReactNode } from 'react'
import {
  AUTO_APPROVE_TITLES,
  QUESTION_MODE_LABEL,
  SKILL_TITLES,
  type AppConfig,
  type AutoApproveNode,
  type QuestionMode,
  type SkillName,
  type WorkSettings,
} from '../../shared/config'
import type { NodeName } from '../../shared/contracts'
import type { MergeMethod } from '../../shared/work'
import type {
  CleanPreview,
  ProjectInspection,
  ProjectView,
  StepPreview,
  StepPreviewResult,
  WorkView,
} from '../../shared/views'
import { call } from './commands'

export function Modal({
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

const METHOD_LABEL: Readonly<Record<MergeMethod, string>> = {
  merge: '머지 커밋 (merge)',
  squash: '하나로 합침 (squash)',
  rebase: '다시 쌓음 (rebase)',
}

/**
 * 프로젝트 설정 (5.1.2, D185): 받을 봇(D161, 이름 모양은 D197)과 머지 창의 기본 방식(D177). 사이드바의 프로젝트
 * 이름으로 연다. 받을 봇을 바꾸면 PR 진행인 Work의 항목에 바로 다시 적용한다
 */
export function ProjectSettingsDialog({
  project,
  onClose,
}: {
  project: ProjectView
  onClose: () => void
}) {
  const [bots, setBots] = useState(project.allowedBots.join('\n'))
  const [method, setMethod] = useState<MergeMethod | null>(project.mergeMethod)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setError(null)
    const r = await call(() =>
      window.relay.updateProjectSettings(project.id, {
        allowed_bots: bots
          .split(/[\n,]/)
          .map((b) => b.trim())
          .filter(Boolean),
        merge_method: method,
      }),
    )
    setBusy(false)
    if (r.ok) onClose()
    else setError(r.error)
  }

  return (
    <Modal title={`프로젝트 설정 · ${project.name}`} onClose={onClose}>
      <div className="dim">{project.repoPath}</div>
      <label className="form-col">
        <span>받을 봇</span>
        <textarea
          aria-label="받을 봇"
          rows={4}
          value={bots}
          placeholder="github-actions"
          onChange={(e) => setBots(e.target.value)}
        />
        <span className="dim">
          코멘트를 대응할 거리로 받을 봇의 이름. 한 줄에 하나씩, GitHub 웹 화면에 보이는 이름으로
          적습니다. [bot]을 붙여 적어도 됩니다 (D161, D197). 적지 않은 봇의 코멘트는 받지 않음으로
          보이고 [받기]로 넣을 수 있습니다.
        </span>
      </label>
      <label className="form-row">
        <span>기본 머지 방식</span>
        <select
          aria-label="기본 머지 방식"
          value={method ?? ''}
          onChange={(e) => setMethod((e.target.value || null) as MergeMethod | null)}
        >
          <option value="">레포가 허용하는 첫 방식</option>
          {(Object.keys(METHOD_LABEL) as MergeMethod[]).map((m) => (
            <option key={m} value={m}>
              {METHOD_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      <div className="dim">
        머지 창의 기본 선택입니다. 레포가 허용하지 않는 방식이면 허용하는 첫 방식을 고릅니다 (D177).
      </div>
      <div className="dim">
        gh {project.ghVersion ?? '버전 모름'} · origin {project.origin ? '있음' : '없음'} · gh
        로그인 {project.gh ? '됨' : '안 됨'}
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
  const [auto, setAuto] = useState<AutoOverrides>({})
  const [autoStart, setAutoStart] = useState<boolean | undefined>(undefined)
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
    const settings: WorkSettings = {
      ...(Object.keys(auto).length ? { auto_approve: auto } : {}),
      ...(Object.keys(modes).length ? { question_mode: modes } : {}),
      ...(autoStart === undefined ? {} : { respond_auto_start: autoStart }),
    }
    const r = await call(() =>
      window.relay.createWork(project.id, {
        request,
        baseBranch: branch,
        baseLocation: location,
        ...(Object.keys(settings).length ? { settings } : {}),
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
        <summary>이 Work의 자동 승인</summary>
        <AutoApproveOverrides config={config} value={auto} onChange={setAuto} />
      </details>
      <details>
        <summary>이 Work의 자동 대응 (PR 진행)</summary>
        <AutoStartOverride config={config} value={autoStart} onChange={setAutoStart} />
      </details>
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

// ---------- 자동 승인 (4.2, D72) ----------

type AutoOverrides = Partial<Record<AutoApproveNode, boolean>>

const onOff = (on: boolean) => (on ? '켜짐' : '꺼짐')

/** Work별 자동 승인 (D72). 고르지 않은 단계는 앱 설정을 따른다. 의도 정리, 리뷰, 최종 검증은 늘 수동이다 (4.2, D167) */
function AutoApproveOverrides({
  config,
  value,
  onChange,
}: {
  config: AppConfig | null
  value: AutoOverrides
  onChange: (v: AutoOverrides) => void
}) {
  const set = (node: AutoApproveNode, v: string) => {
    const rest = Object.fromEntries(Object.entries(value).filter(([k]) => k !== node))
    onChange(v ? { ...rest, [node]: v === 'on' } : rest)
  }
  const pick = (node: AutoApproveNode) => {
    const v = value[node]
    return v === undefined ? '' : v ? 'on' : 'off'
  }
  return (
    <div className="form-grid">
      {AUTO_APPROVE_TITLES.map(([node, title]) => (
        <label key={node} className="form-row">
          <span>
            {title} <span className="dim">({node})</span>
          </span>
          <select
            aria-label={`${title} 자동 승인`}
            value={pick(node)}
            onChange={(e) => set(node, e.target.value)}
          >
            <option value="">
              앱 설정 따름{config ? ` (${onOff(config.auto_approve[node])})` : ''}
            </option>
            <option value="on">켜기</option>
            <option value="off">끄기</option>
          </select>
        </label>
      ))}
    </div>
  )
}

/**
 * Work별 대응 자동 시작 (D72, D154): 앱 설정 따름, 켜기, 끄기. 켜도 이미 받은 새 항목으로는 시작하지 않고, 다음에 PR을 읽어
 * 새 항목이 들어오면 쌓인 것과 함께 시작한다 (D210)
 */
function AutoStartOverride({
  config,
  value,
  onChange,
}: {
  config: AppConfig | null
  value: boolean | undefined
  onChange: (v: boolean | undefined) => void
}) {
  return (
    <div className="form-grid">
      <label
        className="form-row"
        title="받은 새 항목이 들어오면 PR 대응 task를 자동으로 시작한다 (D154, D210)"
      >
        <span>대응 자동 시작</span>
        <select
          aria-label="대응 자동 시작"
          value={value === undefined ? '' : value ? 'on' : 'off'}
          onChange={(e) => onChange(e.target.value ? e.target.value === 'on' : undefined)}
        >
          <option value="">
            앱 설정 따름{config ? ` (${onOff(config.respond_auto_start)})` : ''}
          </option>
          <option value="on">켜기</option>
          <option value="off">끄기</option>
        </select>
      </label>
    </div>
  )
}

/**
 * Work 설정 (D72): 이 Work의 자동 승인, 질문 방식, 대응 자동 시작. 자동 승인은 바로 적용하고(턴이 끝날 때의 설정으로 판정,
 * 카운트다운 중에 끄면 멈춤, D128), 질문 방식은 다음에 시작하는 task부터 쓴다 (D73). 대응 자동 시작은 다음에 들어오는 새
 * 항목부터 쓴다 (D210). PR 진행 중에도 연다 (D209)
 */
export function WorkSettingsDialog({ work, onClose }: { work: WorkView; onClose: () => void }) {
  const [modes, setModes] = useState<Overrides>(work.settings.question_mode ?? {})
  const [auto, setAuto] = useState<AutoOverrides>(work.settings.auto_approve ?? {})
  const [autoStart, setAutoStart] = useState<boolean | undefined>(work.settings.respond_auto_start)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const config = useConfig()

  const save = async () => {
    setBusy(true)
    const r = await call(() =>
      window.relay.updateWorkSettings(work.key, {
        auto_approve: auto,
        question_mode: modes,
        respond_auto_start: autoStart ?? null,
      }),
    )
    setBusy(false)
    if (r.ok) onClose()
    else setError(r.error)
  }

  return (
    <Modal title={`Work 설정 · ${work.workId}`} onClose={onClose}>
      <h3>자동 승인</h3>
      <div className="dim">
        바로 적용합니다. 턴이 끝날 때의 설정으로 판정하고, 카운트다운 중에 끄면 멈춥니다.
      </div>
      <AutoApproveOverrides config={config} value={auto} onChange={setAuto} />
      <h3>자동 대응 (PR 진행)</h3>
      <div className="dim">
        켜도 이미 받은 새 항목으로는 시작하지 않고, 다음에 새 항목이 들어오면 함께 시작합니다.
      </div>
      <AutoStartOverride config={config} value={autoStart} onChange={setAutoStart} />
      <h3>질문 방식</h3>
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
  | 'session_limit'
  | 'format_error_bounce_max'
  | 'handoff_body_warn_chars'
  | 'intent_warn_chars'
  | 'pr_poll_interval_sec'

const NUMBERS: [NumberKey, string, string][] = [
  ['session_limit', '세션 상한', '살아 있는 세션의 합계. 넘으면 대기열에서 기다린다 (D18)'],
  ['format_error_bounce_max', '형식 오류 되돌림 횟수', 'Stop 훅으로 되돌리는 연속 횟수 (D21)'],
  ['handoff_body_warn_chars', 'handoff 본문 분량 경고 기준', '글자 수. 넘으면 경고만 한다'],
  ['intent_warn_chars', 'intent 분량 경고 기준', '글자 수. 넘으면 경고만 한다'],
  [
    'pr_poll_interval_sec',
    'PR 읽기 주기(초)',
    'PR 진행인 Work의 PR을 읽는 주기. 다음 읽기부터 쓴다 (D158)',
  ],
]

/**
 * 앱 설정 (D70). 바꾸면 바로 적용하고, 질문 방식만 다음에 시작하는 task부터 쓴다 (D73).
 * 자동 승인은 턴이 끝날 때의 설정으로 판정하고, 카운트다운 중에 끄면 멈춘다. 카운트다운 초는 다음 카운트다운부터 쓴다 (D128)
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
        auto_approve: value.auto_approve,
        auto_approve_countdown_sec: value.auto_approve_countdown_sec,
        question_mode: value.question_mode,
        format_error_bounce_max: value.format_error_bounce_max,
        handoff_body_warn_chars: value.handoff_body_warn_chars,
        intent_warn_chars: value.intent_warn_chars,
        pr_draft: value.pr_draft,
        pr_poll_interval_sec: value.pr_poll_interval_sec,
        respond_auto_start: value.respond_auto_start,
        respond_auto_round_max: value.respond_auto_round_max,
        reply_signature: value.reply_signature,
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
            <label
              className="form-row"
              title="Work 완료 화면의 [PR 생성]이 draft PR을 만든다 (D71)"
            >
              <span>draft PR로 만들기</span>
              <input
                type="checkbox"
                aria-label="draft PR로 만들기"
                checked={value.pr_draft}
                onChange={(e) => setDraft({ ...value, pr_draft: e.target.checked })}
              />
            </label>
            <label
              className="form-row"
              title="앱이 게시하는 PR 답글 끝에 붙이는 표시. 답글이 내 계정으로 올라가므로 AI가 썼다고 알린다 (D173)"
            >
              <span>답글 표시 문구</span>
              <input
                type="text"
                aria-label="답글 표시 문구"
                value={value.reply_signature}
                onChange={(e) => setDraft({ ...value, reply_signature: e.target.value })}
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
          <h3>자동 승인</h3>
          <div className="dim">
            켠 단계는 조건(4.3)을 만족하면 카운트다운 뒤 승인합니다. 턴이 끝날 때의 설정으로
            판정하고, 카운트다운 중에 끄면 멈춥니다. 의도 정리, 리뷰, 최종 검증은 늘 수동입니다.
          </div>
          <div className="form-grid">
            {AUTO_APPROVE_TITLES.map(([node, title]) => (
              <label key={node} className="form-row">
                <span>
                  {title} <span className="dim">({node})</span>
                </span>
                <input
                  type="checkbox"
                  aria-label={`${title} 자동 승인`}
                  checked={value.auto_approve[node]}
                  onChange={(e) =>
                    setDraft({
                      ...value,
                      auto_approve: { ...value.auto_approve, [node]: e.target.checked },
                    })
                  }
                />
              </label>
            ))}
            <label
              className="form-row"
              title="자동 승인 전에 기다리는 초. [취소]로 멈춘다. 다음 카운트다운부터 쓴다 (4.3)"
            >
              <span>자동 승인 카운트다운(초)</span>
              <input
                type="number"
                aria-label="자동 승인 카운트다운(초)"
                value={value.auto_approve_countdown_sec}
                onChange={(e) =>
                  setDraft({ ...value, auto_approve_countdown_sec: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <h3>자동 대응 (PR 진행)</h3>
          <div className="dim">
            켜면 PR을 읽어 받은 새 항목으로 PR 대응 task를 자동으로 시작합니다. 켜도 이미 받은
            항목과 앱을 켤 때 읽은 항목만으로는 시작하지 않습니다. 사람이 [대응 시작]이나 승인을
            누르지 않고 이어진 라운드가 상한에 닿으면 멈추고 알립니다. PR 대응의 자동 승인은 위의
            목록에서 켭니다.
          </div>
          <div className="form-grid">
            <label
              className="form-row"
              title="받은 새 항목이 들어오면 PR 대응 task를 자동으로 시작한다 (D154, D210)"
            >
              <span>대응 자동 시작</span>
              <input
                type="checkbox"
                aria-label="대응 자동 시작"
                checked={value.respond_auto_start}
                onChange={(e) => setDraft({ ...value, respond_auto_start: e.target.checked })}
              />
            </label>
            <label
              className="form-row"
              title="사람이 [대응 시작]이나 승인을 누르지 않고 이어지는 대응 라운드의 상한 (D171)"
            >
              <span>자동 대응 라운드 상한</span>
              <input
                type="number"
                aria-label="자동 대응 라운드 상한"
                value={value.respond_auto_round_max}
                onChange={(e) =>
                  setDraft({ ...value, respond_auto_round_max: Number(e.target.value) })
                }
              />
            </label>
          </div>
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

// ---------- 단계 선택 (6.2, 6.3, D82) ----------

const short = (commit: string | null) => (commit ? commit.slice(0, 8) : '')

/** 미리 보기의 코드 줄 (D116, D117) */
function codeLines(code: StepPreview['code']): string[] {
  const n = code.uncommitted.length
  if (code.kind === 'reset') {
    const where = `고른 단계를 시작할 때의 커밋(${short(code.to)})`
    return [
      code.commits > 0 || n > 0
        ? `되돌릴 커밋 ${code.commits}개: ${where}으로 되돌립니다`
        : `되돌릴 커밋 0개: 코드가 이미 ${where}에 있습니다`,
      ...(n ? [`커밋 안 된 변경 ${n}개는 백업 브랜치에 커밋으로 넣고 지웁니다`] : []),
      code.backupBranch
        ? `백업 브랜치: ${code.backupBranch}`
        : '백업할 것이 없어 백업 브랜치를 만들지 않습니다',
    ]
  }
  return [
    code.kind === 'keep'
      ? '[현재 코드 위에서 이어서]: 커밋을 되돌리지 않고 그 위에서 이어서 고칩니다'
      : '코드를 되돌리지 않습니다',
    ...(n ? [`커밋 안 된 변경 ${n}개는 그대로 둡니다`] : []),
  ]
}

/** 고른 단계의 결과 (D82): 중단할 task, 폐기될 산출물, 코드, 건너뛸 단계, intent */
function PreviewView({ p }: { p: StepPreview }) {
  return (
    <div className="step-preview" aria-label="미리 보기">
      <div>
        <strong>{p.title}</strong> · {p.kind === 'rewind' ? '되감기' : '건너뛰기'} · 새 task의 이유:{' '}
        {p.reason}
      </div>
      {p.interrupt ? <div className="notice">{p.interrupt}</div> : null}
      <section>
        <h3>폐기될 산출물</h3>
        {p.discard.length ? (
          <ul>
            {p.discard.map((d) => (
              <li key={d.taskId}>
                {d.label}: {d.artifacts.length ? d.artifacts.join(', ') : '산출물 없음'}
              </li>
            ))}
          </ul>
        ) : (
          <div className="dim">없음</div>
        )}
      </section>
      <section>
        <h3>코드</h3>
        <ul>
          {codeLines(p.code).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {p.code.uncommitted.length ? (
          <ul className="files">
            {p.code.uncommitted.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : null}
      </section>
      <section>
        <h3>건너뛸 단계</h3>
        {p.skipped.length ? p.skipped.join(', ') : <span className="dim">없음</span>}
      </section>
      {p.intent ? <div className="notice">{p.intent}</div> : null}
    </div>
  )
}

/**
 * 단계 선택 대화상자 (D82): 파이프라인 단계를 차례로 보이고(6.3의 제약을 따른다), 고른 단계의 결과를
 * 미리 보인다. 추가 지시는 선택이고, fix로 되감으면 [현재 코드 위에서 이어서]를 고를 수 있다.
 * [확인]을 눌러야 실행한다. 미리 본 뒤 Work가 바뀌었으면 main이 받지 않는다.
 */
export function StepDialog({
  work,
  initial,
  onClose,
  onDone,
}: {
  work: WorkView
  /** 처음 고른 단계. 이전 단계 추천으로 멈췄으면 추천한 단계다 (D23) */
  initial?: NodeName
  onClose: () => void
  onDone: () => void
}) {
  const recommended = work.steps.find((c) => c.recommended && c.allowed)?.node
  const [node, setNode] = useState<NodeName | null>(initial ?? recommended ?? null)
  const [keepCode, setKeepCode] = useState(false)
  const [instruction, setInstruction] = useState('')
  // 미리 본 단계와 선택지. 고른 것과 다르면 보이지 않고 [확인]할 수 없다
  const [preview, setPreview] = useState<{
    node: NodeName
    keepCode: boolean
    result: StepPreviewResult
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 고른 단계의 결과를 미리 본다. Work가 바뀌면 다시 본다
  useEffect(() => {
    if (!node) return
    let stale = false
    void call(() => window.relay.stepPreview(work.key, node, keepCode)).then((result) => {
      if (!stale) setPreview({ node, keepCode, result })
    })
    return () => {
      stale = true
    }
  }, [work.key, work.revision, node, keepCode])

  const current = preview && preview.node === node && preview.keepCode === keepCode ? preview : null
  const shown = current?.result.ok ? current.result.preview : null
  const failed = current && !current.result.ok ? current.result.error : null
  // [현재 코드 위에서 이어서]는 fix로 되감을 때만 있다 (6.2)
  const keepOffered = node === 'fix' && work.steps.find((c) => c.node === node)?.kind === 'rewind'

  const pick = (next: NodeName) => {
    setNode(next)
    setKeepCode(false)
  }

  const confirm = async () => {
    if (!shown) return
    setBusy(true)
    setError(null)
    const r = await call(() =>
      window.relay.selectStep(work.key, {
        node: shown.node,
        keepCode,
        instruction,
        expect: shown.expect,
      }),
    )
    setBusy(false)
    if (r.ok) onDone()
    else setError(r.error)
  }

  return (
    <Modal title={`단계 선택 · ${work.workId}`} onClose={onClose}>
      <fieldset className="steps">
        <legend>단계</legend>
        {work.steps.map((c) => (
          <label key={c.node} className={c.allowed ? 'step' : 'step disabled'} title={c.why ?? ''}>
            <input
              type="radio"
              name="step"
              aria-label={c.title}
              disabled={!c.allowed}
              checked={node === c.node}
              onChange={() => pick(c.node)}
            />
            <span>{c.title}</span>
            <span className="dim">
              {c.kind === 'rewind' ? '되감기' : '건너뛰기'}
              {c.current ? ' · 지금 단계' : ''}
            </span>
            {c.recommended ? <span className="badge hot">추천</span> : null}
          </label>
        ))}
      </fieldset>
      {keepOffered ? (
        <label
          className="toggle"
          title="verify가 작은 문제를 찾았을 때 수정을 처음부터 다시 하지 않는다"
        >
          <input
            type="checkbox"
            checked={keepCode}
            onChange={(e) => setKeepCode(e.target.checked)}
          />
          현재 코드 위에서 이어서
        </label>
      ) : null}
      {node === null ? (
        <div className="dim">단계를 고르면 결과를 미리 보입니다.</div>
      ) : failed ? (
        <div className="error">{failed}</div>
      ) : shown ? (
        <PreviewView p={shown} />
      ) : (
        <div className="dim">미리 보는 중…</div>
      )}
      <label className="field">
        추가 지시 (선택)
        <textarea
          aria-label="추가 지시"
          rows={4}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="새 task의 context.md 맨 위에 넣습니다"
        />
      </label>
      {error ? <div className="error">{error}</div> : null}
      <div className="buttons">
        <button onClick={onClose}>취소</button>
        <button className="primary" disabled={busy || !shown} onClick={() => void confirm()}>
          {busy ? '실행하는 중…' : '확인'}
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

// ---------- 전달 (시나리오 7-5) ----------

/**
 * 커밋 안 된 변경이 있을 때의 세 선택지 (7-5). push와 PR은 이 변경을 둔 채 할 수 없다.
 * 보인 목록이 [변경 버리고 진행]이 stash할 것이고 [커밋하고 진행]이 커밋할 것이다. 그 사이 바뀌면 main이
 * 받지 않고 새 목록을 돌려준다.
 */
export function UncommittedDialog({
  workId,
  label,
  files,
  busy,
  onDiscard,
  onCommit,
  onSession,
  onClose,
}: {
  workId: string
  /** 원래 고른 전달: "push", "PR 생성" */
  label: string
  files: string[]
  busy: boolean
  onDiscard: () => void
  onCommit: () => void
  onSession: () => void
  onClose: () => void
}) {
  return (
    <Modal title="커밋 안 된 변경" onClose={onClose}>
      <p>커밋 안 된 변경이 있어 [{label}]을(를) 할 수 없습니다. 어떻게 할지 고르세요.</p>
      <ul className="files" aria-label="커밋 안 된 변경">
        {files.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <div className="choices">
        <button disabled={busy} onClick={onDiscard}>
          변경 버리고 진행
        </button>
        <span className="dim">
          git stash -u로 백업하고 지운 뒤 진행합니다. 백업은 메인 체크아웃의 git stash list에
          남습니다.
        </span>
        <button disabled={busy} onClick={onCommit}>
          커밋하고 진행
        </button>
        <span className="dim">
          위 파일을 &quot;relay({workId}): 완료 전 남은 변경&quot;으로 커밋한 뒤 진행합니다.
        </span>
        <button disabled={busy} onClick={onSession}>
          AI 세션 열기
        </button>
        <span className="dim">
          기록하지 않는 Claude Code 세션을 열어 정리합니다. push와 PR은 계속 막혀 있습니다.
        </span>
      </div>
      <div className="buttons">
        <button onClick={onClose}>취소</button>
      </div>
    </Modal>
  )
}

// ---------- 정리 (시나리오 8) ----------

/**
 * [Work 정리] (시나리오 8). 먼저 확인할 것을 요약해 보인다: 커밋 안 된 변경(백업 없이 지움), 작업 브랜치가
 * 원격이나 기준 브랜치에 있는지, 살아 있는 세션(강제 종료), git 잠금 파일. 확인할 것이 있으면 명시적으로
 * 확인해야 [정리]를 누를 수 있다. 작업 브랜치는 기본으로 두고 push됐거나 머지됐을 때만 삭제를 제안한다.
 * PR을 머지해 완료한 Work는 작업 브랜치 삭제가 기본으로 체크되고, origin의 작업 브랜치 삭제도 고를 수 있다
 * (D178, 기본은 끔). 되감기 백업 브랜치의 "함께 삭제"는 기본으로 체크한다. 산출물은 지우지 않는다.
 */
export function CleanDialog({ work, onClose }: { work: WorkView; onClose: () => void }) {
  const [preview, setPreview] = useState<CleanPreview | null>(null)
  const [deleteBranch, setDeleteBranch] = useState(false)
  const [deleteRemote, setDeleteRemote] = useState(false)
  const [deleteBackups, setDeleteBackups] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stale = false
    void call(() => window.relay.cleanPreview(work.key)).then((r) => {
      if (stale) return
      if (r.ok) {
        setPreview(r.preview)
        setDeleteBranch(r.preview.merged)
      } else setError(r.error)
    })
    return () => {
      stale = true
    }
  }, [work.key])

  const clean = async () => {
    if (!preview) return
    setBusy(true)
    setError(null)
    const r = await call(() =>
      window.relay.clean(work.key, {
        deleteBranch: deleteBranch && preview.branch.deletable,
        deleteRemote: deleteRemote && preview.remote?.exists === true,
        deleteBackups,
        confirmed,
        expect: preview.expect,
      }),
    )
    setBusy(false)
    if (r.ok) onClose()
    else setError(r.error)
  }

  const b = preview?.branch
  return (
    <Modal title={`Work 정리 · ${work.workId}`} onClose={onClose}>
      {!preview ? (
        <div className="dim">{error ? null : '확인하는 중…'}</div>
      ) : (
        <div className="clean-summary" aria-label="정리 요약">
          <div>
            worktree를 지웁니다{preview.worktree ? '' : ' (이미 없음)'}. 산출물과 기록(works/
            {work.workId}/)은 남습니다.
          </div>
          <section>
            <h3>커밋 안 된 변경</h3>
            {preview.uncommitted.length ? (
              <>
                <div className="error">백업 없이 지워집니다.</div>
                <ul className="files">
                  {preview.uncommitted.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </>
            ) : (
              <span className="dim">없음</span>
            )}
          </section>
          {b ? (
            <section>
              <h3>작업 브랜치 {b.name}</h3>
              <div>
                {!b.exists
                  ? '브랜치가 없습니다'
                  : b.pushed && b.merged
                    ? 'origin에 push됐고 기준 브랜치에 머지됐습니다'
                    : b.pushed
                      ? 'origin에 push됐습니다'
                      : b.merged
                        ? '기준 브랜치에 머지됐습니다'
                        : '원격에도 기준 브랜치에도 없습니다. 이 브랜치에만 있는 커밋이 있습니다'}
              </div>
              <label className="toggle" title="push됐거나 머지됐을 때만 삭제를 제안합니다">
                <input
                  type="checkbox"
                  aria-label="작업 브랜치 삭제"
                  disabled={!b.deletable}
                  checked={deleteBranch && b.deletable}
                  onChange={(e) => setDeleteBranch(e.target.checked)}
                />
                작업 브랜치 삭제 {b.deletable ? '' : '(push됐거나 머지됐을 때만)'}
              </label>
              {preview.remote ? (
                <label className="toggle" title="PR을 머지한 Work만 고를 수 있습니다 (D178)">
                  <input
                    type="checkbox"
                    aria-label="원격 브랜치 삭제"
                    disabled={!preview.remote.exists}
                    checked={deleteRemote && preview.remote.exists}
                    onChange={(e) => setDeleteRemote(e.target.checked)}
                  />
                  origin의 {preview.remote.name}도 삭제{' '}
                  {preview.remote.exists ? '' : '(origin에 없음)'}
                </label>
              ) : null}
            </section>
          ) : null}
          {preview.backups.length ? (
            <section>
              <h3>되감기 백업 브랜치</h3>
              <ul className="files">
                {preview.backups.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <label className="toggle">
                <input
                  type="checkbox"
                  aria-label="백업 브랜치 함께 삭제"
                  checked={deleteBackups}
                  onChange={(e) => setDeleteBackups(e.target.checked)}
                />
                함께 삭제
              </label>
              <div className="dim">
                지우면 폐기된 task의 [변경]이 가리키는 커밋을 나중에 git이 치울 수 있습니다.
              </div>
            </section>
          ) : null}
          {preview.live ? (
            <div className="notice">살아 있는 세션 {preview.live}개를 강제 종료합니다.</div>
          ) : null}
          {preview.locks.length ? (
            <section>
              <h3>git 잠금 파일</h3>
              <ul className="files">
                {preview.locks.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {preview.confirm.length ? (
            <label className="toggle confirm">
              <input
                type="checkbox"
                aria-label="확인"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              확인했습니다: {preview.confirm.join(', ')}
            </label>
          ) : null}
        </div>
      )}
      {error ? <div className="error">{error}</div> : null}
      <div className="buttons">
        <button onClick={onClose}>취소</button>
        <button
          className="danger"
          disabled={busy || !preview || (preview.confirm.length > 0 && !confirmed)}
          onClick={() => void clean()}
        >
          {busy ? '정리하는 중…' : '정리'}
        </button>
      </div>
    </Modal>
  )
}
