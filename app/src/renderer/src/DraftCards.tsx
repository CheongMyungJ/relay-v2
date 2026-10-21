// Work 초안 카드 (D404). 만든 곳(DraftSource)과 상관없는 공용 컴포넌트다: 기본 세션의 오른쪽 패널과, Work의 task와 곁 세션이
// 다시 하기로 쓴 초안을 보이는 Work의 오른쪽 패널(D421)이 쓴다. [새 Work로 만들기]는 새 Work 대화상자를 채워 열고, [버리기]는
// 초안을 지운다.
import { useState } from 'react'
import { WORK_TYPE_LABEL } from '../../shared/work'
import type { CommandResult, DraftView, ProjectView } from '../../shared/views'
import { call } from './commands'

/** 초안 카드 목록. 비어 있으면 쓰는 법을 짧게 보인다 */
export function DraftCards({
  drafts,
  projects,
  onCreate,
  onDiscard,
}: {
  drafts: readonly DraftView[]
  projects: readonly ProjectView[]
  /** 새 Work 대화상자를 그 프로젝트로 열고 초안의 칸을 채운다 */
  onCreate: (draft: DraftView, project: ProjectView) => void
  onDiscard: (draft: DraftView) => Promise<CommandResult>
}) {
  if (!drafts.length)
    return (
      <div className="dim">
        에이전트가 새 Work를 구상해 초안을 쓰면 여기에 카드로 보입니다. [새 Work로 만들기]로 새 Work
        대화상자를 채워 엽니다.
      </div>
    )
  return (
    <div className="drafts">
      {drafts.map((d) => (
        <DraftCard
          // 만든 곳과 파일 이름으로 가른다: 다른 세션의 같은 이름 초안에 고른 것이 넘어가지 않게
          key={`${d.ref.source.kind}/${d.ref.source.id}/${d.ref.name}`}
          draft={d}
          projects={projects}
          onCreate={onCreate}
          onDiscard={onDiscard}
        />
      ))}
    </div>
  )
}

function DraftCard({
  draft,
  projects,
  onCreate,
  onDiscard,
}: {
  draft: DraftView
  projects: readonly ProjectView[]
  onCreate: (draft: DraftView, project: ProjectView) => void
  onDiscard: (draft: DraftView) => Promise<CommandResult>
}) {
  const known = projects.find((p) => p.id === draft.project)
  // 프로젝트가 틀렸으면 맞는 칸만 채워 열도록 사람이 프로젝트를 고른다 (D404). 고른 것이 없거나 목록에 없으면(카드를 그린
  // 뒤 프로젝트를 등록함) 첫 프로젝트다
  const [pick, setPick] = useState<string | null>(null)
  const project = known ?? projects.find((p) => p.id === pick) ?? projects[0]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const discard = async () => {
    setBusy(true)
    setError(null)
    const r = await call(() => onDiscard(draft))
    setBusy(false)
    if (!r.ok) setError(r.error)
  }
  return (
    <div className={`draft-card${draft.errors.length ? ' has-errors' : ''}`} aria-label="Work 초안">
      <div className="draft-title" title={draft.ref.name}>
        {draft.title || draft.ref.name}
      </div>
      <div className="dim draft-meta">
        {known ? known.name : '프로젝트 모름'} ·{' '}
        {draft.type ? WORK_TYPE_LABEL[draft.type] : '유형 모름'}
        {draft.base ? ` · 기준 ${draft.base}` : ''} · <code>{draft.ref.name}</code>
      </div>
      {draft.errors.length ? (
        <ul className="error draft-errors">
          {draft.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {!known && projects.length ? (
        <label className="field">
          열 프로젝트
          <select
            aria-label="열 프로젝트"
            value={project?.id ?? ''}
            onChange={(e) => setPick(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="notice-actions">
        <button
          className="primary"
          disabled={busy || !project}
          title={project ? '' : '먼저 프로젝트를 등록하세요'}
          onClick={() => project && onCreate(draft, project)}
        >
          새 Work로 만들기
        </button>
        <button disabled={busy} onClick={() => void discard()}>
          버리기
        </button>
      </div>
      {error ? <div className="error">{error}</div> : null}
    </div>
  )
}
