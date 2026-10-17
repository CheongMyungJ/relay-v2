// 기본 세션의 화면 (시나리오 12, D405): 가운데의 머리 띠와 액션 바, 오른쪽 패널(폴더, 엔진, Work 초안 카드), [새 세션]
// 창, 사이드바 우클릭의 [이름 바꾸기]·[지우기] 창. 화면의 세 칸은 Work와 같은 자리를 쓴다.
import { useEffect, useState } from 'react'
import { SESSION_NAME_MAX } from '../../shared/session'
import type { CommandResult, DraftView, ProjectView, SessionView } from '../../shared/views'
import { call } from './commands'
import { ConfirmDialog, Modal } from './dialogs'
import { DraftCards } from './DraftCards'

/** 머리 띠 (D405) */
export function SessionBand({ session }: { session: SessionView }) {
  return (
    <>
      <span className="band-text" title={session.cwd}>
        기본 세션 · {session.engineLabel} · {session.cwd} · 기록하지 않음 · 바꾸기 전에 묻습니다
      </span>
      {session.notice ? <span className="band-warn">{session.notice}</span> : null}
      {session.terminal && session.status !== 'live' ? (
        <span className="readonly">끝남 · 읽기 전용</span>
      ) : null}
    </>
  )
}

/** 액션 바 (D405): 살아 있으면 [닫기], 아니면 [열기]와 [새 대화로 열기] */
export function SessionActions({ session }: { session: SessionView }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<CommandResult>) => {
    setBusy(true)
    setError(null)
    const r = await call(fn)
    setBusy(false)
    if (!r.ok) setError(r.error)
  }
  return (
    <div className="action-bar">
      {session.status === 'live' ? (
        <button
          disabled={busy}
          onClick={() => void run(() => window.relay.closeSession(session.id))}
        >
          닫기
        </button>
      ) : (
        <>
          <button
            className="primary"
            disabled={busy}
            title={
              session.resumable
                ? `앞 대화를 이어서 엽니다(${session.engineLabel})`
                : `새 대화로 엽니다(${session.engineLabel})`
            }
            onClick={() => void run(() => window.relay.openSession(session.id, false))}
          >
            열기
          </button>
          <button
            disabled={busy}
            title="앞 대화를 잇지 않고 새 대화로 엽니다. 이름은 그대로입니다"
            onClick={() => void run(() => window.relay.openSession(session.id, true))}
          >
            새 대화로 열기
          </button>
        </>
      )}
      {error ? <span className="error">{error}</span> : null}
      <span className="dim info">{session.id}</span>
    </div>
  )
}

/** 오른쪽 패널 (D404, D405): 폴더, 엔진, Work 초안 카드 */
export function SessionPanel({
  session,
  projects,
  onCreateWork,
}: {
  session: SessionView
  projects: readonly ProjectView[]
  onCreateWork: (draft: DraftView, project: ProjectView) => void
}) {
  return (
    <div className="panel-body">
      <div className="panel-head">
        <span className="panel-title">{session.name}</span>
      </div>
      <div>
        <h3>폴더</h3>
        <div className="path">{session.cwd}</div>
        <h3>엔진</h3>
        <div>
          {session.engineLabel}
          {session.resumable ? <span className="dim"> · 이어 갈 대화 있음</span> : null}
        </div>
      </div>
      <div>
        <h3>Work 초안 {session.drafts.length ? session.drafts.length : ''}</h3>
        <DraftCards
          drafts={session.drafts}
          projects={projects}
          onCreate={onCreateWork}
          onDiscard={(d) => window.relay.discardDraft(session.id, d.ref.name)}
        />
      </div>
    </div>
  )
}

/** [새 세션] 창 (시나리오 12-1, D398): 폴더 칸(설정의 기본값), [찾아보기], [만들기]. 만들면 바로 띄운다 */
export function NewSessionDialog({
  onClose,
  onSelect,
}: {
  onClose: () => void
  /** 만든 세션을 고른다 */
  onSelect: (id: string) => void
}) {
  const [dir, setDir] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void call(() => window.relay.defaultSessionDir()).then((d) => {
      setDir((cur) => cur ?? (typeof d === 'string' ? d : ''))
    })
  }, [])
  const browse = async () => {
    const picked = await call(() => window.relay.pickFolder('기본 세션 폴더'))
    if (typeof picked === 'string') setDir(picked)
  }
  const create = async () => {
    setBusy(true)
    setError(null)
    const r = await call(() => window.relay.createSession(dir ?? ''))
    setBusy(false)
    if (r.ok) {
      onSelect(r.id)
      onClose()
      return
    }
    // 만들었지만 띄우지 못했으면 세션은 남는다: 고르고 창에 까닭을 보인다
    if ('id' in r && r.id) onSelect(r.id)
    setError(r.error)
  }
  return (
    <Modal title="새 세션" onClose={onClose}>
      <p className="dim">
        프로젝트나 Work에 매이지 않는 세션입니다. 폴더는 만든 뒤 바꾸지 않습니다(그 폴더에서 대화를
        잇습니다).
      </p>
      <div className="row">
        <label className="field grow">
          폴더
          <input
            aria-label="세션 폴더"
            value={dir ?? ''}
            onChange={(e) => setDir(e.target.value)}
          />
        </label>
        <button onClick={() => void browse()}>찾아보기</button>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="buttons">
        <button onClick={onClose}>취소</button>
        <button className="primary" disabled={busy || dir === null} onClick={() => void create()}>
          {busy ? '만드는 중…' : '만들기'}
        </button>
      </div>
    </Modal>
  )
}

/** 우클릭 [이름 바꾸기] (D403): 20자까지. 사람이 고친 이름은 앱이 다시 바꾸지 않는다 */
export function RenameSessionDialog({
  session,
  onClose,
}: {
  session: SessionView
  onClose: () => void
}) {
  const [name, setName] = useState(session.name)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    const r = await call(() => window.relay.renameSession(session.id, name))
    if (r.ok) onClose()
    else setError(r.error)
  }
  return (
    <Modal title="이름 바꾸기" onClose={onClose}>
      <label className="field">
        이름 ({SESSION_NAME_MAX}자까지, 넘으면 자릅니다)
        <input
          aria-label="세션 이름"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
          }}
        />
      </label>
      {error ? <div className="error">{error}</div> : null}
      <div className="buttons">
        <button onClick={onClose}>취소</button>
        <button className="primary" disabled={!name.trim()} onClick={() => void save()}>
          저장
        </button>
      </div>
    </Modal>
  )
}

/** 우클릭 [지우기] (D402): 끝난 세션만. 세션 디렉터리와 초안을 지운다 */
export function DeleteSessionDialog({
  session,
  onClose,
  onDeleted,
}: {
  session: SessionView
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const remove = async () => {
    const r = await call(() => window.relay.deleteSession(session.id))
    if (r.ok) onDeleted()
    else setError(r.error)
  }
  return (
    <ConfirmDialog
      title="세션 지우기"
      confirm="지우기"
      onConfirm={() => void remove()}
      onClose={onClose}
    >
      <p>
        {session.name}을(를) 지웁니다. 세션 기록과 Work 초안{' '}
        {session.drafts.length ? `${session.drafts.length}개` : ''}를 지웁니다. 고른 폴더(
        {session.cwd})와 CLI의 대화 파일은 그대로입니다.
      </p>
      {error ? <div className="error">{error}</div> : null}
    </ConfirmDialog>
  )
}
