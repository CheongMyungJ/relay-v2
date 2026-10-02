// 3단 레이아웃 (D79): 사이드바 / 터미널 탭과 액션 바 / 오른쪽 패널.
// 화면은 메인이 보낸 스냅샷을 그리기만 하고, 명령은 invoke로 보낸다 (I14).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppInfo } from '../../shared/api'
import type { NodeName } from '../../shared/contracts'
import { WORK_TYPE_LABEL, WORK_TYPE_SHORT } from '../../shared/work'
import type {
  ActivityView,
  CommandResult,
  ProjectView,
  ReviewView,
  TaskView,
  WorkView,
} from '../../shared/views'
import { call } from './commands'
import {
  CleanDialog,
  ConfirmDialog,
  NewWorkDialog,
  ProjectDialog,
  ProjectSettingsDialog,
  SettingsDialog,
  StepDialog,
  WorkSettingsDialog,
} from './dialogs'
import { Activity } from './Activity'
import { withOpened } from './opened'
import { KnowledgeDialog } from './Knowledge'
import { Panel, showsPr, wantsApproval } from './Panel'
import { TerminalView } from './TerminalView'
import { QuestionDialog } from './QuestionDialog'

type Dialog =
  | { kind: 'project' }
  | { kind: 'project-settings'; project: ProjectView }
  | { kind: 'knowledge'; project: ProjectView }
  | { kind: 'work'; project: ProjectView }
  | { kind: 'settings' }
  | { kind: 'work-settings'; workKey: string }
  | { kind: 'abandon'; workKey: string }
  | { kind: 'step'; workKey: string; node?: NodeName }
  | { kind: 'clean'; workKey: string }
  | null

/** 정리 세션 탭을 고른 표시 (7-5). task id와 겹치지 않는다 */
const CLEANUP_TAB = '@cleanup'

function currentTask(w: WorkView) {
  return w.tasks.find((t) => t.id === w.current)
}

function without<T>(m: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(m).filter(([k]) => k !== key))
}

/** 도구 훅으로 따로 온 진행 표시(D216). 키는 "<Work 키>|<task id>"다 */
type Activities = Record<string, ActivityView | null>

/** 한 Work의 따로 온 진행 표시를 지운다. 없으면 그대로 돌려준다 */
function withoutWork(m: Activities, workKey: string): Activities {
  const prefix = `${workKey}|`
  if (!Object.keys(m).some((k) => k.startsWith(prefix))) return m
  return Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith(prefix)))
}

/** 따로 온 진행 표시가 있으면 스냅샷의 값 대신 쓴다 */
function withActivity(t: TaskView, activity: ActivityView | null | undefined): TaskView {
  return activity === undefined ? t : { ...t, activity }
}

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [projects, setProjects] = useState<ProjectView[]>([])
  const [works, setWorks] = useState<Record<string, WorkView>>({})
  const [activities, setActivities] = useState<Activities>({})
  const [warnings, setWarnings] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  // Work마다 사람이 고른 탭. 없으면 지금 task를 따라간다
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [dialog, setDialog] = useState<Dialog>(null)
  const [review, setReview] = useState<ReviewView | null>(null)
  const [hiddenQuestionId, setHiddenQuestionId] = useState<string | null>(null)

  useEffect(() => {
    void window.relay.appInfo().then(setInfo)
    const offWork = window.relay.onWork((w) => {
      setWorks((m) => ({ ...m, [w.key]: w }))
      // 스냅샷의 진행 표시가 그 앞에 따로 온 것보다 새것이다 (D216)
      setActivities((m) => withoutWork(m, w.key))
    })
    const offActivity = window.relay.onActivity((u) =>
      setActivities((m) => ({ ...m, [`${u.workKey}|${u.taskId}`]: u.activity })),
    )
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
      offActivity()
      offProjects()
      offFocus()
    }
  }, [])

  // 보고 있는 Work를 main에 알린다. 그 Work의 알림은 보내지 않는다 (D81)
  useEffect(() => {
    window.relay.selectWork(selected)
  }, [selected])

  // 터미널은 고른 적 있는 Work만 만든다 (D143). 고른 Work가 바뀌면 렌더 중에 더한다(React 문서의 이전 렌더 정보 저장)
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set())
  const nextOpened = withOpened(opened, selected)
  if (nextOpened !== opened) setOpened(nextOpened)

  const work = selected ? works[selected] : undefined
  const pickedId = work ? (picked[work.key] ?? work.current) : null
  // 정리 세션 탭(7-5)을 고르면 터미널은 정리 세션이고, 패널은 지금 task(Work 완료 화면)다
  const cleanupTab = !!work?.cleanup && pickedId === CLEANUP_TAB
  const taskId = cleanupTab || pickedId === CLEANUP_TAB ? (work?.current ?? null) : pickedId
  const found = work?.tasks.find((t) => t.id === taskId)
  // 도구 훅으로 따로 온 진행 표시가 있으면 그것을 보인다 (D216)
  const task = found && work ? withActivity(found, activities[`${work.key}|${found.id}`]) : found
  const questionTask = work ? currentTask(work) : undefined
  const question = work?.cleanup?.question ?? questionTask?.question
  const questionTaskId = work?.cleanup?.question ? 'cleanup' : questionTask?.id

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

  // 머지 뒤 정리 창 (D178, D200): 머지로 완료한 Work를 보고 있으면 한 번 연다. 앱에서 머지했거나 밖에서 머지된 것을
  // 읽었을 때, 다른 Work를 보고 있었으면 그 Work를 고를 때다. 연 것을 main에 알려 다시 열지 않는다
  const offered = useRef(new Set<string>())
  useEffect(() => {
    if (!work?.pr?.offerClean || dialog !== null || offered.current.has(work.key)) return
    offered.current.add(work.key)
    setDialog({ kind: 'clean', workKey: work.key })
    void call(() => window.relay.prCleanOffered(work.key))
  }, [work, dialog])

  const wide =
    (wantsApproval(review) && review?.taskId === task?.id) || (!!work && showsPr(work, task?.id))
  const dialogWork =
    dialog?.kind === 'work-settings' ||
    dialog?.kind === 'abandon' ||
    dialog?.kind === 'step' ||
    dialog?.kind === 'clean'
      ? works[dialog.workKey]
      : null
  // 단계 선택 대화상자 (6.2). node는 처음 고를 단계다(이전 단계 추천, D23)
  const openStep = (workKey: string, node?: NodeName) =>
    setDialog({ kind: 'step', workKey, ...(node ? { node } : {}) })

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
            <div className="project-row">
              <button
                className="project-name"
                title={`${p.repoPath} · 프로젝트 설정 (D185)`}
                onClick={() => setDialog({ kind: 'project-settings', project: p })}
              >
                {p.name}
              </button>
              {/* 지식은 Work가 아니라 프로젝트에 붙는다 (D294, D307, I77) */}
              {p.knowledgeOff ? null : (
                <button
                  className="project-knowledge"
                  title="지식 화면: 팀, 나만, 공유 대기 (D307)"
                  onClick={() => setDialog({ kind: 'knowledge', project: p })}
                >
                  지식
                </button>
              )}
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
                  {/* 배지 하나와 유형, 현재 단계 (D80, D256). 사람이 필요한 상태는 색으로 강조한다 */}
                  <span className={`badge b-${w.badge.kind}${w.badge.hot ? ' hot' : ''}`}>
                    {w.badge.label}
                  </span>
                  <span className="work-title">
                    <span className="type-tag" title={WORK_TYPE_LABEL[w.type]}>
                      {WORK_TYPE_SHORT[w.type]}
                    </span>{' '}
                    {w.title || w.workId}
                  </span>
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
              className={`tab${t.id === taskId ? ' active' : ''}${t.live ? ' live' : ''}${
                t.status === 'discarded' ? ' discarded' : ''
              }`}
              title={t.status === 'discarded' ? `${t.label}: 폐기됨` : t.label}
              onClick={() => selectTask(work, t.id)}
            >
              <span className={`dot s-${t.status}`} />
              {t.label}
            </div>
          ))}
          {work?.cleanup ? (
            <div
              role="tab"
              aria-selected={cleanupTab}
              className={`tab cleanup${cleanupTab ? ' active' : ''}${
                work.cleanup.status === 'live' ? ' live' : ''
              }`}
              title="정리 세션: 기록하지 않는 일반 터미널 (7-5)"
              onClick={() => setPicked((m) => ({ ...m, [work.key]: CLEANUP_TAB }))}
            >
              <span
                className={`dot s-${work.cleanup.status === 'live' ? 'working' : 'interrupted'}`}
              />
              정리 세션
            </div>
          ) : null}
          {question ? (
            <button className="question-reopen" onClick={() => setHiddenQuestionId(null)}>
              Codex 질문 답변
            </button>
          ) : null}
        </div>
        <div className="band">
          {cleanupTab && work?.cleanup ? (
            <>
              <span>
                정리 세션 · {work.cleanup.engineLabel ?? 'Claude Code'} · 기록하지 않음 · push와
                PR은 앱에서 수행
              </span>
              {work.cleanup.notice ? (
                <span className="band-warn">{work.cleanup.notice}</span>
              ) : null}
              {work.cleanup.status === 'live' ? null : (
                <span className="readonly">
                  {work.cleanup.status === 'queued' ? '대기열' : '끝남 · 읽기 전용'}
                </span>
              )}
            </>
          ) : task && work ? (
            <>
              <span className="type-tag" title={WORK_TYPE_LABEL[work.type]}>
                {WORK_TYPE_SHORT[work.type]}
              </span>
              <span>
                {task.band}
                {task.engineLabel ? (
                  <span className="dim">
                    {' '}
                    · {task.engineLabel}
                    {task.engineVersion ? ` ${task.engineVersion}` : ''}
                  </span>
                ) : null}
              </span>
              <span className={`status s-${task.status}`}>{task.statusLabel}</span>
              {task.activity ? <Activity activity={task.activity} /> : null}
              {/* 끝난 task의 탭은 읽기 전용이다 (시나리오 5-1) */}
              {task.live ? null : <span className="readonly">읽기 전용</span>}
              {task.notice ? <span className="band-warn">{task.notice}</span> : null}
            </>
          ) : null}
        </div>
        <div className="terminal">
          {info
            ? Object.values(works)
                .filter((w) => nextOpened.has(w.key))
                .flatMap((w) => [
                  ...w.tasks.map((t) => (
                    <TerminalView
                      key={t.terminal}
                      terminalKey={t.terminal}
                      info={info}
                      live={t.live}
                      active={w.key === selected && !cleanupTab && t.id === taskId}
                    />
                  )),
                  ...(w.cleanup
                    ? [
                        <TerminalView
                          key={w.cleanup.terminal}
                          terminalKey={w.cleanup.terminal}
                          info={info}
                          live={w.cleanup.status === 'live'}
                          active={w.key === selected && cleanupTab}
                        />,
                      ]
                    : []),
                ])
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
            onClean={() => setDialog({ kind: 'clean', workKey: work.key })}
            onSelectStep={() => openStep(work.key)}
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
            onSelectStep={(node) => openStep(work.key, node)}
            onShowCleanup={() => setPicked((m) => ({ ...m, [work.key]: CLEANUP_TAB }))}
          />
        ) : (
          <div className="panel-body dim">handoff 상태와 산출물</div>
        )}
      </aside>

      {dialog?.kind === 'project' ? <ProjectDialog onClose={() => setDialog(null)} /> : null}
      {!dialog && work && question && questionTaskId && question.id !== hiddenQuestionId ? (
        <QuestionDialog
          key={question.id}
          workKey={work.key}
          taskId={questionTaskId}
          pending={question}
          onHide={() => setHiddenQuestionId(question.id)}
        />
      ) : null}
      {dialog?.kind === 'project-settings' ? (
        <ProjectSettingsDialog
          project={projects.find((p) => p.id === dialog.project.id) ?? dialog.project}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'knowledge' ? (
        <KnowledgeDialog project={dialog.project} onClose={() => setDialog(null)} />
      ) : null}
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
      {dialog?.kind === 'clean' && dialogWork ? (
        <CleanDialog work={dialogWork} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'step' && dialogWork ? (
        <StepDialog
          work={dialogWork}
          {...(dialog.node ? { initial: dialog.node } : {})}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null)
            setPicked((m) => without(m, dialogWork.key))
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * 액션 바 (시나리오 3-4, 3-5, 4.4, 6.2, 8): [즉시 중단], [재개]·[세션 재개], [이 단계 새 세션으로 다시],
 * [이 단계 끝나면 멈춤], [단계 선택], [Work 설정], [Work 포기], [Work 정리]. 누를 수 있는지는 main이 core로
 * 판정해 보낸다. 조작은 지금 task에 한다.
 */
function ActionBar({
  work,
  onSettings,
  onAbandon,
  onClean,
  onSelectStep,
  onResumed,
}: {
  work: WorkView
  onSettings: () => void
  onAbandon: () => void
  onClean: () => void
  onSelectStep: () => void
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
      {a.selectStep ? (
        <button disabled={busy} onClick={onSelectStep}>
          단계 선택
        </button>
      ) : null}
      {/* PR 진행 중에도 [Work 설정]을 받는다: 대응 자동 시작과 PR 대응 자동 승인을 바꾼다 (D209) */}
      {work.status === 'active' || work.status === 'stopped' || work.status === 'pr' ? (
        <button disabled={busy} onClick={onSettings}>
          Work 설정
        </button>
      ) : null}
      {a.abandon ? (
        <button className="danger" disabled={busy} onClick={onAbandon}>
          Work 포기
        </button>
      ) : null}
      {a.clean ? (
        <button disabled={busy} onClick={onClean}>
          Work 정리
        </button>
      ) : null}
      {error ? <span className="error">{error}</span> : null}
      <span className="dim info">
        {work.workId} · 기준 {work.baseBranch} {work.baseCommit.slice(0, 8)}
        {work.intent ? ` · intent v${work.intent.version}` : ''}
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
