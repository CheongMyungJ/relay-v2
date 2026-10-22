// 대화상자: 프로젝트 등록(시나리오 0), 프로젝트 설정(D185), 새 Work(시나리오 1, 유형 고르기 D236), 설정 화면(D70),
// Work 설정(D72: 자동 승인, 질문 방식, 대응 자동 시작. PR 진행 중에도 연다, D209),
// 커밋 안 된 변경의 선택지(7-5), Work 정리(시나리오 8, D178),
// 확인 창([오류 무시하고 승인] 4.1, [Work 포기] 3.3, [머지 없이 끝내기] D179).
import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  type SettingGroup,
  type QuestionSkill,
  type ThemeChoice,
  type WorkSettings,
} from '../../shared/config'
import { DEFAULT_BRANCH_RULE } from '../../shared/project'
import { WORK_TYPES, WORK_TYPE_LABEL, type MergeMethod, type WorkType } from '../../shared/work'
import type {
  CleanPreview,
  DraftView,
  ProjectInspection,
  ProjectRemovePreview,
  ProjectView,
  SubmoduleView,
  TidyCandidateView,
  TidyView,
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
  // top layer에 띄운다(showModal): 패널의 버튼 줄이나 터미널 레이어에 가려지지 않고, 뒤는 눌리지 않으며,
  // 포커스가 창 안으로 오고 Escape로 닫힌다. 닫힘은 브라우저의 close 하나로 받는다
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal-dialog"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        // 창 밖(::backdrop)을 누르면 닫는다
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal">
        <h2>{title}</h2>
        {children}
      </div>
    </dialog>
  )
}

/** 프로젝트 등록: 폴더를 고르면 점검 표를 보이고, 기본 브랜치를 고쳐 등록한다 (시나리오 0, D67) */
export function ProjectDialog({ onClose }: { onClose: () => void }) {
  const [inspection, setInspection] = useState<ProjectInspection | null>(null)
  const [branch, setBranch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async () => {
    const dir = await window.relay.pickFolder('등록할 레포 폴더')
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
 * 프로젝트 설정 (5.1.2, D185): 받을 봇(D161, 이름 모양은 D197)과 머지 창의 기본 방식(D177), 이슈 기록(D337), 작업 브랜치
 * 규칙(D426). 사이드바의
 * 프로젝트 이름으로 연다. 받을 봇을 바꾸면 PR 진행인 Work의 항목에 바로 다시 적용한다
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
  const [issueLog, setIssueLog] = useState(project.issueLog)
  const [branchRule, setBranchRule] = useState(project.branchRule)
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
        issue_log: issueLog,
        branch_rule: branchRule,
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
      <label className="form-row">
        <span>이슈 기록</span>
        <input
          type="checkbox"
          aria-label="이슈 기록"
          checked={issueLog}
          onChange={(e) => setIssueLog(e.target.checked)}
        />
      </label>
      <div className="dim">
        의도를 승인하면 GitHub 이슈를 만들고 승인된 단계마다 코멘트를 덧붙입니다. 팀원이 PR을 리뷰할
        때 맥락을 봅니다. 공개 레포에서는 산출물이 그대로 공개됩니다. 바꾸면 다음에 만드는 Work부터
        따릅니다 (D336, D337).
      </div>
      <label className="form-row">
        <span>작업 브랜치 규칙</span>
        <input
          aria-label="작업 브랜치 규칙"
          value={branchRule}
          placeholder={DEFAULT_BRANCH_RULE}
          onChange={(e) => setBranchRule(e.target.value)}
        />
      </label>
      <div className="dim">
        새 Work의 작업 브랜치 이름입니다. 자리: {'{work-id}'}(w-20261021-001), {'{date}'}(20261021),
        {' {seq}'}(001), {'{type}'}(fix, feat, refactor, spec, chore), {'{slug}'}(새 Work에서 적는
        짧은 이름, 비우면 앞 구분자와 함께 빠짐). 예: {'{type}/{date}-{seq}-{slug}'}. 끝에는 앱이
        임의의 영문·숫자 4자를 붙입니다. 비우면 relay/{'{work-id}'}입니다. 바꾸면 다음에 만드는
        Work부터 따릅니다 (D426, D427).
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

/** 이슈 번호 칸 (D338): 비었으면 null(새 이슈), 앞의 #은 뗀다. 1 이상의 정수가 아니면 undefined */
function issueNumberInput(text: string): number | null | undefined {
  const t = text.trim().replace(/^#/, '')
  if (!t) return null
  const n = Number(t)
  return /^\d+$/.test(t) && Number.isInteger(n) && n > 0 ? n : undefined
}

/**
 * 유형 버튼의 설명. 기능 추가·변경은 동작을 바꾸거나 없애는 일도 맡고(D429), 설계는 구현 전에 설계만 정하는 큰 일(D353),
 * 일반은 다른 유형에 맞지 않는 일에 쓴다 (D303, I88)
 */
const WORK_TYPE_HINT: Readonly<Partial<Record<WorkType, string>>> = {
  feature: '새 동작을 더하거나 지금 동작을 바꾸거나 없애는 일',
  spec: '구현 전에 설계만 정하는 큰 일',
  general: '다른 유형에 맞지 않는 일',
}

/**
 * 업무 유형 고르기 (D236, D237, D261, D303, D353, D429): 버그 수정 / 기능 추가·변경 / 리팩터링 / 설계 / 일반 버튼. 새 Work에는 기본 선택이
 * 없다(value가 null). 설명이 있는 유형은 버튼의 title로 두고, 그 유형을 골랐을 때 버튼 줄 아래에 보인다 (I88)
 */
function WorkTypePicker({
  value,
  onChange,
}: {
  value: WorkType | null
  onChange: (type: WorkType) => void
}) {
  const hint = value ? WORK_TYPE_HINT[value] : undefined
  return (
    <>
      <div className="work-type" role="radiogroup" aria-label="업무 유형">
        {WORK_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={value === type}
            className={value === type ? 'primary' : ''}
            title={WORK_TYPE_HINT[type]}
            onClick={() => onChange(type)}
          >
            {WORK_TYPE_LABEL[type]}
          </button>
        ))}
      </div>
      {hint && <div className="work-type-hint">{hint}</div>}
    </>
  )
}

const TIDY_KIND_LABEL: Readonly<Record<TidyCandidateView['kind'], string>> = {
  same_anchor: '같은 anchor',
  stale_anchor: '코드에 없는 anchor',
  missing_path: '없는 경로',
  format: '형식 문제',
}

/**
 * 지식 정리 후보 (D393). 누르면 후보로 채운 일반 Work의 요청을 넣는다. 사람이 쓴 요청이 있으면(overwrites) 바꾸기 전에
 * 한 번 묻는다. basis는 후보를 찾은 기준(원격이면 마지막으로 fetch한 것)이다
 */
function TidyNotice({
  view,
  basis,
  overwrites,
  onUse,
}: {
  view: TidyView
  basis: string
  overwrites: boolean
  onUse: (view: TidyView) => void
}) {
  const [confirm, setConfirm] = useState(false)
  return (
    // 처음부터 펼쳐 둔다: 접힌 목록 안의 버튼은 지나치기 쉽다(대규모 기능 실험 시범)
    <details className="field tidy-notice" open>
      <summary>지식 정리 후보 {view.candidates.length}건</summary>
      <div className="dim">{basis} 기준</div>
      <ul>
        {view.candidates.map((c, i) => (
          <li key={i}>
            {TIDY_KIND_LABEL[c.kind]} {c.detail}: {c.paths.join(', ')}
          </li>
        ))}
      </ul>
      {confirm && overwrites ? (
        <div className="row">
          <span>쓴 요청이 후보 목록으로 바뀝니다.</span>
          <button
            type="button"
            onClick={() => {
              setConfirm(false)
              onUse(view)
            }}
          >
            요청 바꾸기
          </button>
          <button type="button" onClick={() => setConfirm(false)}>
            그대로 두기
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => (overwrites ? setConfirm(true) : onUse(view))}>
          지식 정리 Work로 채우기
        </button>
      )}
    </details>
  )
}

/** 요청 입력의 예시 문구. 유형을 고르기 전에는 버그 수정의 것이다 (D261, I88) */
const REQUEST_PLACEHOLDER: Readonly<Record<WorkType, string>> = {
  bugfix: '버그 설명, 로그, 이슈 내용을 붙여 넣으세요',
  feature: '만들 기능이나 바꾸거나 없앨 동작, 쓰는 흐름, 참고할 이슈 내용을 붙여 넣으세요',
  refactor: '바꿀 구조(예: 어느 계산을 한 모듈로 모을지), 바꿀 곳, 지켜야 할 동작을 적어 주세요',
  spec: '무엇을 설계할지, 정해야 할 것, 설계 문서를 둘 곳이나 고칠 문서를 적어 주세요',
  general: '할 일과 끝났다고 볼 조건을 적어 주세요(무엇을 바꾸고 어떻게 확인할지)',
}

/** 짧은 이름을 치다 멈춘 뒤 브랜치 이름을 묻기까지 기다리는 시간 */
const BRANCH_NAME_DELAY_MS = 250

/** Work에서 쓴 초안(D421)으로 열 때의 원래 Work: 비운 칸을 채우고, 포기할지 고르게 한다 */
export interface DraftOrigin {
  /** 사이드바의 Work 제목 */
  title: string
  /** 원래 Work의 기준 브랜치. 다른 프로젝트의 초안이면 null이다 */
  baseBranch: string | null
  /** 원래 Work의 이슈 번호. 없거나 다른 프로젝트의 초안이면 null이다 */
  issueNumber: number | null
  /** 진행 중이거나 멈춘 Work라 포기할 수 있다 */
  abandonable: boolean
}

/**
 * 새 Work: 대상, 유형, 요청, 기준 브랜치, 기준 위치 (시나리오 1). 유형을 고르기 전에는 [시작]이 꺼져 있다 (D236).
 * 서브모듈이 있는 레포는 대상으로 서브모듈 하나를 고를 수 있고, 그러면 메인 통합 검증 worktree를 고른다 (D413, D414)
 */
export function NewWorkDialog({
  project,
  projects,
  draft,
  origin,
  onClose,
  onCreated,
}: {
  /** 연 프로젝트. 서브모듈 프로젝트면 그 서브모듈이 대상으로 골라져 있다 */
  project: ProjectView
  /** 등록된 프로젝트. 대상의 메인 프로젝트와 서브모듈 프로젝트를 찾는다 */
  projects: readonly ProjectView[]
  /**
   * 채울 Work 초안 (D404). 지식 정리 후보처럼 칸을 채우고(D393), 맞는 칸만 채운다. 만들면 main이 그 초안을 지운다
   */
  draft?: DraftView
  /** 초안이 Work에서 나왔으면 그 Work (D421) */
  origin?: DraftOrigin
  onClose: () => void
  onCreated: (workKey: string) => void
}) {
  const mainId = project.parent?.id ?? project.id
  const main = projects.find((p) => p.id === mainId) ?? project
  const [targetId, setTargetId] = useState(project.id)
  // 고를 때 만든 서브모듈 프로젝트. 스냅샷의 프로젝트 목록보다 먼저 올 수 있다
  const [prepared, setPrepared] = useState<ProjectView | null>(null)
  const target =
    projects.find((p) => p.id === targetId) ?? (prepared?.id === targetId ? prepared : project)
  const [submodules, setSubmodules] = useState<SubmoduleView[]>([])
  // 고른 서브모듈을 준비하는 중(받기, 서브모듈 프로젝트 만들기)이면 그 경로 (D413)
  const [preparing, setPreparing] = useState<string | null>(null)
  const [integrate, setIntegrate] = useState(true)
  const [mainBranches, setMainBranches] = useState<string[]>([main.defaultBranch])
  const [mainBranch, setMainBranch] = useState(main.defaultBranch)
  // 메인 레포의 기준 위치. 메인 레포에 origin이 없을 수 있어 Work의 기준 위치와 따로 고른다 (D414)
  const [mainLocation, setMainLocation] = useState<'local' | 'remote'>('local')
  const [type, setType] = useState<WorkType | null>(draft?.type ?? null)
  const [request, setRequest] = useState(draft?.request ?? '')
  const [branches, setBranches] = useState<string[]>([project.defaultBranch])
  const [branch, setBranch] = useState(draft?.base ?? origin?.baseBranch ?? project.defaultBranch)
  const [location, setLocation] = useState<'local' | 'remote'>('local')
  // 머지 대상 (D428). null이면 기준 브랜치를 따른다
  const [mergeTarget, setMergeTarget] = useState<string | null>(null)
  // 작업 브랜치 (D425, D426): 규칙으로 채운 이름. 사람이 고치면 edited에 두고 규칙으로 다시 채우지 않는다
  const [slug, setSlug] = useState('')
  const [ruleName, setRuleName] = useState('')
  const [edited, setEdited] = useState<string | null>(null)
  // 다시 하기는 원래 Work를 포기하며 그 이슈를 이어 쓴다 (D421, I153). 포기하지 않으면 두 Work가 한 이슈를 쓰게 되어 채우지
  // 않는다. 번호를 바꾸면 그 이슈에 쓴다
  const originIssue =
    origin?.abandonable && origin.issueNumber !== null ? String(origin.issueNumber) : ''
  const [issue, setIssue] = useState(originIssue)
  const [abandon, setAbandon] = useState(origin?.abandonable === true)
  const toggleAbandon = (on: boolean) => {
    setAbandon(on)
    if (!originIssue) return
    if (on && !issue.trim()) setIssue(originIssue)
    if (!on && issue.trim() === originIssue) setIssue('')
  }
  const [modes, setModes] = useState<Overrides>({})
  const [auto, setAuto] = useState<AutoOverrides>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 지식 정리 후보와 그것을 찾은 기준("<브랜치>|<위치>"). 늦게 온 앞 기준의 결과는 보이지 않는다 (D393)
  const [tidy, setTidy] = useState<{ basis: string; view: TidyView } | null>(null)
  // 후보로 채운 요청. 사람이 고치지 않은 채 기준이 바뀌면 새 기준의 후보로 다시 채운다
  const filled = useRef<string | null>(null)
  const [filledText, setFilledText] = useState<string | null>(null)
  const requestNow = useRef(request)
  useEffect(() => {
    requestNow.current = request
  }, [request])
  const config = useConfig()

  useEffect(() => {
    let current = true
    void window.relay.branches(target.id).then((list) => {
      if (current && list.length) setBranches(list)
    })
    return () => {
      current = false
    }
  }, [target.id])

  useEffect(() => {
    void window.relay.submodules(mainId).then(setSubmodules)
    void window.relay.branches(mainId).then((list) => {
      if (list.length) setMainBranches(list)
    })
  }, [mainId])

  // 규칙으로 채운 작업 브랜치 이름 (D426). 유형을 고르기 전에는 {type}을 모르므로 채우지 않는다. main이 git과 Work
  // 폴더를 읽으므로 짧은 이름을 치는 동안은 기다렸다가 한 번 묻는다
  useEffect(() => {
    if (!type) return
    let current = true
    const timer = setTimeout(() => {
      void window.relay
        .branchName(target.id, type, slug)
        .then((name) => {
          if (current) setRuleName(name)
        })
        .catch(() => {
          if (current) setRuleName('')
        })
    }, BRANCH_NAME_DELAY_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [target.id, type, slug])

  // 대상을 바꾸면 기준 브랜치를 그 레포의 기본 브랜치로 되돌린다 (D413)
  const pickTarget = (next: ProjectView) => {
    if (next.id === target.id) return
    setTargetId(next.id)
    setBranches([next.defaultBranch])
    setBranch(next.defaultBranch)
    setMergeTarget(null)
    // 브랜치 이름과 짧은 이름은 그 레포의 규칙과 work-id로 다시 채운다
    setEdited(null)
    setSlug('')
    if (!next.origin) setLocation('local')
    // 이슈 번호는 그 레포의 이슈다. 다른 레포로 옮기지 않는다
    setIssue('')
  }
  const chooseTarget = async (value: string) => {
    setError(null)
    if (value === main.id) return pickTarget(main)
    const sub = submodules.find((m) => m.path === value)
    if (!sub) return
    const known = sub.projectId ? projects.find((p) => p.id === sub.projectId) : undefined
    if (known) return pickTarget(known)
    setPreparing(sub.path)
    const r = await call(() => window.relay.prepareSubmodule(mainId, sub.path))
    setPreparing(null)
    if (!r.ok) {
      setError(r.error)
      return
    }
    if (!r.project) return
    const made = r.project
    setSubmodules((list) =>
      list.map((m) => (m.path === sub.path ? { ...m, initialized: true, projectId: made.id } : m)),
    )
    setPrepared(made)
    pickTarget(made)
  }

  // 기준이 바뀌면 그 기준의 지식 정리 후보를 다시 찾는다 (D393). 후보로 채운 요청을 고치지 않았으면 새 기준의 후보로
  // 바꾼다(앞 기준의 후보로 다른 브랜치에서 시작하지 않게)
  useEffect(() => {
    let current = true
    void window.relay.knowledgeTidy(target.id, branch, location).then((view) => {
      if (!current) return
      setTidy({ basis: `${branch}|${location}`, view })
      if (filled.current !== null && requestNow.current === filled.current) {
        filled.current = view.request || null
        setFilledText(filled.current)
        setRequest(view.request)
      }
    })
    return () => {
      current = false
    }
  }, [target.id, branch, location])

  const applyTidy = (view: TidyView) => {
    filled.current = view.request
    setFilledText(view.request)
    setType('general')
    setRequest(view.request)
  }
  const shownTidy = tidy?.basis === `${branch}|${location}` ? tidy.view : null

  const start = async () => {
    if (!type) return
    setBusy(true)
    setError(null)
    // 고른 유형에 없는 단계의 설정은 보내지 않는다 (D256)
    const auto_approve = only(auto, AUTO_APPROVE_TITLES, type)
    const question_mode = only(modes, SKILL_TITLES, type)
    const settings: WorkSettings = {
      ...(Object.keys(auto_approve).length ? { auto_approve } : {}),
      ...(Object.keys(question_mode).length ? { question_mode } : {}),
    }
    const issueNumber = issueNumberInput(issue)
    if (issueNumber === undefined) {
      setBusy(false)
      setError('이슈 번호는 1 이상의 정수로 적으세요')
      return
    }
    const r = await call(() =>
      window.relay.createWork(target.id, {
        request,
        type,
        baseBranch: branch,
        baseLocation: location,
        ...(edited !== null ? { branchName: edited } : {}),
        ...(hasSlug && slug.trim() ? { slug } : {}),
        ...(mergeTarget !== null ? { targetBranch: mergeTarget } : {}),
        ...(target.parent && integrate
          ? { integration: { baseBranch: mainBranch, baseLocation: mainLocation } }
          : {}),
        ...(Object.keys(settings).length ? { settings } : {}),
        ...(issueNumber !== null ? { issueNumber } : {}),
        ...(draft ? { draft: draft.ref } : {}),
        ...(origin?.abandonable && abandon ? { abandonOriginal: true } : {}),
      }),
    )
    setBusy(false)
    if (r.ok) onCreated(r.workKey)
    else setError(r.error)
  }
  // 초안의 기준 브랜치가 목록에 없어도(지운 브랜치, 원격에만 있음) 고른 채로 보이고, 없으면 만들기가 알린다
  const branchList = branches.includes(branch) ? branches : [...branches, branch]
  const sub = target.parent ? target : null
  const hasSlug = target.branchSlug
  const shownTarget = mergeTarget ?? branch

  return (
    <Modal title={`새 Work · ${sub ? `${main.name}/${sub.name}` : main.name}`} onClose={onClose}>
      {draft ? (
        <div className="notice">
          Work 초안 <code>{draft.ref.name}</code>으로 채웠습니다. 고친 뒤 [시작]을 누르면 Work를
          만들고 초안을 지웁니다.
          {draft.errors.length ? (
            <div className="error">초안의 형식 오류: {draft.errors.join(' · ')}</div>
          ) : null}
        </div>
      ) : null}
      {shownTidy?.candidates.length ? (
        <TidyNotice
          view={shownTidy}
          basis={location === 'remote' ? `마지막으로 받은(fetch) origin/${branch}` : branch}
          overwrites={request.trim() !== '' && request !== filledText}
          onUse={applyTidy}
        />
      ) : null}
      {submodules.length > 0 || sub ? (
        <label className="field">
          대상
          <select
            aria-label="대상"
            value={preparing ?? sub?.parent?.path ?? main.id}
            disabled={preparing !== null || busy}
            onChange={(e) => void chooseTarget(e.target.value)}
          >
            <option value={main.id}>{main.name} (메인 레포)</option>
            {submodules.map((m) => (
              <option key={m.path} value={m.path}>
                {m.path} (서브모듈{m.initialized ? '' : ', 고르면 메인 체크아웃에 받습니다'})
              </option>
            ))}
          </select>
          {preparing ? <span className="dim">서브모듈 {preparing} 준비 중…</span> : null}
          {sub ? (
            <span className="dim">
              이 Work는 서브모듈 레포만 고치고 전달합니다(push, PR). 메인 레포는 고치지 않습니다.
            </span>
          ) : null}
        </label>
      ) : null}
      {sub ? (
        <div className="row">
          <label className="toggle">
            <input
              type="checkbox"
              aria-label="메인 레포에서 통합 검증"
              checked={integrate}
              onChange={(e) => setIntegrate(e.target.checked)}
            />
            메인 레포에서 통합 검증
          </label>
          {integrate ? (
            <label className="field">
              메인 기준 브랜치
              <select
                aria-label="메인 기준 브랜치"
                value={mainBranch}
                onChange={(e) => setMainBranch(e.target.value)}
              >
                {mainBranches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {integrate ? (
            <fieldset className="field">
              <legend>메인 기준 위치</legend>
              <label>
                <input
                  type="radio"
                  checked={mainLocation === 'local'}
                  onChange={() => setMainLocation('local')}
                />
                로컬
              </label>
              <label
                title={
                  main.origin ? 'git fetch 뒤 origin/<브랜치>' : '메인 레포에 origin 원격이 없음'
                }
              >
                <input
                  type="radio"
                  disabled={!main.origin}
                  checked={mainLocation === 'remote'}
                  onChange={() => setMainLocation('remote')}
                />
                원격
              </label>
            </fieldset>
          ) : null}
          <span className="dim">
            {integrate
              ? '메인 레포의 worktree를 함께 만들고 그 안의 서브모듈 자리에서 일합니다. 메인 쪽 변경은 전달하지 않습니다.'
              : '서브모듈 레포만으로 빌드하고 테스트합니다.'}
          </span>
        </div>
      ) : null}
      <div className="field">
        유형
        <WorkTypePicker value={type} onChange={setType} />
      </div>
      <label className="field">
        요청
        <textarea
          aria-label="요청"
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          rows={10}
          placeholder={REQUEST_PLACEHOLDER[type ?? 'bugfix']}
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
            {branchList.map((b) => (
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
            title={target.origin ? 'git fetch 뒤 origin/<브랜치>에서 분기' : 'origin 원격이 없음'}
          >
            <input
              type="radio"
              disabled={!target.origin}
              checked={location === 'remote'}
              onChange={() => setLocation('remote')}
            />
            원격
          </label>
        </fieldset>
      </div>
      <div className="row branch-row">
        <label
          className="field grow"
          title="프로젝트 설정의 브랜치 규칙으로 채웁니다. 고칠 수 있고, 끝에는 앱이 임의의 4자를 붙입니다 (D425~D427)"
        >
          작업 브랜치
          <span className="branch-name">
            <input
              aria-label="작업 브랜치"
              value={edited ?? ruleName}
              placeholder={type ? target.branchRule : '유형을 고르면 규칙으로 채웁니다'}
              onChange={(e) => setEdited(e.target.value.trim() ? e.target.value : null)}
            />
            <code className="dim">-xxxx</code>
          </span>
          <span className="dim">
            끝의 -xxxx는 만들 때 붙이는 임의의 영문·숫자 4자입니다(다른 사람과 이름이 겹치지 않게).
            {edited !== null ? (
              <>
                {' '}
                <button className="link" onClick={() => setEdited(null)}>
                  규칙으로 되돌리기
                </button>
              </>
            ) : null}
          </span>
        </label>
        {hasSlug ? (
          <label className="field">
            짧은 이름 (선택)
            <input
              aria-label="짧은 이름"
              value={slug}
              placeholder="login-timeout"
              onChange={(e) => setSlug(e.target.value)}
            />
            <span className="dim">
              브랜치 규칙의 {'{slug}'} 자리. 영문 소문자, 숫자, -만 씁니다
            </span>
          </label>
        ) : null}
        <label
          className="field"
          title="[PR 생성]이 PR을 보낼 브랜치입니다. 앞 Work의 작업 브랜치 위에 쌓을 때 고릅니다 (D428)"
        >
          머지 대상
          <select
            aria-label="머지 대상"
            value={shownTarget}
            onChange={(e) => setMergeTarget(e.target.value === branch ? null : e.target.value)}
          >
            {(branchList.includes(shownTarget) ? branchList : [...branchList, shownTarget]).map(
              (b) => (
                <option key={b} value={b}>
                  {b === branch ? `${b} (기준 브랜치)` : b}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      {target.issueLog ? (
        <label className="field">
          이슈 번호 (선택)
          <input
            aria-label="이슈 번호"
            inputMode="numeric"
            value={issue}
            placeholder="요청이 온 이슈의 번호. 비우면 의도를 승인할 때 새 이슈를 만듭니다"
            onChange={(e) => setIssue(e.target.value)}
          />
        </label>
      ) : null}
      {origin?.abandonable ? (
        <label
          className="toggle"
          title="다시 하기: 새 Work를 만든 뒤 원래 Work를 포기합니다 (D421)"
        >
          <input
            type="checkbox"
            aria-label="원래 Work 포기"
            checked={abandon}
            onChange={(e) => toggleAbandon(e.target.checked)}
          />
          원래 Work 포기: {origin.title}
        </label>
      ) : null}
      {/* 처음 쓰는 사람을 헷갈리게 하지 않게 하나로 접는다. PR 자동 대응은 PR 진행이 된 뒤 [Work 설정]에서 고른다 (D226) */}
      <details>
        <summary>고급 설정 (나중에 [Work 설정]에서도 바꿀 수 있음)</summary>
        <h3>이 Work의 자동 승인 (Claude Code)</h3>
        <div className="dim">{AGENT_APPROVAL_NOTICE}</div>
        <AutoApproveOverrides config={config} type={type} value={auto} onChange={setAuto} />
        <h3>이 Work의 질문 방식</h3>
        <QuestionModes config={config} type={type} value={modes} onChange={setModes} />
      </details>
      {error ? <div className="error">{error}</div> : null}
      <div className="buttons">
        <button onClick={onClose}>취소</button>
        <button
          className="primary"
          disabled={busy || preparing !== null || !type || !request.trim()}
          title={type ? '' : '유형을 고르세요'}
          onClick={() => void start()}
        >
          {busy ? '만드는 중…' : '시작'}
        </button>
      </div>
    </Modal>
  )
}

// ---------- 설정 목록의 묶음 (D256) ----------

const GROUPS: readonly SettingGroup[] = [
  'common',
  'bugfix',
  'feature',
  'refactor',
  'spec',
  'general',
  'pr',
]

/**
 * 설정 목록을 묶음(공통 / 버그 수정 / 기능 추가·변경 / 리팩터링 / 설계 / 일반 / PR 대응)마다 모은다 (D256, D278, D318, D374). type을 주면 그 유형에서 보이는 묶음만
 * 둔다. Work 설정은 그 Work 유형의 단계만 보인다 (I57)
 */
function grouped<K extends string>(
  items: readonly (readonly [K, string, SettingGroup])[],
  type: WorkType | null,
): [SettingGroup, (readonly [K, string, SettingGroup])[]][] {
  return GROUPS.filter((g) => type === null || groupShown(g, type))
    .map((g): [SettingGroup, (readonly [K, string, SettingGroup])[]] => [
      g,
      items.filter(([, , group]) => group === g),
    ])
    .filter(([, list]) => list.length > 0)
}

/** 그 유형에서 보이는 단계의 값만 남긴다 */
function only<K extends string, V>(
  value: Partial<Record<K, V>>,
  items: readonly (readonly [K, string, SettingGroup])[],
  type: WorkType,
): Partial<Record<K, V>> {
  const shown = new Set(items.filter(([, , g]) => groupShown(g, type)).map(([k]) => k))
  return Object.fromEntries(Object.entries(value).filter(([k]) => shown.has(k as K))) as Partial<
    Record<K, V>
  >
}

/** 묶음의 제목과 그 아래 줄 */
function Groups<K extends string>({
  items,
  type,
  row,
}: {
  items: readonly (readonly [K, string, SettingGroup])[]
  type: WorkType | null
  row: (key: K, title: string) => ReactNode
}) {
  return (
    <div className="form-grid">
      {grouped(items, type).map(([group, list]) => (
        <div
          key={group}
          className="form-group"
          role="group"
          aria-label={SETTING_GROUP_LABEL[group]}
        >
          <div className="form-group-title">{SETTING_GROUP_LABEL[group]}</div>
          {list.map(([key, title]) => row(key, title))}
        </div>
      ))}
    </div>
  )
}

// ---------- 질문 방식 (5.6.1, D26, D72) ----------

type Overrides = Partial<Record<QuestionSkill, QuestionMode>>

/** 앱 설정. 대화상자를 열 때 읽는다 */
function useConfig(): AppConfig | null {
  const [config, setConfig] = useState<AppConfig | null>(null)
  useEffect(() => {
    void window.relay.config().then(setConfig)
  }, [])
  return config
}

const MODES = Object.entries(QUESTION_MODE_LABEL) as [QuestionMode, string][]

/** Work별 질문 방식 (D72). 고르지 않은 스킬은 앱 설정을 따른다. type이 있으면 그 유형의 단계만 보인다 (D256) */
function QuestionModes({
  config,
  type,
  value,
  onChange,
}: {
  config: AppConfig | null
  type: WorkType | null
  value: Overrides
  onChange: (v: Overrides) => void
}) {
  const set = (skill: QuestionSkill, mode: string) => {
    const rest = Object.fromEntries(Object.entries(value).filter(([k]) => k !== skill))
    onChange(mode ? { ...rest, [skill]: mode as QuestionMode } : rest)
  }
  return (
    <Groups
      items={SKILL_TITLES}
      type={type}
      row={(skill, title) => (
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
      )}
    />
  )
}

// ---------- 자동 승인 (4.2, D72) ----------

type AutoOverrides = Partial<Record<AutoApproveNode, boolean>>

const onOff = (on: boolean) => (on ? '켜짐' : '꺼짐')

/**
 * Work별 자동 승인 (D72). 고르지 않은 단계는 앱 설정을 따른다. 의도 정리와 리뷰와 검증은 늘 수동이다 (4.2).
 * type이 있으면 그 유형의 단계만 보인다 (D256)
 */
function AutoApproveOverrides({
  config,
  type,
  value,
  onChange,
}: {
  config: AppConfig | null
  type: WorkType | null
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
    <Groups
      items={AUTO_APPROVE_TITLES}
      type={type}
      row={(node, title) => (
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
      )}
    />
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
      // 보이지 않는 다른 유형의 단계 값은 남기지 않는다. 사람이 보거나 지울 수 없어서다 (D256, PR #23 리뷰)
      window.relay.updateWorkSettings(work.key, {
        auto_approve: only(auto, AUTO_APPROVE_TITLES, work.type),
        question_mode: only(modes, SKILL_TITLES, work.type),
        respond_auto_start: autoStart ?? null,
      }),
    )
    setBusy(false)
    if (r.ok) onClose()
    else setError(r.error)
  }

  return (
    <Modal title={`Work 설정 · ${work.workId} (${WORK_TYPE_LABEL[work.type]})`} onClose={onClose}>
      <h3>자동 승인 (Claude Code)</h3>
      <div className="dim">{AGENT_APPROVAL_NOTICE}</div>
      <div className="dim">
        바로 적용합니다. 턴이 끝날 때의 설정으로 판정하고, 카운트다운 중에 끄면 멈춥니다. 리뷰는
        지적이 없을 때만 자동 승인합니다.
      </div>
      <AutoApproveOverrides config={config} type={work.type} value={auto} onChange={setAuto} />
      <h3>자동 대응 (PR 진행)</h3>
      <div className="dim">
        켜도 이미 받은 새 항목으로는 시작하지 않고, 다음에 새 항목이 들어오면 함께 시작합니다.
      </div>
      <AutoStartOverride config={config} value={autoStart} onChange={setAutoStart} />
      <h3>질문 방식</h3>
      <div className="dim">질문 방식은 다음에 시작하는 task부터 씁니다.</div>
      <QuestionModes config={config} type={work.type} value={modes} onChange={setModes} />
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

  return (
    <Modal title="설정" onClose={onClose}>
      {value ? (
        <>
          <div className="dim">
            기본 엔진·모델·추론 수준과 상세 설정은 새로 만드는 task부터 적용합니다. 기존 task를
            재개하면 원래 엔진·모델·추론 수준을 사용합니다. 질문 방식은 다음에 시작하는 task부터
            씁니다.
          </div>
          <div className="form-grid">
            <label className="form-row" title="터미널은 테마와 관계없이 어둡습니다 (D335)">
              <span>테마</span>
              <select
                aria-label="테마"
                value={value.theme}
                onChange={(e) => setDraft({ ...value, theme: e.target.value as ThemeChoice })}
              >
                {THEME_CHOICES.map((t) => (
                  <option key={t} value={t}>
                    {THEME_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              <span>기본 엔진</span>
              <select
                aria-label="기본 엔진"
                value={value.agent_engine}
                onChange={(e) =>
                  setDraft(changeDefaultEngine(value, e.target.value as AgentEngine))
                }
              >
                {AGENT_ENGINES.map((engine) => (
                  <option key={engine} value={engine}>
                    {AGENT_LABELS[engine]}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row" title="비우면 엔진의 기본 모델을 씁니다">
              <span>기본 모델</span>
              <ModelSelect
                label="기본 모델"
                engine={value.agent_engine}
                value={value.agent_model}
                empty="엔진 기본"
                onChange={(model) => setDraft(changeDefaultModel(value, model))}
              />
            </label>
            <div className="form-row">
              <span>기본 추론 수준</span>
              <EffortSelect
                label="기본 추론 수준"
                engine={value.agent_engine}
                model={value.agent_model}
                value={value.agent_effort}
                empty="엔진 기본"
                onChange={(effort) => setDraft({ ...value, agent_effort: effort })}
              />
            </div>
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
              title="곁 세션을 열 때 쓰임과 권하는 쓰는 법을 알리는 창을 띄운다. 창의 [다시 보지 않기]가 끈다 (D392)"
            >
              <span>곁 세션을 열 때 안내 보기</span>
              <input
                type="checkbox"
                aria-label="곁 세션을 열 때 안내 보기"
                checked={value.side_notice}
                onChange={(e) => setDraft({ ...value, side_notice: e.target.checked })}
              />
            </label>
            <label
              className="form-row"
              title="verify가 지식을 바꾸면 앱이 따로 부르는 짧은 검토 호출의 CLI. Work의 엔진과 따로 고른다 (D300, D334)"
            >
              <span>지식 검토 엔진</span>
              <select
                aria-label="지식 검토 엔진"
                value={value.knowledge_review_engine}
                onChange={(e) =>
                  setDraft({ ...value, knowledge_review_engine: e.target.value as AgentEngine })
                }
              >
                {AGENT_ENGINES.map((engine) => (
                  <option key={engine} value={engine}>
                    {AGENT_LABELS[engine]}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="form-row"
              title="비우면 엔진의 기본(Claude Code는 sonnet, Codex는 CLI 설정)을 쓴다 (D334)"
            >
              <span>지식 검토 모델</span>
              <input
                type="text"
                aria-label="지식 검토 모델"
                placeholder={value.knowledge_review_engine === 'claude' ? 'sonnet' : 'CLI 기본'}
                value={value.knowledge_review_model}
                onChange={(e) => setDraft({ ...value, knowledge_review_model: e.target.value })}
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
            <label
              className="form-row"
              title="[새 세션] 창에 채울 폴더(절대 경로). 비우면 <RELAY_HOME>/home/. 다음에 만드는 세션부터 씁니다 (D398)"
            >
              <span>기본 세션 폴더</span>
              <input
                type="text"
                aria-label="기본 세션 폴더"
                placeholder="<RELAY_HOME>/home/"
                value={value.session_dir}
                onChange={(e) => setDraft({ ...value, session_dir: e.target.value })}
              />
            </label>
          </div>
          <details className="agent-steps">
            <summary>상세 설정 (단계별 엔진·모델·추론 수준)</summary>
            <div className="dim">
              단계마다 엔진·모델·추론 수준을 고릅니다. 고르지 않은 값은 위의 기본을 따릅니다. 단계의
              엔진이 기본 엔진과 다르면 그 엔진의 기본 모델·추론 수준을 씁니다.
            </div>
            <Groups
              items={AGENT_STEP_TITLES}
              type={null}
              row={(skill, title) => {
                const step = value.agent_steps[skill] ?? {}
                const engine = step.engine ?? value.agent_engine
                const set = (next: AgentStep) =>
                  setDraft({
                    ...value,
                    agent_steps: setAgentStep(value.agent_steps, skill, next, value),
                  })
                return (
                  <div key={skill} className="form-row agent-step">
                    <span>
                      {title} <span className="dim">({skill})</span>
                    </span>
                    <div className="agent-step-selects">
                      <select
                        aria-label={`${title} 엔진`}
                        value={step.engine ?? ''}
                        onChange={(e) =>
                          set(
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
                        label={`${title} 모델`}
                        engine={engine}
                        value={step.model ?? ''}
                        empty="기본 따름"
                        onChange={(model) => set({ ...step, model })}
                      />
                      <EffortSelect
                        label={`${title} 추론 수준`}
                        engine={engine}
                        model={stepModel(value, step)}
                        value={step.effort ?? ''}
                        empty="기본 따름"
                        onChange={(effort) => set({ ...step, effort })}
                      />
                    </div>
                  </div>
                )
              }}
            />
          </details>
          <h3>질문 방식</h3>
          <Groups
            items={SKILL_TITLES}
            type={null}
            row={(skill, title) => (
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
            )}
          />
          <h3>자동 승인 (Claude Code)</h3>
          <div className="dim">{AGENT_APPROVAL_NOTICE}</div>
          <div className="dim">
            켠 단계는 조건(4.3)을 만족하면 카운트다운 뒤 승인합니다. 턴이 끝날 때의 설정으로
            판정하고, 카운트다운 중에 끄면 멈춥니다. 의도 정리와 리뷰와 검증은 늘 수동입니다.
          </div>
          <Groups
            items={AUTO_APPROVE_TITLES}
            type={null}
            row={(node, title) => (
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
            )}
          />
          <div className="form-grid">
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
            목록에서 켭니다. Codex 대응 결과의 push와 답글 게시는 사람이 승인한 뒤 실행합니다.
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
  engine,
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
  /** 정리 세션을 띄울 엔진(지금 task의 엔진): "Claude Code", "Codex" */
  engine: string
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
          기록하지 않는 {engine} 세션을 열어 정리합니다. push와 PR은 계속 막혀 있습니다.
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
 * remove면 [기록 지우기](D407)다: 같은 확인으로 정리한 뒤 산출물과 기록도 지운다.
 */
export function CleanDialog({
  work,
  remove = false,
  onClose,
}: {
  work: WorkView
  remove?: boolean
  onClose: () => void
}) {
  const [preview, setPreview] = useState<CleanPreview | null>(null)
  const [deleteBranch, setDeleteBranch] = useState(false)
  const [deleteRemote, setDeleteRemote] = useState(false)
  const [deleteBackups, setDeleteBackups] = useState(true)
  const [confirmLost, setConfirmLost] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stale = false
    void call(() => window.relay.cleanPreview(work.key)).then((r) => {
      if (stale) return
      if (r.ok) {
        setPreview(r.preview)
        // 머지로 완료한 Work는 기본 체크다(D178). 작업 브랜치에만 있는 커밋이 있으면 기본은 두고 까닭을 보인다 (D329)
        setDeleteBranch(r.preview.merged && r.preview.branch.lost.length === 0)
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
    const input = {
      deleteBranch: deleteBranch && preview.branch.deletable,
      deleteRemote: deleteRemote && preview.remote?.exists === true,
      deleteBackups,
      confirmed,
      confirmLost,
      expect: preview.expect,
    }
    const r = await call(() =>
      remove ? window.relay.deleteWork(work.key, input) : window.relay.clean(work.key, input),
    )
    setBusy(false)
    if (r.ok) onClose()
    else setError(r.error)
  }

  const b = preview?.branch
  return (
    <Modal
      title={`${remove ? 'Work 기록 지우기' : 'Work 정리'} · ${work.workId}`}
      onClose={onClose}
    >
      {!preview ? (
        <div className="dim">{error ? null : '확인하는 중…'}</div>
      ) : (
        <div className="clean-summary" aria-label="정리 요약">
          {remove ? (
            <>
              <div>
                worktree를 지우고{preview.worktree ? '' : ' (이미 없음)'}, 산출물과 기록(works/
                {work.workId}/)도 지웁니다. 되돌릴 수 없습니다.
              </div>
              <DeleteNotes work={work} />
            </>
          ) : (
            <div>
              worktree를 지웁니다{preview.worktree ? '' : ' (이미 없음)'}. 산출물과 기록(works/
              {work.workId}/)은 남습니다.
            </div>
          )}
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
                        : preview.merged && b.deletable && b.lost.length === 0
                          ? '머지한 PR에 모든 커밋이 들어 있습니다 (squash·rebase 머지)'
                          : '원격에도 기준 브랜치에도 없습니다. 이 브랜치에만 있는 커밋이 있습니다'}
              </div>
              {b.lost.length ? (
                <>
                  <p>
                    머지한 PR에 없는 커밋 {b.lost.length}개가 이 브랜치에만 있습니다. 지우면 이
                    커밋을 잃습니다.
                  </p>
                  <ul className="files" aria-label="작업 브랜치에만 있는 커밋">
                    {b.lost.map((c) => (
                      <li key={c.sha}>
                        {c.sha.slice(0, 7)} {c.subject}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <label className="toggle" title="push됐거나 머지됐을 때만 삭제를 제안합니다">
                <input
                  type="checkbox"
                  aria-label="작업 브랜치 삭제"
                  disabled={!b.deletable}
                  checked={deleteBranch && b.deletable}
                  onChange={(e) => setDeleteBranch(e.target.checked)}
                />
                작업 브랜치 삭제{' '}
                {b.stacked?.length
                  ? `(${b.stacked.join(', ')}가 머지 대상으로 씀. 그 Work의 머지 대상을 바꾸면 지울 수 있음)`
                  : b.deletable
                    ? ''
                    : '(push됐거나 머지됐을 때만)'}
              </label>
              {deleteBranch && b.deletable && b.lost.length ? (
                <label className="toggle">
                  <input
                    type="checkbox"
                    aria-label="커밋을 잃는 것을 확인"
                    checked={confirmLost}
                    onChange={(e) => setConfirmLost(e.target.checked)}
                  />
                  이 커밋 {b.lost.length}개를 잃는 것을 확인했습니다
                </label>
              ) : null}
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
          disabled={
            busy ||
            !preview ||
            (preview.confirm.length > 0 && !confirmed) ||
            (deleteBranch &&
              preview.branch.deletable &&
              preview.branch.lost.length > 0 &&
              !confirmLost)
          }
          onClick={() => void clean()}
        >
          {busy ? (remove ? '지우는 중…' : '정리하는 중…') : remove ? '정리하고 지우기' : '정리'}
        </button>
      </div>
    </Modal>
  )
}

/** [기록 지우기]가 두는 것과 잃는 것 (D407) */
function DeleteNotes({ work }: { work: WorkView }) {
  const pending = work.issue?.pending ?? 0
  return (
    <>
      <div className="dim">
        레포에 남은 작업 브랜치와 에이전트 CLI의 대화 파일은 그대로 둡니다. 기록이 없어지면 남은
        브랜치의 지식은 새 Work에 넣지 않습니다.
      </div>
      {pending ? (
        <div className="notice">이슈에 아직 올리지 못한 기록 {pending}개는 올리지 않습니다.</div>
      ) : null}
    </>
  )
}

/** 보관된 Work의 [기록 지우기] (D407): worktree는 이미 없어 확인만 받는다 */
export function DeleteWorkDialog({ work, onClose }: { work: WorkView; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const remove = async () => {
    setBusy(true)
    setError(null)
    const r = await call(() => window.relay.deleteWork(work.key, null))
    setBusy(false)
    // 지우면 이 Work가 목록에서 빠져 창도 닫힌다
    if (r.ok) onClose()
    else setError(r.error)
  }
  return (
    <Modal title={`Work 기록 지우기 · ${work.workId}`} onClose={onClose}>
      <p>
        {work.title || work.workId}의 산출물과 기록(works/{work.workId}/)을 지웁니다. 되돌릴 수
        없습니다.
      </p>
      <DeleteNotes work={work} />
      {error ? <div className="error">{error}</div> : null}
      <div className="buttons">
        <button onClick={onClose}>취소</button>
        <button className="danger" disabled={busy} onClick={() => void remove()}>
          {busy ? '지우는 중…' : '지우기'}
        </button>
      </div>
    </Modal>
  )
}

// ---------- 프로젝트 등록 해제 (D408) ----------

/**
 * 프로젝트 우클릭 [등록 해제] (D408). Work가 모두 보관됐을 때만 받고, 그 Work의 기록(아카이브로 옮긴 것 포함)을 함께
 * 지운다. 막을지와 지울 Work 수는 main이 정해 보낸다(D409). 막으면 그 까닭을 보이고 누르지 못하게 둔다
 */
export function RemoveProjectDialog({
  project,
  onClose,
}: {
  project: ProjectView
  onClose: () => void
}) {
  const [preview, setPreview] = useState<ProjectRemovePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stale = false
    void call(() => window.relay.projectRemovePreview(project.id)).then((r) => {
      if (stale) return
      if (r.ok) setPreview(r.preview)
      else setError(r.error)
    })
    return () => {
      stale = true
    }
  }, [project.id])

  const remove = async () => {
    setBusy(true)
    setError(null)
    const r = await call(() => window.relay.removeProject(project.id))
    setBusy(false)
    if (r.ok) onClose()
    else setError(r.error)
  }
  return (
    <Modal title={`프로젝트 등록 해제 · ${project.name}`} onClose={onClose}>
      {!preview ? (
        <div className="dim">{error ? null : '확인하는 중…'}</div>
      ) : preview.block ? (
        <p role="alert" aria-label="해제할 수 없는 까닭">
          해제할 수 없습니다. {preview.block}
        </p>
      ) : (
        <>
          <p>
            {project.name}의 등록을 해제합니다.{' '}
            {preview.works
              ? `Work 기록 ${preview.works}개${preview.shelved ? `(아카이브 ${preview.shelved}개 포함)` : ''}와 산출물을 함께 지웁니다. 되돌릴 수 없습니다.`
              : '이 프로젝트에는 Work가 없습니다.'}
          </p>
          <div className="dim">
            레포({project.repoPath})와 브랜치는 그대로 둡니다. 같은 폴더를 다시 등록하면 Work 없이
            새로 시작합니다.
          </div>
        </>
      )}
      {error ? <div className="error">{error}</div> : null}
      <div className="buttons">
        <button onClick={onClose}>취소</button>
        <button
          className="danger"
          disabled={busy || !preview || preview.block !== null}
          onClick={() => void remove()}
        >
          {busy ? '해제하는 중…' : '등록 해제'}
        </button>
      </div>
    </Modal>
  )
}
