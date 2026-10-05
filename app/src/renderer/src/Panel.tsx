// 오른쪽 패널 (D79, D83). handoff 상태와 형식 오류, 산출물 목록을 보이고,
// 승인할 수 있으면 넓어져 승인 화면이 된다. verify의 승인 화면은 Work 완료 화면이다 (시나리오 7-3):
// 전달 선택([완료만], [push], [PR 생성]), 커밋 안 된 변경의 선택지(7-5), 전달 실패의 [다시 시도]·
// [전달 없이 완료](7-6, D120). verify에서 멈춘 Work도 이 화면에서 전달을 고른다 (D119).
// 맨 위에는 재시작 때와 실행 중의 알림을 보인다: 끊긴 작업의 [다시 시도]·[무시], 끝낸 고아 프로세스와 바뀐
// 파일의 [확인] (시나리오 9, D121~D124). 끊긴 작업이 있는 동안 승인과 전달 버튼은 누를 수 없다 (D122).
// 자동 승인 중이면 승인 화면에 카운트다운과 [취소]를 보이고, 켜진 단계인데 카운트다운하지 않으면 까닭을 보인다 (D83, 4.3).
// PR 진행인 Work의 지금 task(verify)에서는 PR 패널이 된다 (시나리오 10, D183). 리뷰와 검증 결과는 탭으로 본다.
// 지금 task가 PR 대응 task면 PR 패널과 그 대응 task를 탭으로 오가고, 승인할 때는 대응 승인 화면(항목별 결과, 게시될 모양의
// 답글, 기존 테스트 변경, D172, D202, D207)을 먼저 보인다.
import { useEffect, useState } from 'react'
import type { NodeName } from '../../shared/contracts'
import type {
  BranchInfo,
  CommandResult,
  CountdownView,
  DeliverResult,
  IssueView,
  KnowledgeChange,
  PrView,
  ReviewView,
  TaskView,
  WorkView,
} from '../../shared/views'
import type { DeliveryChoice, UncommittedAction } from '../../shared/work'
import { Activity } from './Activity'
import { call } from './commands'
import { ConfirmDialog, UncommittedDialog } from './dialogs'
import { Diff, Markdown } from './Markdown'
import { PrPanel } from './PrPanel'
import { focusTerm } from './terminals'

type Tab = 'summary' | 'artifacts' | 'changes' | 'verdicts' | 'work' | 'knowledge'

interface Props {
  work: WorkView
  task: TaskView
  review: ReviewView | null
  onApproved: () => void
  /** 단계 선택 대화상자를 연다. node는 처음 고를 단계다 */
  onSelectStep: (node?: NodeName) => void
  /** 정리 세션 탭을 고른다 (7-5) */
  onShowCleanup: () => void
}

/** PR 패널을 보일 때인가: PR 진행을 시작한 Work의 지금 task(verify)를 보고 있다 (시나리오 10) */
export function showsPr(work: WorkView, taskId: string | undefined): boolean {
  return work.pr !== null && taskId === work.current
}

/**
 * 승인 화면을 보일 task인가: 에이전트가 턴을 끝냈고 handoff가 있다. 막힘은 따로 보인다.
 * verify에서 멈춘 Work의 verify도 Work 완료 화면이다 (D119)
 */
export function wantsApproval(review: ReviewView | null): boolean {
  if (review?.completion?.stopped) return true
  return (
    !!review && review.reviewable && review.handoffPresent && review.handoffStatus !== 'blocked'
  )
}

export function Panel({ work, task, review, onApproved, onSelectStep, onShowCleanup }: Props) {
  const recovery = (
    <Recovery key={work.key} work={work} onDone={onApproved} onShowCleanup={onShowCleanup} />
  )
  if (!review) {
    return (
      <div className="panel-body">
        {recovery}
        <div className="dim">불러오는 중…</div>
      </div>
    )
  }
  // 이전 단계 추천으로 멈췄으면 추천한 단계를 처음 고른다 (D23)
  const recommended = work.steps.find((c) => c.recommended && c.allowed)?.node
  return (
    <div className="panel-body">
      {recovery}
      {work.issue ? <IssueLine workKey={work.key} issue={work.issue} /> : null}
      <header className="panel-head">
        <span className="panel-title">{task.label}</span>
        <span className={`status s-${task.status}`}>{task.statusLabel}</span>
      </header>
      {work.stopNotice ? (
        <div className="notice stop">
          {work.stopNotice}
          {work.stopHint ? <div className="dim">{work.stopHint}</div> : null}
          {work.actions.selectStep ? (
            <div className="notice-actions">
              <button
                className={recommended ? 'primary' : ''}
                onClick={() => onSelectStep(recommended)}
              >
                단계 선택
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {task.status === 'discarded' ? (
        <div className="notice">
          폐기됨: 단계 선택으로 이후 입력에서 빠졌습니다. 파일과 기록은 남습니다.
        </div>
      ) : null}
      {(work.status === 'completed' || (work.status === 'archived' && work.completedAt)) &&
      task.id === work.current ? (
        <DoneNotice work={work} branch={review.completion?.branch ?? null} />
      ) : null}
      {work.status === 'abandoned' ? (
        <div className="notice">Work 포기. 산출물과 worktree는 남아 있습니다.</div>
      ) : null}
      {work.status === 'archived' ? (
        <div className="notice">
          보관됨: [Work 정리]로 worktree를 지웠습니다. 산출물과 기록은 남아 있습니다.
        </div>
      ) : null}
      {(work.status === 'active' || (work.status === 'pr' && task.node === 'respond')) &&
      task.id === work.current ? (
        <TaskNotice task={task} pr={work.status === 'pr'} />
      ) : null}
      {showsPr(work, task.id) && work.pr ? (
        <PrSection
          key={`${work.key}|${review.taskId}|${wantsApproval(review) ? 'approve' : ''}`}
          work={work}
          task={task}
          pr={work.pr}
          review={review}
          onApproved={onApproved}
        />
      ) : review.completion?.stopped ? (
        <Review
          key={`${review.workKey}|${review.taskId}|stopped`}
          review={review}
          work={work}
          onApproved={onApproved}
          onShowCleanup={onShowCleanup}
        />
      ) : task.status === 'approved' || task.status === 'discarded' ? (
        <Review review={review} readOnly />
      ) : review.handoffPresent && review.handoffStatus === 'blocked' ? (
        <Review review={review} readOnly />
      ) : wantsApproval(review) ? (
        <Review
          key={`${review.workKey}|${review.taskId}`}
          review={review}
          work={work}
          onApproved={onApproved}
          onShowCleanup={onShowCleanup}
        />
      ) : (
        <Progress review={review} task={task} />
      )}
    </div>
  )
}

/** 정리 세션을 띄울 엔진: 지금 task의 엔진이다 (main/work.ts startCleanup) */
function cleanupEngine(work: WorkView): string {
  return work.tasks.find((t) => t.id === work.current)?.engineLabel ?? 'Claude Code'
}

/**
 * 패널 맨 위의 알림 (시나리오 9, D121). 끊긴 작업은 무엇이 어디서 끊겼는지와 [다시 시도]·[무시]가 할 일을 보인다
 * (D123). 끊긴 전달의 [다시 시도]가 커밋 안 된 변경을 돌려주면 선택지를 보인다(7-5). 끝낸 고아 프로세스(D76)와
 * 앱 밖에서 바뀐 파일(D124)은 [확인]으로 닫는다
 */
function Recovery({
  work,
  onDone,
  onShowCleanup,
}: {
  work: WorkView
  onDone: () => void
  onShowCleanup: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ choice: DeliveryChoice; files: string[] } | null>(null)
  const op = work.operation

  const run = async <T extends { ok: boolean }>(label: string, fn: () => Promise<T>) => {
    setBusy(label)
    setError(null)
    const r = await call(fn)
    setBusy(null)
    return r
  }
  const done = (r: DeliverResult, choice: DeliveryChoice | null) => {
    if (r.ok) {
      setPending(null)
      onDone()
    } else if (r.uncommitted && choice) {
      setPending({ choice, files: r.uncommitted })
    } else {
      setError(r.error)
    }
  }
  const retry = async () => {
    const choice = op?.choice ?? null
    done(await run('다시 시도', () => window.relay.retryOperation(work.key)), choice)
  }
  const command = async (label: string, fn: () => Promise<CommandResult>) => {
    const r = await run(label, fn)
    if (!r.ok) setError(r.error)
  }
  const deliver = async (choice: DeliveryChoice, action: UncommittedAction, expect: string[]) =>
    done(
      await run(DELIVERY_BUTTON[choice], () =>
        window.relay.deliver(work.key, { choice, uncommitted: { action, expect } }),
      ),
      choice,
    )
  const openCleanup = async (choice: DeliveryChoice) => {
    const r = await run('AI 세션 열기', () => window.relay.openCleanup(work.key, choice))
    if (r.ok) {
      setPending(null)
      onShowCleanup()
    } else setError(r.error)
  }

  if (!op && !work.notices.length && !pending && !error) return null
  return (
    <div className="recovery">
      {op ? (
        <div className="notice fail" role="alert" aria-label="끊긴 작업">
          <strong>{op.title}</strong>
          <ul>
            {op.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <div className="dim">{op.retry}</div>
          <div className="dim">{op.ignore}</div>
          <div className="notice-actions">
            <button className="primary" disabled={!!busy} onClick={() => void retry()}>
              다시 시도
            </button>
            <button
              disabled={!!busy}
              onClick={() => void command('무시', () => window.relay.ignoreOperation(work.key))}
            >
              무시
            </button>
            {busy ? <span className="dim">{busy}: 하는 중…</span> : null}
          </div>
        </div>
      ) : null}
      {work.notices.map((n) => (
        <div key={n.id} className="notice" aria-label={n.title}>
          <strong>{n.title}</strong>
          <ul>
            {n.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <div className="dim">{n.hint}</div>
          <div className="notice-actions">
            <button
              disabled={!!busy}
              onClick={() => void command('확인', () => window.relay.dismissNotice(work.key, n.id))}
            >
              확인
            </button>
          </div>
        </div>
      ))}
      {error ? <div className="error">{error}</div> : null}
      {pending ? (
        <UncommittedDialog
          workId={work.workId}
          label={DELIVERY_BUTTON[pending.choice]}
          engine={cleanupEngine(work)}
          files={pending.files}
          busy={!!busy}
          onDiscard={() => void deliver(pending.choice, 'discard', pending.files)}
          onCommit={() => void deliver(pending.choice, 'commit', pending.files)}
          onSession={() => void openCleanup(pending.choice)}
          onClose={() => setPending(null)}
        />
      ) : null}
    </div>
  )
}

/**
 * 지금 task가 사람을 기다리는 까닭과 누를 수 있는 버튼 (시나리오 3-4, 3-5, 4.4, D18). PR 진행 중의 PR 대응 task는 [즉시
 * 중단]과 [재개]만 있다 (D182). 중단됨의 [재개]는 이어서 하라고 알리고, [세션 재개]는 입력을 기다린다 (D218). 앱이 꺼져
 * 끝난 세션은 그렇다고 보인다 (D219)
 */
function TaskNotice({ task, pr }: { task: TaskView; pr: boolean }) {
  if (task.status === 'queued') {
    return (
      <div className="notice">
        대기열: 살아 있는 세션이 세션 상한만큼 있어 기다립니다. 자리가 나면 자동으로 시작합니다.
      </div>
    )
  }
  if ((task.status === 'interrupted' || task.status === 'session_ended') && task.sessionUnknown) {
    return (
      <div className="notice">
        {task.status === 'interrupted' ? '중단됨. ' : 'handoff 없이 세션이 끝났습니다. '}
        대화 ID를 받지 못해 같은 대화를 다시 열 수 없습니다. [이 단계 새 세션으로 다시]로 이 단계를
        새로 시작하세요.
      </div>
    )
  }
  if (task.status === 'interrupted') {
    return (
      <div className="notice">
        {task.appEnded ? '앱이 꺼져 중단됐습니다. ' : '중단됨. '}
        {task.hasSession
          ? '[재개]하면 같은 대화를 다시 열고 하던 일을 이어서 하라고 알립니다.'
          : '세션을 띄우지 못했습니다. [재개]하면 이 단계를 새 세션으로 시작합니다.'}
      </div>
    )
  }
  if (task.status === 'session_ended') {
    return (
      <div className="notice">
        handoff 없이 세션이 끝났습니다. [세션 재개]하면 같은 대화를 다시 엽니다. 에이전트는 입력을
        기다리니 이어서 할 일을 터미널에 말하세요.
        {pr ? null : ' 처음부터 다시 하려면 [이 단계 새 세션으로 다시]를 누르세요.'}
      </div>
    )
  }
  if (task.status === 'awaiting_approval' && !task.live && task.appEnded) {
    return (
      <div className="notice">
        앱이 꺼지기 전에 산출물과 handoff를 다 썼습니다. 확인하고 승인하세요. 터미널의 옛 화면은
        앱이 꺼질 때까지의 기록입니다.
      </div>
    )
  }
  if (task.status === 'blocked' && !task.live && pr) {
    return (
      <div className="notice">
        막힘. 세션이 없습니다. [세션 재개]로 필요한 것을 주세요. 근본부터 다시 하려면 [머지 없이
        끝내기] 뒤 새 Work로 하세요 (D182).
      </div>
    )
  }
  if (task.status === 'blocked' && !task.live) {
    return (
      <div className="notice">
        막힘. 세션이 없습니다. [세션 재개]로 필요한 것을 주거나, [단계 선택]으로 다른 단계로 가거나,
        [Work 포기]하세요.
      </div>
    )
  }
  return null
}

/** 진행 중: 형식 되돌림 안내(D220), 경과 시간과 마지막 동작(D216), handoff 상태, 형식 오류, 산출물 목록 */
function Progress({ review, task }: { review: ReviewView; task: TaskView }) {
  return (
    <>
      {task.bounceNotice ? <div className="notice">{task.bounceNotice}</div> : null}
      {task.activity ? (
        <section className="progress">
          <h3>진행</h3>
          <Activity activity={task.activity} />
        </section>
      ) : null}
      <section>
        <h3>handoff</h3>
        <div>
          {review.handoffPresent
            ? `있음 (${review.handoffStatus ?? '상태 읽지 못함'})`
            : '아직 없음'}
        </div>
        {task.error ? <div className="error">{task.error}</div> : null}
      </section>
      <Issues review={review} />
      <section>
        <h3>산출물</h3>
        {review.artifacts.length ? (
          <ul>
            {review.artifacts.map((a) => (
              <li key={a.name}>{a.name}</li>
            ))}
          </ul>
        ) : (
          <div className="dim">아직 없음</div>
        )}
      </section>
    </>
  )
}

function Issues({ review }: { review: ReviewView }) {
  if (!review.errors.length && !review.warnings.length) return null
  return (
    <section>
      {review.errors.length ? (
        <>
          <h3>형식 오류</h3>
          <ul className="errors">
            {review.errors.map((e, i) => (
              <li key={i}>
                {e.file}: {e.message}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {review.warnings.length ? (
        <>
          <h3>경고</h3>
          <ul className="warnings">
            {review.warnings.map((e, i) => (
              <li key={i}>
                {e.file}: {e.message}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}

/** 승인 화면 (D83): 강조 영역, [요약]·[산출물]·[변경] 탭, 버튼. verify는 판정표와 전체 변경을 더한다 */
function Review({
  review,
  work,
  readOnly,
  onApproved,
  onShowCleanup,
}: {
  review: ReviewView
  work?: WorkView
  readOnly?: boolean
  onApproved?: () => void
  onShowCleanup?: () => void
}) {
  const verify = review.completion !== null
  const [tab, setTab] = useState<Tab>(verify ? 'verdicts' : 'summary')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  // 답하지 않은 열린 질문이 남은 채 [승인]하면 한 번 확인받는다 (D222)
  const [asking, setAsking] = useState(false)
  const questions = review.emphasis.find((e) => e.kind === 'open_questions')?.lines ?? []
  const liveTask = work?.tasks.find((t) => t.id === review.taskId && t.live)

  const intake = review.node === 'intake'
  const gate = review.gate
  const respond = review.respond
  // PR 대응은 승인하면 push하고 답글을 게시한다. 실패한 뒤의 [승인]은 [다시 시도]다 (시나리오 10-6)
  const approveLabel = intake ? '의도 승인' : respond?.failure ? '다시 시도' : '승인'
  // 끊긴 작업이 있는 동안은 승인하지 않는다 (D122)
  const cut = !!work?.operation
  // 자동 승인 카운트다운 (4.3, D83)
  const countdown = work?.tasks.find((t) => t.id === review.taskId)?.countdown ?? null

  const cancel = async () => {
    setBusy(true)
    setError(null)
    const r = await call(() => window.relay.cancelCountdown(review.workKey, review.taskId))
    setBusy(false)
    if (!r.ok) setError(r.error)
  }

  const approve = async (force: boolean) => {
    setBusy(true)
    setError(null)
    const r = await call(() =>
      window.relay.approve(review.workKey, review.taskId, force ? { force: true } : {}),
    )
    setBusy(false)
    setConfirming(false)
    setAsking(false)
    if (r.ok) onApproved?.()
    else setError(r.error)
  }

  const tabs: [Tab, string][] = [
    ...(verify ? ([['verdicts', '판정표']] as [Tab, string][]) : []),
    ['summary', '요약'],
    ['artifacts', '산출물'],
    ['changes', '변경'],
    ...(verify ? ([['work', '전체 변경']] as [Tab, string][]) : []),
    // 이 Work가 바꾼 지식 (D298). 지식 관리를 끄면 없다
    ...(review.completion?.knowledge
      ? ([['knowledge', `지식 ${review.completion.knowledge.length}`]] as [Tab, string][])
      : []),
  ]

  return (
    <div className="review">
      {review.emphasis.length ? (
        <section className="emphasis" aria-label="강조 영역">
          {review.emphasis.map((e, i) => (
            <div key={i} className={`em em-${e.kind}`}>
              <strong>{e.title}</strong>
              <ul>
                {e.lines.map((l, j) => (
                  <li key={j}>{l}</li>
                ))}
              </ul>
              {e.hint ? <div className="em-hint">{e.hint}</div> : null}
              {/* 터미널에 포커스만 준다. 글을 넣지 않는다 (D222, 1.2) */}
              {e.kind === 'open_questions' && liveTask && !readOnly ? (
                <div className="notice-actions">
                  <button onClick={() => focusTerm(liveTask.terminal)}>터미널에서 답하기</button>
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      <div className="review-tabs" role="tablist">
        {tabs.map(([id, name]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="review-body">
        {tab === 'summary' && respond ? <RespondSummary respond={respond} /> : null}
        {tab === 'summary' ? <Summary review={review} /> : null}
        {tab === 'artifacts' && respond ? <Replies respond={respond} /> : null}
        {tab === 'artifacts' ? (
          review.artifacts.length ? (
            review.artifacts.map((a) => (
              <section key={a.name}>
                <h3>{a.name}</h3>
                <Markdown text={a.text} />
              </section>
            ))
          ) : (
            <div className="dim">산출물 없음</div>
          )
        ) : null}
        {tab === 'changes' ? <Diff text={review.diff} /> : null}
        {tab === 'verdicts' && review.completion?.knowledge ? (
          <KnowledgeLine changes={review.completion.knowledge} onOpen={() => setTab('knowledge')} />
        ) : null}
        {tab === 'verdicts' && review.completion ? (
          <table className="verdicts">
            <thead>
              <tr>
                <th>완료조건</th>
                <th>판정</th>
                <th>근거</th>
              </tr>
            </thead>
            <tbody>
              {review.completion.verdicts.map((v, i) => (
                <tr key={i} className={v.warn ? 'warn' : ''}>
                  <td>{v.criterion}</td>
                  <td className={`verdict ${v.warn ? 'v-warn' : 'v-ok'}`}>{v.verdict}</td>
                  <td>{v.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {tab === 'work' && review.completion ? <Diff text={review.completion.diff} /> : null}
        {tab === 'knowledge' && review.completion?.knowledge ? (
          <KnowledgeList changes={review.completion.knowledge} />
        ) : null}
      </div>

      {/* 카운트다운, 까닭, 버튼 줄은 패널 아래에 붙여 둔다: 긴 diff가 밀어내지 않는다 (D224) */}
      <div className="review-bottom">
        {!readOnly && countdown ? (
          <Countdown countdown={countdown} busy={busy} onCancel={() => void cancel()} />
        ) : null}
        {!readOnly && review.autoApprove.hold ? (
          <div className="notice auto-hold">{review.autoApprove.hold}</div>
        ) : null}
        {readOnly ? null : review.completion && work ? (
          <CompletionActions
            review={review}
            work={work}
            questions={questions}
            live={!!liveTask}
            onApproved={onApproved}
            onShowCleanup={onShowCleanup}
            onForce={() => setConfirming(true)}
          />
        ) : (
          <footer className="review-actions">
            <button
              className="primary"
              disabled={busy || cut || !gate.approve || !!respond?.blocked}
              onClick={() => (questions.length ? setAsking(true) : void approve(false))}
            >
              {approveLabel}
            </button>
            {gate.force ? (
              <button className="danger" disabled={busy || cut} onClick={() => setConfirming(true)}>
                오류 무시하고 승인
              </button>
            ) : null}
            {!gate.approve && gate.blocking.length ? (
              <span className="error">
                {respond
                  ? 'replies.md의 오류는 넘길 수 없습니다: 터미널에서 고치게 하세요 (D204)'
                  : 'intent 초안의 머리글 오류는 넘길 수 없습니다 (D90)'}
              </span>
            ) : null}
            {respond?.blocked ? <span className="error">{respond.blocked}</span> : null}
            {respond ? (
              <span className="dim">
                승인하면 push하고 답글 {respond.replies.filter((r) => !r.url && !r.skipped).length}
                개를 게시합니다
                {respond.deferred.length
                  ? ` (미룬 앞 라운드 ${respond.deferred.join(', ')}와 함께, D193)`
                  : ''}
              </span>
            ) : null}
          </footer>
        )}
        {error ? <div className="error">{error}</div> : null}
      </div>
      {asking ? (
        <OpenQuestionsDialog
          questions={questions}
          live={!!liveTask}
          confirm={approveLabel}
          onConfirm={() => void approve(false)}
          onClose={() => setAsking(false)}
        />
      ) : null}
      {confirming ? (
        <ConfirmDialog
          title="오류 무시하고 승인"
          confirm="오류 무시하고 승인"
          onConfirm={() => void approve(true)}
          onClose={() => setConfirming(false)}
        >
          <p>
            아래 형식 오류를 두고 승인합니다. 무시한 오류는 work.json과 events.jsonl에 남습니다.
          </p>
          <ul className="errors">
            {gate.errors.map((e, i) => (
              <li key={i}>
                {e.file}: {e.message}
              </li>
            ))}
          </ul>
          {/* 열린 질문이 함께 남았으면 이 확인 창에서 같이 알린다 (D222) */}
          {questions.length ? (
            <>
              <p>
                답하지 않은 열린 질문 {questions.length}개도 있습니다: 에이전트는 가정으로
                진행합니다.
              </p>
              <ul>
                {questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </div>
  )
}

/**
 * 자동 승인 카운트다운과 [취소] (4.3, D83). 남은 초는 main이 보낸 끝나는 때로 센다. [취소]하면 사람의 승인을 기다린다.
 * 터미널에 새 요청을 보내도 멈춘다
 */
function Countdown({
  countdown,
  busy,
  onCancel,
}: {
  countdown: CountdownView
  busy: boolean
  onCancel: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])
  const left = Math.max(0, Math.ceil((countdown.endsAt - now) / 1000))
  return (
    <div className="countdown" role="status" aria-label="자동 승인 카운트다운">
      <span>{left > 0 ? `자동 승인까지 ${left}초` : '자동 승인하는 중…'}</span>
      <button disabled={busy} onClick={onCancel}>
        취소
      </button>
      <span className="dim">멈추려면 [취소]를 누르거나 터미널에 말하세요.</span>
    </div>
  )
}

function Summary({ review }: { review: ReviewView }) {
  const lead = review.lead
  return (
    <>
      {lead ? (
        <section className="lead">
          <h3>{lead.title}</h3>
          {lead.sections.map((s) => (
            <div key={s.title}>
              <h4>{s.title}</h4>
              <Markdown text={s.text} />
            </div>
          ))}
        </section>
      ) : null}
      <section>
        <h3>요약</h3>
        {review.summary ? <Markdown text={review.summary} /> : <div className="dim">없음</div>}
      </section>
      <section>
        <h3>결정</h3>
        {review.decisions.length ? (
          <ul>
            {review.decisions.map((d, i) => (
              <li key={i}>
                <span className={`by by-${d.by}`}>{d.by === 'human' ? '[사람]' : '[AI]'}</span>{' '}
                {d.what} <span className="dim">— {d.why}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="dim">없음</div>
        )}
      </section>
      <List title="가정" items={review.assumptions} />
      <List title="위험" items={review.risks} />
      <Issues review={review} />
    </>
  )
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3>{title}</h3>
      {items.length ? (
        <ul>
          {items.map((i, n) => (
            <li key={n}>{i}</li>
          ))}
        </ul>
      ) : (
        <div className="dim">없음</div>
      )}
    </section>
  )
}

const DELIVERY_BUTTON: Readonly<Record<DeliveryChoice, string>> = {
  push: 'push',
  pr: 'PR 생성',
}

/**
 * PR 진행인 Work의 오른쪽 패널: PR 패널과 지금 task를 탭으로 오간다 (시나리오 10, D183). 지금 task가 verify면 리뷰와 검증
 * 결과(읽기 전용)이고, PR 대응 task면 그 task다: 승인할 때는 승인 화면을 먼저 보이고, 도는 중이면 진행 상태를 보인다
 */
function PrSection({
  work,
  task,
  pr,
  review,
  onApproved,
}: {
  work: WorkView
  task: TaskView
  pr: PrView
  review: ReviewView
  onApproved: () => void
}) {
  const respond = review.respond !== null
  const approving = respond && work.status === 'pr' && wantsApproval(review)
  const [tab, setTab] = useState<'pr' | 'task'>(approving ? 'task' : 'pr')
  const body = !respond ? (
    <Review review={review} readOnly />
  ) : approving ? (
    <Review review={review} work={work} onApproved={onApproved} />
  ) : task.status === 'approved' ||
    (review.handoffPresent && review.handoffStatus === 'blocked') ||
    work.status !== 'pr' ? (
    <Review review={review} readOnly />
  ) : (
    <Progress review={review} task={task} />
  )
  return (
    <>
      <div className="review-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'pr'}
          className={tab === 'pr' ? 'active' : ''}
          onClick={() => setTab('pr')}
        >
          PR
        </button>
        <button
          role="tab"
          aria-selected={tab === 'task'}
          className={tab === 'task' ? 'active' : ''}
          onClick={() => setTab('task')}
        >
          {respond ? task.label : '리뷰와 검증 결과'}
        </button>
      </div>
      {tab === 'pr' ? <PrPanel work={work} pr={pr} /> : body}
    </>
  )
}

/** PR 대응 task의 [요약] 앞부분 (D172): 이번 라운드의 항목과 사람 지시, response.md의 항목별 결과 */
function RespondSummary({ respond }: { respond: NonNullable<ReviewView['respond']> }) {
  return (
    <>
      <section>
        <h3>라운드 {respond.round}의 항목</h3>
        {respond.items.length ? (
          <ul>
            {respond.items.map((i) => (
              <li key={i.id}>
                <span className="kind">{i.kindLabel}</span> {i.title}{' '}
                <span className="dim">({i.id})</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="dim">없음: 사람 지시만으로 시작한 라운드 (D182)</div>
        )}
      </section>
      {respond.instruction ? (
        <section>
          <h3>사람 지시</h3>
          <pre className="pr-item-text">{respond.instruction}</pre>
        </section>
      ) : null}
      <section>
        <h3>항목별 결과</h3>
        {respond.results ? (
          <Markdown text={respond.results} />
        ) : (
          <div className="dim">response.md의 항목별 결과가 없음</div>
        )}
      </section>
    </>
  )
}

/**
 * 게시될 모양의 답글 (D172, D207): 어디에 달리는지와 본문(원래 코멘트 링크, 초안, 표시 문구). 보이지 않는 표시는 빼고
 * 보인다. 게시했으면 링크를, 건너뛰었으면 까닭을 보인다 (D194, D205)
 */
function Replies({ respond }: { respond: NonNullable<ReviewView['respond']> }) {
  return (
    <section aria-label="게시될 답글">
      <h3>게시될 답글</h3>
      {respond.replies.length ? (
        respond.replies.map((r) => (
          <div key={r.item} className="reply-preview">
            <div className="pr-item-head">
              <span className="kind">{r.item}</span>
              <span className="dim">{r.where}</span>
              {r.url ? (
                <button
                  className="link"
                  onClick={() => void call(() => window.relay.openExternal(r.url ?? ''))}
                >
                  게시함
                </button>
              ) : null}
              {r.skipped ? <span className="dim">{r.skipped}</span> : null}
            </div>
            <Markdown text={r.body} />
          </div>
        ))
      ) : (
        <div className="dim">이번 라운드에 코멘트 항목이 없어 답글이 없음</div>
      )}
    </section>
  )
}

const MERGE_LABEL: Readonly<Record<string, string>> = {
  merge: 'merge',
  squash: 'squash',
  rebase: 'rebase',
}

/** 완료한 Work의 전달과 결과 링크 (시나리오 7-4, 7-6). PR 진행으로 끝났으면 머지나 끝낸 것을 보인다 (D178, D179) */
function DoneNotice({ work, branch }: { work: WorkView; branch: BranchInfo | null }) {
  const d = work.delivery?.status === 'succeeded' ? work.delivery : null
  const pr = work.pr
  // 밖에서 머지될 때 승인했지만 push·게시를 미룬 라운드(D193)는 머지에 들어가지 않았다
  const lost = pr?.merged ? pr.rounds.filter((r) => r.state === 'deferred') : []
  return (
    <div className="notice done">
      Work 완료 (전달: {d ? d.label : '완료만'})
      {branch ? <BranchLine work={work} branch={branch} /> : null}
      {pr?.merged ? (
        <div>
          PR #{pr.number} 머지됨 (
          {pr.merged.outside
            ? 'relay 밖에서'
            : pr.merged.method
              ? MERGE_LABEL[pr.merged.method]
              : ''}
          , head {pr.merged.head.slice(0, 8)}).
          {work.status === 'completed' ? ' [Work 정리]로 정리하세요.' : ''}
        </div>
      ) : null}
      {lost.length ? (
        <div className="error">
          승인했지만 push·게시하지 못한 대응 라운드 {lost.length}개(
          {lost.map((r) => r.label).join(', ')})는 머지에 들어가지 않았습니다. 그 커밋은 작업
          브랜치에만 있고 답글은 게시하지 않았습니다 (D193).
        </div>
      ) : null}
      {pr?.ended ? (
        <div>
          PR #{pr.number}을(를) 머지 없이 끝냄 ({pr.ended}). GitHub의 PR은 건드리지 않았습니다.
        </div>
      ) : null}
      {d?.branch ? <div className="dim">origin에 push: {d.branch}</div> : null}
      {d?.prUrl ? (
        <LinkLine
          label={d.prExisting ? '이미 열린 PR' : d.draft ? 'draft PR' : 'PR'}
          url={d.prUrl}
        />
      ) : null}
      {d?.choice === 'push' ? (
        d.compareUrl ? (
          <LinkLine label="비교 URL (브라우저에서 PR 만들기)" url={d.compareUrl} />
        ) : (
          <div className="dim">origin 주소를 GitHub 레포로 읽지 못해 비교 URL이 없습니다</div>
        )
      ) : null}
    </div>
  )
}

/**
 * 작업 브랜치와 기준 뒤 커밋, 마지막 커밋, worktree (D225): 끝났을 때 어디에 무엇이 남았는지 보인다.
 * 예: "작업 브랜치 relay/w-20260930-001: 기준(main 3943005e) 뒤 커밋 2개, 마지막 1a2b3c4d fix: 빈 배열의 평균은 0"
 */
function BranchLine({ work, branch }: { work: WorkView; branch: BranchInfo }) {
  const base = `${work.baseBranch} ${work.baseCommit.slice(0, 8)}`
  return (
    <div className="branch-line dim">
      <div>
        작업 브랜치 <code>{branch.name}</code>: 기준({base}) 뒤 커밋 {branch.ahead}개
        {branch.last ? (
          <>
            , 마지막 <code>{branch.last.sha}</code> {branch.last.subject}
          </>
        ) : null}
      </div>
      {branch.worktree ? (
        <div>
          worktree: <code>{branch.worktree}</code>
        </div>
      ) : null}
    </div>
  )
}

/**
 * 이슈 기록 (설계 3.7, D344): 이슈 링크, 남은 게시, 마지막 실패와 [다시 시도]. 게시가 실패해도 흐름은 막지 않으므로 알림만
 * 보인다
 */
function IssueLine({ workKey, issue }: { workKey: string; issue: IssueView }) {
  const [error, setError] = useState<string | null>(null)
  const retry = async () => {
    setError(null)
    const r = await call(() => window.relay.issueRetry(workKey))
    if (!r.ok) setError(r.error)
  }
  const name =
    issue.number === null
      ? '이슈: 의도를 승인하면 만듭니다'
      : `이슈 #${issue.number}${issue.linked ? ' (기존 이슈)' : ''}${issue.closed ? ' · 닫힘' : ''}`
  return (
    <div className={issue.failure ? 'notice fail' : 'issue-line dim'} aria-label="이슈 기록">
      <span>{name}</span>
      {issue.pending ? (
        <span>
          {' '}
          · 남은 게시 {issue.pending}
          {issue.publishing ? ' (게시하는 중…)' : ''}
        </span>
      ) : null}{' '}
      {issue.url ? (
        <button onClick={() => void call(() => window.relay.openExternal(issue.url ?? ''))}>
          브라우저에서 열기
        </button>
      ) : null}
      {issue.failure ? (
        <>
          <div>게시 실패: {issue.failure.error}</div>
          <div className="dim">작업은 그대로 진행됩니다. 다음 승인 때도 앞부터 다시 올립니다.</div>
          <div className="notice-actions">
            <button className="primary" disabled={issue.publishing} onClick={() => void retry()}>
              다시 시도
            </button>
          </div>
        </>
      ) : null}
      {error ? <div className="error">{error}</div> : null}
    </div>
  )
}

function LinkLine({ label, url }: { label: string; url: string }) {
  return (
    <div className="link-line">
      <span>{label}:</span> <code>{url}</code>{' '}
      <button onClick={() => void call(() => window.relay.openExternal(url))}>
        브라우저에서 열기
      </button>
    </div>
  )
}

/**
 * Work 완료 화면의 버튼 (시나리오 7-3~7-6, D119, D120).
 * - 승인하면 Work가 멈추는 verify(이전 단계 추천, [이 단계 끝나면 멈춤]): [승인하고 멈춤] 하나. 전달은 멈춘 뒤 고른다
 * - 전달 선택: [완료만], [push], [PR 생성]. 누를 수 없으면 이유와 [다시 점검](D118)
 * - 커밋 안 된 변경이 있으면 세 선택지(7-5). 정리 세션이 있으면 [정리 끝 → push/PR 진행]
 * - 정리 세션의 안내와 [정리 세션 닫기]는 어느 쪽이든 보인다. 정리 세션이 열린 동안에도 받는 [이 단계 끝나면 멈춤]으로
 *   [승인하고 멈춤]이 되어도 세션을 끝낼 수 있다 (D137). 정리 세션이 열린 동안은 승인하지 않고, 멈추는 동안은
 *   전달하지 않는다
 * - 마지막 전달이 실패했으면 오류와 [다시 시도]·[전달 없이 완료]
 * verify에서 멈춘 Work는 verify가 이미 승인돼 [완료만]이 멈춘 Work의 [재개]다.
 */
function CompletionActions({
  review,
  work,
  questions,
  live,
  onApproved,
  onShowCleanup,
  onForce,
}: {
  review: ReviewView
  work: WorkView
  /** 답하지 않은 열린 질문 (D222) */
  questions: readonly string[]
  /** 리뷰와 검증의 세션이 살아 있다 */
  live: boolean
  onApproved: (() => void) | undefined
  onShowCleanup: (() => void) | undefined
  onForce: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 답하지 않은 열린 질문이 남은 채 완료하거나 전달하면 한 번 확인받는다 (D222). 누른 버튼과 할 일을 둔다
  const [asking, setAsking] = useState<{ label: string; go: () => void } | null>(null)
  // 커밋 안 된 변경이 있어 고를 것 (7-5)
  const [pending, setPending] = useState<{ choice: DeliveryChoice; files: string[] } | null>(null)
  const c = review.completion
  if (!c) return null
  const gate = review.gate
  const stopped = c.stopped
  // 끊긴 작업이 있는 동안은 완료도 전달도 하지 않는다 (D122)
  const cut = work.operation !== null
  const ready = (stopped || gate.approve) && !cut
  const cleanup = work.cleanup
  const open = cleanup !== null && cleanup.status !== 'ended'

  const run = async <T extends { ok: boolean }>(label: string, fn: () => Promise<T>) => {
    setBusy(label)
    setError(null)
    const r = await call(fn)
    setBusy(null)
    return r
  }
  const done = (r: DeliverResult, choice?: DeliveryChoice) => {
    if (r.ok) {
      setPending(null)
      onApproved?.()
    } else if (r.uncommitted && choice) {
      setPending({ choice, files: r.uncommitted })
    } else {
      setError(r.error)
    }
  }
  /** [완료만]과 [전달 없이 완료]: 전달 없이 완료한다. 멈춘 Work는 [재개]다 */
  const complete = async () =>
    done(
      await run('완료만', () =>
        stopped
          ? window.relay.resumeWork(work.key)
          : window.relay.approve(work.key, review.taskId, {}),
      ),
    )
  const deliver = async (
    choice: DeliveryChoice,
    uncommitted: { action: UncommittedAction; expect: string[] } | null,
  ) =>
    done(
      await run(DELIVERY_BUTTON[choice], () =>
        window.relay.deliver(work.key, { choice, uncommitted }),
      ),
      choice,
    )
  const openCleanup = async (choice: DeliveryChoice) => {
    const r = await run('AI 세션 열기', () => window.relay.openCleanup(work.key, choice))
    if (r.ok) {
      setPending(null)
      onShowCleanup?.()
    } else setError(r.error)
  }
  const finishCleanup = async () =>
    done(await run('정리 끝', () => window.relay.finishCleanup(work.key)), cleanup?.choice)
  /** [정리 세션 닫기] (D137): 전달하지 않고 세션만 끝낸다 */
  const closeCleanup = async () => {
    const r = await run('정리 세션 닫기', () => window.relay.closeCleanup(work.key))
    if (!r.ok) setError(r.error)
  }
  const recheck = async () => {
    const r = await run('다시 점검', () => window.relay.recheck(work.key))
    if (!r.ok) setError(r.error)
  }

  /** 열린 질문이 있으면 확인 창을 거쳐 한다 */
  const ask = (label: string, go: () => void) => () =>
    questions.length ? setAsking({ label, go }) : go()
  const askingDialog = asking ? (
    <OpenQuestionsDialog
      questions={questions}
      live={live}
      confirm={asking.label}
      onConfirm={() => {
        setAsking(null)
        asking.go()
      }}
      onClose={() => setAsking(null)}
    />
  ) : null

  // 승인하면 Work가 멈추는 동안은 전달하지 않는다(main의 deliveryStart도 거부). 전달로 잇는 버튼을 끈다
  const stopping = c.mode === 'stop'
  const cleanupNotice = cleanup ? (
    <div className="notice">
      {cleanup.status === 'queued'
        ? '정리 세션: 세션 상한 때문에 대기열에서 기다립니다. 자리가 나면 엽니다.'
        : cleanup.status === 'live'
          ? stopping
            ? '정리 세션이 열려 있습니다(기록하지 않음). 승인하면 Work가 멈추므로 지금은 전달하지 않습니다. 정리가 끝나면 [정리 세션 닫기]로 세션을 끝낸 뒤 승인하세요.'
            : '정리 세션이 열려 있습니다(기록하지 않음). push와 PR, 단계 선택과 재개는 막혀 있습니다. 정리가 끝나면 누르세요. 전달하지 않고 그만두려면 [정리 세션 닫기]를 누르세요.'
          : cleanup.uncommitted.length
            ? `정리 세션이 끝났지만 커밋 안 된 변경 ${cleanup.uncommitted.length}개가 남았습니다.`
            : '정리 세션이 끝났습니다.'}
      <div className="notice-actions">
        {cleanup.status !== 'ended' ? (
          <>
            <button onClick={onShowCleanup}>정리 세션 보기</button>
            <button
              className={cleanup.clean && !stopping ? 'primary ready' : ''}
              disabled={!!busy || stopping}
              title={stopping ? '승인하면 Work가 멈추는 동안은 전달하지 않습니다' : ''}
              onClick={() => void finishCleanup()}
            >
              정리 끝 → push/PR 진행
            </button>
            <button disabled={!!busy} onClick={() => void closeCleanup()}>
              정리 세션 닫기
            </button>
            {cleanup.clean ? <span className="dim">git status가 깨끗합니다</span> : null}
          </>
        ) : cleanup.uncommitted.length && !stopping ? (
          <button
            onClick={() => setPending({ choice: cleanup.choice, files: cleanup.uncommitted })}
          >
            선택지 보기
          </button>
        ) : null}
      </div>
    </div>
  ) : null

  if (stopping) {
    return (
      <div className="completion-actions">
        <footer className="review-actions">
          <button
            className="primary"
            disabled={!!busy || open || cut || !gate.approve}
            onClick={ask('승인하고 멈춤', () => void complete())}
          >
            승인하고 멈춤
          </button>
          {gate.force ? (
            <button className="danger" disabled={!!busy || open || cut} onClick={onForce}>
              오류 무시하고 승인
            </button>
          ) : null}
          <span className="dim">승인하면 Work가 멈춥니다. 전달은 멈춘 뒤 고릅니다.</span>
          {error ? <span className="error">{error}</span> : null}
        </footer>
        {cleanupNotice}
        {askingDialog}
      </div>
    )
  }
  if (c.mode !== 'deliver') return null

  const failed = c.delivery?.status === 'failed' ? c.delivery : null
  const blocked = (['push', 'pr'] as const).filter((k) => !c.buttons[k].enabled)
  const button = (choice: DeliveryChoice) => (
    <button
      disabled={!!busy || open || !ready || !c.buttons[choice].enabled}
      title={c.buttons[choice].reason ?? ''}
      onClick={ask(DELIVERY_BUTTON[choice], () => void deliver(choice, null))}
    >
      {DELIVERY_BUTTON[choice]}
    </button>
  )
  return (
    <div className="completion-actions">
      {/* 전달을 고르기 전에 작업 브랜치에 무엇이 남았는지 보인다 (D225) */}
      {c.branch ? <BranchLine work={work} branch={c.branch} /> : null}
      <footer className="review-actions">
        <button
          className="primary"
          disabled={!!busy || open || !ready}
          onClick={ask('완료만', () => void complete())}
        >
          완료만
        </button>
        {button('push')}
        {button('pr')}
        {!stopped && gate.force ? (
          <button className="danger" disabled={!!busy || open || cut} onClick={onForce}>
            오류 무시하고 승인
          </button>
        ) : null}
        {busy ? <span className="dim">{busy}: 하는 중…</span> : null}
      </footer>
      {blocked.length ? (
        <div className="dim">
          {blocked.map((k) => (
            <div key={k}>
              [{DELIVERY_BUTTON[k]}]: {c.buttons[k].reason}
            </div>
          ))}
          <button disabled={!!busy} onClick={() => void recheck()}>
            다시 점검
          </button>
        </div>
      ) : null}
      {failed ? (
        <div className="notice fail">
          전달 실패 ([{failed.label}], {failed.stage ?? '알 수 없는 단계'}): {failed.error}
          <div className="notice-actions">
            <button
              className="primary"
              disabled={!!busy || open || cut}
              onClick={() => void deliver(failed.choice, null)}
            >
              다시 시도
            </button>
            <button disabled={!!busy || open || !ready} onClick={() => void complete()}>
              전달 없이 완료
            </button>
          </div>
        </div>
      ) : null}
      {cleanupNotice}
      {error ? <div className="error">{error}</div> : null}
      {pending ? (
        <UncommittedDialog
          workId={work.workId}
          label={DELIVERY_BUTTON[pending.choice]}
          engine={cleanupEngine(work)}
          files={pending.files}
          busy={!!busy}
          onDiscard={() =>
            void deliver(pending.choice, { action: 'discard', expect: pending.files })
          }
          onCommit={() => void deliver(pending.choice, { action: 'commit', expect: pending.files })}
          onSession={() => void openCleanup(pending.choice)}
          onClose={() => setPending(null)}
        />
      ) : null}
      {askingDialog}
    </div>
  )
}

/**
 * 답하지 않은 열린 질문을 두고 승인하거나 전달할 때의 확인 창 (D222). 세션이 없으면 [세션 재개]를 먼저 누르라고 한다
 */
function OpenQuestionsDialog({
  questions,
  live,
  confirm,
  onConfirm,
  onClose,
}: {
  questions: readonly string[]
  live: boolean
  confirm: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <ConfirmDialog
      title="답하지 않은 열린 질문"
      confirm={confirm}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <p>답하지 않은 열린 질문 {questions.length}개: 에이전트는 가정으로 진행합니다.</p>
      <ul>
        {questions.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>
      <p className="dim">
        {live
          ? '답하려면 [취소]하고 가운데 터미널에 쓰세요.'
          : '답하려면 [취소]하고 [세션 재개]를 누른 뒤 가운데 터미널에 쓰세요.'}
      </p>
    </ConfirmDialog>
  )
}

const CHANGE_LABEL: Record<KnowledgeChange['change'], string> = {
  added: '새로 만듦',
  updated: '고침',
  removed: '지움',
}

/** Work 완료 화면 [판정표] 위의 한 줄: 이 Work가 바꾼 지식의 수 (D298) */
function KnowledgeLine({ changes, onOpen }: { changes: KnowledgeChange[]; onOpen: () => void }) {
  const count = (c: KnowledgeChange['change']) => changes.filter((k) => k.change === c).length
  return (
    <div className="knowledge-line">
      이 Work의 지식:{' '}
      {changes.length
        ? (['added', 'updated', 'removed'] as const)
            .filter((c) => count(c))
            .map((c) => `${CHANGE_LABEL[c]} ${count(c)}`)
            .join(' · ')
        : '바꾼 것 없음'}{' '}
      {changes.length ? (
        <button className="link" onClick={onOpen}>
          보기
        </button>
      ) : null}
    </div>
  )
}

/** [지식] 탭: 이 Work가 새로 만들거나 고치거나 지운 지식 파일. 누르면 그 파일의 diff (D298) */
function KnowledgeList({ changes }: { changes: KnowledgeChange[] }) {
  const [open, setOpen] = useState<string | null>(null)
  if (!changes.length) return <div className="empty-note">이 Work가 바꾼 지식 없음</div>
  return (
    <ul className="knowledge-list">
      {changes.map((k) => (
        <li key={k.path} className={`k-${k.change}`}>
          <button
            className="k-row"
            aria-expanded={open === k.path}
            onClick={() => setOpen(open === k.path ? null : k.path)}
          >
            <span className="k-change">{CHANGE_LABEL[k.change]}</span>
            <span className="k-title">{k.title ?? k.path}</span>
            {k.kind ? <span className="k-kind">{k.kind}</span> : null}
          </button>
          <div className="k-path">
            {k.path}
            {k.pendingFrom ? ` (머지 전 Work ${k.pendingFrom}의 항목을 고침)` : ''}
          </div>
          {k.note ? <div className="k-note">{k.note}</div> : null}
          {open === k.path ? <Diff text={k.diff} /> : null}
        </li>
      ))}
    </ul>
  )
}
