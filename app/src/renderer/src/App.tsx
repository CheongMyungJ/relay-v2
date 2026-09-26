// 3단 레이아웃 (D79): 사이드바 / 터미널 탭과 액션 바 / 오른쪽 패널.
// 화면은 메인이 보낸 스냅샷을 그리기만 하고, 명령은 invoke로 보낸다 (I14).
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppInfo } from '../../shared/api'
import type { CommandResult, ProjectView, ReviewView, WorkView } from '../../shared/views'
import { call } from './commands'
import {
  ConfirmDialog,
  NewWorkDialog,
  ProjectDialog,
  SettingsDialog,
  WorkSettingsDialog,
} from './dialogs'
import { Panel, wantsApproval } from './Panel'
import { TerminalView } from './TerminalView'

type Dialog =
  | { kind: 'project' }
  | { kind: 'work'; project: ProjectView }
  | { kind: 'settings' }
  | { kind: 'work-settings'; workKey: string }
  | { kind: 'abandon'; workKey: string }
  | null

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
    // 알림을 누르면 그 Work를 고른다 (D81)
    const offFocus = window.relay.onFocusWork((key) => setSelected(key))
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
      offFocus()
    }
  }, [])

  // 보고 있는 Work를 main에 알린다. 그 Work의 알림은 보내지 않는다 (D81)
  useEffect(() => {
    window.relay.selectWork(selected)
  }, [selected])

  const work = selected ? works[selected] : undefined
  const taskId = work ? (picked[work.key] ?? work.current) : null
  const task = work?.tasks.find((t) => t.id === taskId)

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
  const dialogWork =
    dialog?.kind === 'work-settings' || dialog?.kind === 'abandon' ? works[dialog.workKey] : null

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
              const done = w.badge.kind === 'done'
              return (
                <button
                  key={w.key}
                  className={`work-item${w.key === selected ? ' selected' : ''}`}
                  onClick={() => setSelected(w.key)}
                  title={w.title}
                >
                  {/* 배지 하나와 현재 단계 (D80). 사람이 필요한 상태는 색으로 강조한다 */}
                  <span className={`badge b-${w.badge.kind}${w.badge.hot ? ' hot' : ''}`}>
                    {w.badge.label}
                  </span>
                  <span className="work-title">{w.title || w.workId}</span>
                  {!done && t ? <span className="work-step">{t.label}</span> : null}
                </button>
              )
            })}
            <button className="new-work" onClick={() => setDialog({ kind: 'work', project: p })}>
              새 Work
            </button>
          </div>
        ))}
        <div className="sidebar-foot">
          <button className="add-project" onClick={() => setDialog({ kind: 'project' })}>
            프로젝트 추가
          </button>
          <button onClick={() => setDialog({ kind: 'settings' })}>설정</button>
        </div>
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
              {/* 끝난 task의 탭은 읽기 전용이다 (시나리오 5-1) */}
              {task.live ? null : <span className="readonly">읽기 전용</span>}
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
        {work ? (
          <ActionBar
            key={work.key}
            work={work}
            onSettings={() => setDialog({ kind: 'work-settings', workKey: work.key })}
            onAbandon={() => setDialog({ kind: 'abandon', workKey: work.key })}
            onResumed={() => setPicked((m) => without(m, work.key))}
          />
        ) : (
          <div className="action-bar" />
        )}
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
      {dialog?.kind === 'settings' ? <SettingsDialog onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'work-settings' && dialogWork ? (
        <WorkSettingsDialog work={dialogWork} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'abandon' && dialogWork ? (
        <AbandonDialog work={dialogWork} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  )
}

/**
 * 액션 바 (시나리오 3-4, 3-5, 4.4): [즉시 중단], [재개]·[세션 재개], [이 단계 새 세션으로 다시],
 * [이 단계 끝나면 멈춤], [Work 설정], [Work 포기]. 누를 수 있는지는 main이 core로 판정해 보낸다.
 * 조작은 지금 task에 한다. 단계 선택은 M4에서 넣는다.
 */
function ActionBar({
  work,
  onSettings,
  onAbandon,
  onResumed,
}: {
  work: WorkView
  onSettings: () => void
  onAbandon: () => void
  onResumed: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const task = currentTask(work)
  const a = work.actions

  const run = async (fn: () => Promise<CommandResult>, after?: () => void) => {
    setBusy(true)
    setError(null)
    const r = await call(fn)
    setBusy(false)
    if (r.ok) after?.()
    else setError(r.error)
  }

  return (
    <div className="action-bar">
      {a.interrupt && task ? (
        <button
          disabled={busy}
          onClick={() => void run(() => window.relay.interrupt(work.key, task.id))}
        >
          즉시 중단
        </button>
      ) : null}
      {a.resume && task ? (
        <button
          className="primary"
          disabled={busy}
          onClick={() => void run(() => window.relay.resume(work.key, task.id), onResumed)}
        >
          {task.status === 'interrupted' ? '재개' : '세션 재개'}
        </button>
      ) : null}
      {a.retry && task ? (
        <button
          disabled={busy}
          onClick={() => void run(() => window.relay.retry(work.key, task.id), onResumed)}
        >
          이 단계 새 세션으로 다시
        </button>
      ) : null}
      {a.resumeWork ? (
        <button
          className="primary"
          disabled={busy}
          onClick={() => void run(() => window.relay.resumeWork(work.key), onResumed)}
        >
          재개
        </button>
      ) : null}
      {a.stopAfter ? (
        <label className="toggle" title="지금 단계가 승인되면 다음 단계를 시작하지 않고 멈춘다">
          <input
            type="checkbox"
            disabled={busy}
            checked={work.stopAfterStep}
            onChange={(e) => void run(() => window.relay.stopAfter(work.key, e.target.checked))}
          />
          이 단계 끝나면 멈춤
        </label>
      ) : null}
      {work.status === 'active' || work.status === 'stopped' ? (
        <button disabled={busy} onClick={onSettings}>
          Work 설정
        </button>
      ) : null}
      {a.abandon ? (
        <button className="danger" disabled={busy} onClick={onAbandon}>
          Work 포기
        </button>
      ) : null}
      {error ? <span className="error">{error}</span> : null}
      <span className="dim info">
        {work.workId} · 기준 {work.baseBranch} {work.baseCommit.slice(0, 8)}
        {work.intent ? ` · intent v${work.intent.version} ${work.intent.size}` : ''}
      </span>
      {work.problems.length ? <span className="error">{work.problems.at(-1)}</span> : null}
    </div>
  )
}

/** [Work 포기] 확인 창 (3.3). 살아 있는 세션을 끝내고 push/PR은 하지 않는다 */
function AbandonDialog({ work, onClose }: { work: WorkView; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const abandon = async () => {
    const r = await call(() => window.relay.abandon(work.key))
    if (r.ok) onClose()
    else setError(r.error)
  }
  return (
    <ConfirmDialog
      title="Work 포기"
      confirm="Work 포기"
      onConfirm={() => void abandon()}
      onClose={onClose}
    >
      <p>
        {work.title || work.workId}을(를) 포기합니다. 실행 중인 세션을 끝내고, push와 PR은 하지
        않습니다. 산출물과 worktree는 남습니다.
      </p>
      {error ? <div className="error">{error}</div> : null}
    </ConfirmDialog>
  )
}
