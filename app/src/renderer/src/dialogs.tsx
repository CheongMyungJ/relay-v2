// 대화상자: 프로젝트 등록(시나리오 0), 새 Work(시나리오 1), 확인 창([오류 무시하고 승인], 4.1).
import { useEffect, useState, type ReactNode } from 'react'
import type { ProjectInspection, ProjectView } from '../../shared/views'

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
    const r = await window.relay.registerProject(inspection.path, branch)
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.relay.branches(project.id).then((list) => {
      if (list.length) setBranches(list)
    })
  }, [project.id])

  const start = async () => {
    setBusy(true)
    setError(null)
    const r = await window.relay.createWork(project.id, {
      request,
      baseBranch: branch,
      baseLocation: location,
    })
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
