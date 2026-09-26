// 3단 레이아웃 (D79): 사이드바 / 터미널 탭과 액션 바 / 오른쪽 패널.
// 화면은 메인이 보낸 스냅샷을 그리기만 하고, 명령은 invoke로 보낸다 (I14).
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppInfo } from '../../shared/api'
import type { ProjectView, ReviewView, WorkView } from '../../shared/views'
import { NewWorkDialog, ProjectDialog } from './dialogs'
import { Panel, wantsApproval } from './Panel'
import { TerminalView } from './TerminalView'

type Dialog = { kind: 'project' } | { kind: 'work'; project: ProjectView } | null

/** 사람이 움직여야 하는 상태 (D80의 강조. 배지 우선순위는 M3에서 넣는다) */
const NEEDS_HUMAN = new Set([
  'awaiting_approval',
  'asking',
  'input_needed',
  'blocked',
  'session_ended',
])

function currentTask(w: WorkView) {
  return w.tasks.find((t) => t.id === w.current)
}

function without<T>(m: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(m).filter(([k]) => k !== key))
}

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [projects, setProjects] = useState<ProjectView[]>([])
  const [works, setWorks] = useState<Record<string, WorkView>>({})
  const [warnings, setWarnings] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  // Work마다 사람이 고른 탭. 없으면 지금 task를 따라간다
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [dialog, setDialog] = useState<Dialog>(null)
  const [review, setReview] = useState<ReviewView | null>(null)

  useEffect(() => {
    void window.relay.appInfo().then(setInfo)
    const offWork = window.relay.onWork((w) => setWorks((m) => ({ ...m, [w.key]: w })))
    const offProjects = window.relay.onProjects(setProjects)
    void window.relay.snapshot().then((s) => {
      setProjects(s.projects)
      setWarnings(s.warnings)
      // 앱을 켜면 가장 최근 Work를 고른다
      const newest = [...s.works].sort((a, b) => b.workId.localeCompare(a.workId))[0]
      if (newest) setSelected((cur) => cur ?? newest.key)
      setWorks((m) => {
        const next = { ...m }
        for (const w of s.works) {
          const known = next[w.key]
          if (!known || known.revision < w.revision) next[w.key] = w
        }
        return next
      })
    })
    return () => {
      offWork()
      offProjects()
    }
  }, [])

  const work = selected ? works[selected] : undefined
  const taskId = work ? (picked[work.key] ?? work.current) : null
  const task = work?.tasks.find((t) => t.id === taskId)
  const busy = Object.values(works).some((w) => w.tasks.some((t) => t.live))

  // 승인 화면은 상태가 바뀔 때마다 파일을 다시 읽어 만든다
  const reviewKey = work && task ? `${work.key}|${task.id}|${work.revision}` : null
  useEffect(() => {
    if (!work || !task) return
    let stale = false
    const timer = setTimeout(() => {
      void window.relay.review(work.key, task.id).then((r) => {
        if (!stale) setReview(r)
      })
    }, 150)
    return () => {
      stale = true
      clearTimeout(timer)
    }
    // reviewKey가 Work, task, revision을 모두 담는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewKey])

  const selectTask = useCallback((w: WorkView, id: string) => {
    // 지금 task를 고르면 다시 지금 task를 따라간다
    setPicked((m) => (id === w.current ? without(m, w.key) : { ...m, [w.key]: id }))
  }, [])

  const worksByProject = useMemo(() => {
    const out = new Map<string, WorkView[]>()
    for (const w of Object.values(works)) {
      const list = out.get(w.projectId) ?? []
      list.push(w)
      out.set(w.projectId, list)
    }
    for (const list of out.values()) list.sort((a, b) => b.workId.localeCompare(a.workId))
    return out
  }, [works])

  const wide = wantsApproval(review) && review?.taskId === task?.id

  return (
    <div className={`layout${wide ? ' wide' : ''}`}>
      <aside className="sidebar">
        {warnings.map((w, i) => (
          <div key={i} className="notice warn">
            {w}
          </div>
        ))}
        {projects.map((p) => (
          <div key={p.id} className="project">
            <div className="project-name" title={p.repoPath}>
              {p.name}
            </div>
            {(worksByProject.get(p.id) ?? []).map((w) => {
              const t = currentTask(w)
              const hot = w.status === 'active' && t && NEEDS_HUMAN.has(t.status)
              return (
                <button
                  key={w.key}
                  className={`work-item${w.key === selected ? ' selected' : ''}`}
                  onClick={() => setSelected(w.key)}
                  title={w.title}
                >
                  <span className={`badge${hot ? ' hot' : ''}`}>
                    {w.status === 'active' ? (t?.statusLabel ?? w.statusLabel) : w.statusLabel}
                  </span>
                  <span className="work-title">{w.title || w.workId}</span>
                  {w.status === 'active' && t ? <span className="work-step">{t.label}</span> : null}
                </button>
              )
            })}
            <button
              className="new-work"
              disabled={busy}
              title={busy ? 'M2는 한 번에 Work 하나만 진행합니다' : undefined}
              onClick={() => setDialog({ kind: 'work', project: p })}
            >
              새 Work
            </button>
          </div>
        ))}
        <button className="add-project" onClick={() => setDialog({ kind: 'project' })}>
          프로젝트 추가
        </button>
      </aside>

      <main className="center">
        <div className="tabs" role="tablist">
          {work?.tasks.map((t) => (
            <div
              key={t.id}
              role="tab"
              aria-selected={t.id === taskId}
              className={`tab${t.id === taskId ? ' active' : ''}${t.live ? ' live' : ''}`}
              onClick={() => selectTask(work, t.id)}
            >
              <span className={`dot s-${t.status}`} />
              {t.label}
            </div>
          ))}
        </div>
        <div className="band">
          {task ? (
            <>
              <span>{task.band}</span>
              <span className={`status s-${task.status}`}>{task.statusLabel}</span>
              {task.notice ? <span className="band-warn">{task.notice}</span> : null}
            </>
          ) : null}
        </div>
        <div className="terminal">
          {info
            ? Object.values(works).flatMap((w) =>
                w.tasks.map((t) => (
                  <TerminalView
                    key={t.terminal}
                    terminalKey={t.terminal}
                    info={info}
                    live={t.live}
                    active={w.key === selected && t.id === taskId}
                  />
                )),
              )
            : null}
          {!work ? (
            <div className="empty">
              {projects.length === 0 ? (
                <button onClick={() => setDialog({ kind: 'project' })}>프로젝트 추가</button>
              ) : (
                <span className="dim">왼쪽에서 Work를 고르거나 새 Work를 만드세요</span>
              )}
            </div>
          ) : null}
        </div>
        <div className="action-bar">
          {work ? (
            <span className="dim">
              {work.workId} · 기준 {work.baseBranch} {work.baseCommit.slice(0, 8)}
              {work.intent ? ` · intent v${work.intent.version} ${work.intent.size}` : ''}
            </span>
          ) : null}
          {work?.problems.length ? <span className="error">{work.problems.at(-1)}</span> : null}
        </div>
      </main>

      <aside className="panel">
        {work && task ? (
          <Panel
            work={work}
            task={task}
            review={review?.taskId === task.id && review.workKey === work.key ? review : null}
            onApproved={() => setPicked((m) => without(m, work.key))}
          />
        ) : (
          <div className="panel-body dim">handoff 상태와 산출물</div>
        )}
      </aside>

      {dialog?.kind === 'project' ? <ProjectDialog onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'work' ? (
        <NewWorkDialog
          project={dialog.project}
          onClose={() => setDialog(null)}
          onCreated={(key) => {
            setDialog(null)
            setSelected(key)
          }}
        />
      ) : null}
    </div>
  )
}
