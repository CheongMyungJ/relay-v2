// 3단 레이아웃 (D79): 사이드바 / 터미널 탭과 액션 바 / 오른쪽 패널.
// 화면은 메인이 보낸 스냅샷을 그리기만 하고, 명령은 invoke로 보낸다 (I14).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  Modal,
  NewWorkDialog,
  ProjectDialog,
  ProjectSettingsDialog,
  SettingsDialog,
  StepDialog,
  WorkSettingsDialog,
} from './dialogs'
import { Activity } from './Activity'
import { withOpened } from './opened'
import { Panel, showsPr, wantsApproval } from './Panel'
import { TerminalView } from './TerminalView'
import { QuestionDialog } from './QuestionDialog'
import { UpdateButton } from './UpdateButton'
import {
  ARCHIVE_GROUP,
  loadCollapsed,
  pruned,
  saveCollapsed,
  sidebarGroups,
  toggled,
} from './sidebar'

type Dialog =
  | { kind: 'project' }
  | { kind: 'project-settings'; project: ProjectView }
  | { kind: 'work'; project: ProjectView }
  | { kind: 'settings' }
  | { kind: 'work-settings'; workKey: string }
  | { kind: 'abandon'; workKey: string }
  | { kind: 'step'; workKey: string; node?: NodeName }
  | { kind: 'clean'; workKey: string }
  | { kind: 'side'; workKey: string; fresh: boolean }
  | null

/** 정리 세션 탭을 고른 표시 (7-5). task id와 겹치지 않는다 */
const CLEANUP_TAB = '@cleanup'
/** 곁 세션 탭 (시나리오 11) */
const SIDE_TAB = '@side'

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
  // 접은 프로젝트와 아카이브. 이 컴퓨터의 화면 설정이라 브라우저 저장소에 둔다
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(loadCollapsed)
  // 보관된 Work의 우클릭 메뉴. 옮기지 못하면 그 까닭을 메뉴 안에 보인다
  const [menu, setMenu] = useState<{
    workKey: string
    x: number
    y: number
    error?: string
  } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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
    // 접은 상태는 등록된 프로젝트에 맞춰 정리한다
    const showProjects = (ps: ProjectView[]) => {
      setProjects(ps)
      setCollapsed((c) =>
        pruned(
          c,
          ps.map((p) => p.id),
        ),
      )
    }
    const offProjects = window.relay.onProjects(showProjects)
    // 알림을 누르면 그 Work를 고른다 (D81)
    const offFocus = window.relay.onFocusWork((key) => setSelected(key))
    void window.relay.snapshot().then((s) => {
      showProjects(s.projects)
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
  // 곁 세션 탭(시나리오 11)도 패널은 지금 task다
  const sideTab = !!work?.side.terminal && pickedId === SIDE_TAB
  const taskId =
    cleanupTab || sideTab || pickedId === CLEANUP_TAB || pickedId === SIDE_TAB
      ? (work?.current ?? null)
      : pickedId
  const found = work?.tasks.find((t) => t.id === taskId)
  // 도구 훅으로 따로 온 진행 표시가 있으면 그것을 보인다 (D216)
  const task = found && work ? withActivity(found, activities[`${work.key}|${found.id}`]) : found
  const questionTask = work ? currentTask(work) : undefined
  const question = work?.cleanup?.question ?? work?.side.question ?? questionTask?.question
  const questionTaskId = work?.cleanup?.question
    ? 'cleanup'
    : work?.side.question
      ? 'side'
      : questionTask?.id

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

  /**
   * [곁 세션 열기]·[새 대화로 열기] (시나리오 11). 설정이 켜져 있으면 안내 창을 먼저 띄운다 (D392). 열면 곁 세션 탭으로
   * 옮긴다
   */
  const requestSide = useCallback(
    async (workKey: string, fresh: boolean): Promise<CommandResult> => {
      const config = await window.relay.config().catch(() => null)
      if (!config || config.side_notice) {
        setDialog({ kind: 'side', workKey, fresh })
        return { ok: true }
      }
      const r = await call(() => window.relay.openSide(workKey, fresh))
      if (r.ok) setPicked((m) => ({ ...m, [workKey]: SIDE_TAB }))
      return r
    },
    [],
  )

  const groups = useMemo(() => sidebarGroups(Object.values(works)), [works])
  const toggleGroup = (group: string) => setCollapsed((c) => toggled(c, group))
  useEffect(() => saveCollapsed(collapsed), [collapsed])

  // 메뉴 밖을 누르거나 다른 곳을 우클릭하거나 창 크기가 바뀌거나 Esc를 누르면 닫는다. 사이드바를 스크롤해도 닫는다
  // (aside의 onScroll). 우클릭은 먼저(capture) 받아 닫으므로, 다른 보관된 Work를 우클릭하면 그 Work의 메뉴가 열린다
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  // 메뉴가 창 밖으로 나가면 창 안으로 당긴다. 사이드바를 스크롤하면 닫히므로 잘린 메뉴는 누를 수 없다
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!menu || !el) return
    const margin = 4
    const { width, height } = el.getBoundingClientRect()
    el.style.left = `${Math.max(margin, Math.min(menu.x, window.innerWidth - width - margin))}px`
    el.style.top = `${Math.max(margin, Math.min(menu.y, window.innerHeight - height - margin))}px`
  }, [menu])

  const workItem = (w: WorkView, inArchive: boolean) => {
    const t = currentTask(w)
    const done = w.badge.kind === 'done'
    return (
      <button
        key={w.key}
        className={`work-item${w.key === selected ? ' selected' : ''}`}
        onClick={() => setSelected(w.key)}
        onContextMenu={
          w.canShelve
            ? (e) => {
                e.preventDefault()
                setMenu({ workKey: w.key, x: e.clientX, y: e.clientY })
              }
            : undefined
        }
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
        {/* 아카이브는 여러 프로젝트의 Work를 모으므로 프로젝트 이름을 보인다 */}
        {inArchive ? (
          <span className="work-step">{w.projectName}</span>
        ) : !done && t ? (
          <span className="work-step">{t.label}</span>
        ) : null}
      </button>
    )
  }

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
    dialog?.kind === 'clean' ||
    dialog?.kind === 'side'
      ? works[dialog.workKey]
      : null
  // 단계 선택 대화상자 (6.2). node는 처음 고를 단계다(이전 단계 추천, D23)
  const openStep = (workKey: string, node?: NodeName) =>
    setDialog({ kind: 'step', workKey, ...(node ? { node } : {}) })

  return (
    <div className={`layout${wide ? ' wide' : ''}`}>
      <aside className="sidebar" onScroll={menu ? () => setMenu(null) : undefined}>
        <header className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="12" height="12">
              <path d="M3 4l4 4-4 4M9 4l4 4-4 4" />
            </svg>
          </span>
          <span className="brand-name">relay</span>
          {/* 실행 중인 앱의 버전 (I121) */}
          {info ? <span className="brand-version">v{info.version}</span> : null}
        </header>
        {warnings.map((w, i) => (
          <div key={i} className="notice warn">
            {w}
          </div>
        ))}
        {projects.map((p) => {
          const open = !collapsed.has(p.id)
          return (
            <div key={p.id} className="project">
              <div className="group-head">
                <GroupToggle open={open} label={p.name} onToggle={() => toggleGroup(p.id)} />
                <button
                  className="project-name"
                  title={`${p.repoPath} · 프로젝트 설정 (D185)`}
                  onClick={() => setDialog({ kind: 'project-settings', project: p })}
                >
                  {p.name}
                </button>
              </div>
              {open ? (
                <>
                  {(groups.byProject.get(p.id) ?? []).map((w) => workItem(w, false))}
                  <button
                    className="new-work"
                    onClick={() => setDialog({ kind: 'work', project: p })}
                  >
                    새 Work
                  </button>
                </>
              ) : null}
            </div>
          )
        })}
        {groups.archive.length > 0 ? (
          <div className="project archive">
            <div className="group-head">
              <GroupToggle
                open={!collapsed.has(ARCHIVE_GROUP)}
                label="아카이브"
                onToggle={() => toggleGroup(ARCHIVE_GROUP)}
              />
              <span className="project-name">
                아카이브 <span className="dim">{groups.archive.length}</span>
              </span>
            </div>
            {collapsed.has(ARCHIVE_GROUP) ? null : groups.archive.map((w) => workItem(w, true))}
          </div>
        ) : null}
        {menu ? (
          <div
            ref={menuRef}
            className="context-menu"
            role="menu"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              role="menuitem"
              onClick={() => {
                const key = menu.workKey
                void call(() => window.relay.shelve(key)).then((r) => {
                  // 실패는 다른 명령처럼 누른 곳 옆(메뉴 안)에 보이고, 메뉴를 닫으면 사라진다
                  setMenu((m) => (m?.workKey !== key ? m : r.ok ? null : { ...m, error: r.error }))
                })
              }}
            >
              아카이브로 옮기기
            </button>
            {menu.error ? (
              <div className="error" role="alert">
                아카이브로 옮기지 못함: {menu.error}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="sidebar-foot">
          <button className="add-project" onClick={() => setDialog({ kind: 'project' })}>
            프로젝트 추가
          </button>
          <button onClick={() => setDialog({ kind: 'settings' })}>설정</button>
          <UpdateButton />
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
          {work?.side.terminal ? (
            <div
              role="tab"
              aria-selected={sideTab}
              className={`tab side${sideTab ? ' active' : ''}${
                work.side.status === 'live' ? ' live' : ''
              }`}
              title="곁 세션: 질문, 논의, 별도 리뷰, 앱 문제 대응 (시나리오 11)"
              onClick={() => setPicked((m) => ({ ...m, [work.key]: SIDE_TAB }))}
            >
              <span
                className={`dot s-${work.side.status === 'live' ? 'working' : 'interrupted'}`}
              />
              곁 세션
            </div>
          ) : null}
          {question ? (
            <button className="question-reopen" onClick={() => setHiddenQuestionId(null)}>
              Codex 질문 답변
            </button>
          ) : null}
        </div>
        <div className="band">
          {sideTab && work ? (
            <SideBand work={work} onFresh={() => requestSide(work.key, true)} />
          ) : cleanupTab && work?.cleanup ? (
            <>
              <span className="band-text">
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
              {/* 상태는 앞에 둔다: 패널이 넓어져 머리 띠가 좁아도 잘리지 않고 설명이 줄어든다 */}
              <span className={`status s-${task.status}`}>{task.statusLabel}</span>
              {/* 끝난 task의 탭은 읽기 전용이다 (시나리오 5-1) */}
              {task.live ? null : <span className="readonly">읽기 전용</span>}
              <span className="band-text">
                {task.band}
                {task.engineLabel ? (
                  <span className="dim">
                    {' '}
                    · {task.engineLabel}
                    {task.engineVersion ? ` ${task.engineVersion}` : ''}
                  </span>
                ) : null}
              </span>
              {task.activity ? <Activity activity={task.activity} /> : null}
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
                      active={w.key === selected && !cleanupTab && !sideTab && t.id === taskId}
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
                  ...(w.side.terminal
                    ? [
                        <TerminalView
                          key={w.side.terminal}
                          terminalKey={w.side.terminal}
                          info={info}
                          live={w.side.status === 'live'}
                          active={w.key === selected && sideTab}
                        />,
                      ]
                    : []),
                ])
            : null}
          {!work ? (
            <div className="empty">
              {projects.length === 0 ? (
                <Welcome onAddProject={() => setDialog({ kind: 'project' })} />
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
            onOpenSide={() => requestSide(work.key, false)}
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
          <div className="panel-body panel-empty dim">handoff 상태와 산출물</div>
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
      {dialog?.kind === 'side' && dialogWork ? (
        <SideNoticeDialog
          work={dialogWork}
          fresh={dialog.fresh}
          onClose={() => setDialog(null)}
          onOpened={() => {
            setDialog(null)
            setPicked((m) => ({ ...m, [dialogWork.key]: SIDE_TAB }))
          }}
        />
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

/** 프로젝트와 아카이브를 접고 펴는 단추 */
function GroupToggle({
  open,
  label,
  onToggle,
}: {
  open: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <button
      className={`group-toggle${open ? ' open' : ''}`}
      aria-expanded={open}
      aria-label={`${label} ${open ? '접기' : '펼치기'}`}
      title={open ? '접기' : '펼치기'}
      onClick={onToggle}
    >
      <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
        <path d="M6 4l4 4-4 4" />
      </svg>
    </button>
  )
}

/** 프로젝트가 없을 때 가운데에 보이는 첫 사용 안내 (README 첫 사용) */
function Welcome({ onAddProject }: { onAddProject: () => void }) {
  return (
    <section className="welcome" aria-label="첫 사용">
      <h1>relay</h1>
      <p className="dim">
        AI 에이전트가 단계별로 일하고, 사람은 단계마다 산출물을 보고 승인합니다.
      </p>
      <ol className="welcome-steps">
        <li>
          <strong>프로젝트 등록</strong>
          <span className="dim">작업할 git 레포의 루트 폴더를 고릅니다</span>
        </li>
        <li>
          <strong>새 Work</strong>
          <span className="dim">업무 유형을 고르고 할 일을 적습니다</span>
        </li>
        <li>
          <strong>단계 승인</strong>
          <span className="dim">단계가 끝나면 산출물과 handoff를 확인하고 승인합니다</span>
        </li>
      </ol>
      <button className="primary" onClick={onAddProject}>
        프로젝트 추가
      </button>
    </section>
  )
}

/**
 * 액션 바 (시나리오 3-4, 3-5, 4.4, 6.2, 8): [즉시 중단], [재개]·[세션 재개], [이 단계 새 세션으로 다시],
 * [이 단계 끝나면 멈춤], [단계 선택], [Work 설정], [Work 포기], [Work 정리]. 누를 수 있는지는 main이 core로
 * 판정해 보낸다. 조작은 지금 task에 한다.
 */
/** 곁 세션 탭의 머리 띠 (시나리오 11). 끝났으면 [새 대화로 열기]를 둔다 */
function SideBand({ work, onFresh }: { work: WorkView; onFresh: () => Promise<CommandResult> }) {
  const [error, setError] = useState<string | null>(null)
  const fresh = async () => {
    setError(null)
    const r = await onFresh()
    if (!r.ok) setError(r.error)
  }
  return (
    <>
      <span className="band-text">
        곁 세션 · {work.side.engineLabel} · 기록하지 않음 · 바꾸기 전에 묻습니다
      </span>
      {work.side.notice ? <span className="band-warn">{work.side.notice}</span> : null}
      {work.side.status === 'live' ? null : (
        <>
          <span className="readonly">끝남 · 읽기 전용</span>
          {work.side.blocked ? null : (
            <button className="link" onClick={() => void fresh()}>
              새 대화로 열기
            </button>
          )}
        </>
      )}
      {error ? <span className="band-warn">{error}</span> : null}
    </>
  )
}

/**
 * 곁 세션을 열 때의 안내 창 (D392). 곁 세션은 묻고 안내받는 곳이고 단계 흐름을 대신하지 않는다고 권한다. "다시 보지
 * 않기"는 앱 설정(side_notice)에 남고 설정 화면에서 다시 켠다
 */
function SideNoticeDialog({
  work,
  fresh,
  onClose,
  onOpened,
}: {
  work: WorkView
  fresh: boolean
  onClose: () => void
  onOpened: () => void
}) {
  const [hide, setHide] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = async () => {
    setBusy(true)
    setError(null)
    if (hide) {
      const saved = await call(() => window.relay.updateConfig({ side_notice: false }))
      if (!saved.ok) {
        setBusy(false)
        setError(saved.error)
        return
      }
    }
    const r = await call(() => window.relay.openSide(work.key, fresh))
    setBusy(false)
    if (r.ok) onOpened()
    else setError(r.error)
  }
  return (
    <Modal title="곁 세션" onClose={onClose}>
      <p>
        곁 세션은 이 Work에 대해 <strong>묻고 안내받는 곳</strong>입니다. {work.side.engineLabel}로
        엽니다.
      </p>
      <ul className="side-notice">
        <li>
          <strong>이럴 때 쓰세요:</strong> 왜 이렇게 고쳤는지 묻기, 다른 방법 논의, 따로 리뷰 받기,
          앱이 꼬였을 때 원인과 다음 조작 묻기.
        </li>
        <li>
          <strong>단계 흐름을 대신하지는 마세요:</strong> 코드를 바꾸는 일은 [단계 선택]의 추가
          지시나 새 Work로 맡기기를 권합니다. 단계 흐름은 재현 테스트, 리뷰, 판정표, 승인을
          거치지만, 곁 세션에서 바꾼 것은 그 기록에 따로 남지 않습니다.
        </li>
        <li>에이전트는 코드 수정, push, GitHub 글쓰기를 하기 전에 묻습니다.</li>
      </ul>
      <label className="toggle">
        <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />
        다시 보지 않기 (설정에서 다시 켤 수 있음)
      </label>
      {error ? <div className="error">{error}</div> : null}
      <div className="buttons">
        <button onClick={onClose}>취소</button>
        <button className="primary" disabled={busy} onClick={() => void open()}>
          {fresh ? '새 대화로 열기' : '열기'}
        </button>
      </div>
    </Modal>
  )
}

function ActionBar({
  work,
  onSettings,
  onAbandon,
  onClean,
  onSelectStep,
  onResumed,
  onOpenSide,
}: {
  work: WorkView
  onSettings: () => void
  onAbandon: () => void
  onClean: () => void
  onSelectStep: () => void
  onResumed: () => void
  onOpenSide: () => Promise<CommandResult>
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
      {/* 곁 세션 (시나리오 11): 다른 버튼과 관계없이 언제든 열고 닫는다. 보관된 Work만 없다 (D385) */}
      {work.side.blocked ? null : work.side.status === 'live' ? (
        <button disabled={busy} onClick={() => void run(() => window.relay.closeSide(work.key))}>
          곁 세션 닫기
        </button>
      ) : (
        <button
          disabled={busy}
          title={
            work.side.resumable
              ? '앞 대화를 이어서 엽니다. 질문, 논의, 별도 리뷰, 앱 문제 대응에 씁니다'
              : '질문, 논의, 별도 리뷰, 앱 문제 대응에 쓰는 Claude Code 세션을 엽니다'
          }
          onClick={() => void run(onOpenSide)}
        >
          곁 세션 열기
        </button>
      )}
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
