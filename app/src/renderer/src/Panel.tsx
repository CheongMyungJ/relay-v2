// 오른쪽 패널 (D79, D83). handoff 상태와 형식 오류, 산출물 목록을 보이고,
// 승인할 수 있으면 넓어져 승인 화면이 된다. verify의 승인 화면은 Work 완료 화면이다 (시나리오 7-3):
// 전달 선택([완료만], [push], [PR 생성]), 커밋 안 된 변경의 선택지(7-5), 전달 실패의 [다시 시도]·
// [전달 없이 완료](7-6, D120). verify에서 멈춘 Work도 이 화면에서 전달을 고른다 (D119).
// 맨 위에는 재시작 때와 실행 중의 알림을 보인다: 끊긴 작업의 [다시 시도]·[무시], 끝낸 고아 프로세스와 바뀐
// 파일의 [확인] (시나리오 9, D121~D124). 끊긴 작업이 있는 동안 승인과 전달 버튼은 누를 수 없다 (D122).
// 자동 승인 중이면 승인 화면에 카운트다운과 [취소]를 보이고, 켜진 단계인데 카운트다운하지 않으면 까닭을 보인다 (D83, 4.3).
// PR 진행인 Work의 지금 task(verify)에서는 PR 패널이 된다 (시나리오 10, D183). 최종 검증 결과는 탭으로 본다.
import { useEffect, useState } from 'react'
import type { NodeName, Size } from '../../shared/contracts'
import type {
  CommandResult,
  CountdownView,
  DeliverResult,
  PrView,
  ReviewView,
  TaskView,
  WorkView,
} from '../../shared/views'
import type { DeliveryChoice, UncommittedAction } from '../../shared/work'
import { call } from './commands'
import { ConfirmDialog, UncommittedDialog } from './dialogs'
import { Diff, Markdown } from './Markdown'
import { PrPanel } from './PrPanel'

type Tab = 'summary' | 'artifacts' | 'changes' | 'verdicts' | 'work'

const SIZES: Size[] = ['S', 'M', 'L']

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
        <DoneNotice work={work} />
      ) : null}
      {work.status === 'abandoned' ? (
        <div className="notice">Work 포기. 산출물과 worktree는 남아 있습니다.</div>
      ) : null}
      {work.status === 'archived' ? (
        <div className="notice">
          보관됨: [Work 정리]로 worktree를 지웠습니다. 산출물과 기록은 남아 있습니다.
        </div>
      ) : null}
      {work.status === 'active' && task.id === work.current ? <TaskNotice task={task} /> : null}
      {showsPr(work, task.id) && work.pr ? (
        <PrSection key={work.key} work={work} pr={work.pr} review={review} />
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

/** 지금 task가 사람을 기다리는 까닭과 누를 수 있는 버튼 (시나리오 3-4, 3-5, 4.4, D18) */
function TaskNotice({ task }: { task: TaskView }) {
  if (task.status === 'queued') {
    return (
      <div className="notice">
        대기열: 살아 있는 세션이 세션 상한만큼 있어 기다립니다. 자리가 나면 자동으로 시작합니다.
      </div>
    )
  }
  if (task.status === 'interrupted') {
    return <div className="notice">중단됨. [재개]하면 이어서 합니다.</div>
  }
  if (task.status === 'session_ended') {
    return (
      <div className="notice">
        handoff 없이 세션이 끝났습니다. [세션 재개]로 대화를 잇거나 [이 단계 새 세션으로 다시]
        시작하세요.
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

/** 진행 중: handoff 상태, 형식 오류, 산출물 목록 */
function Progress({ review, task }: { review: ReviewView; task: TaskView }) {
  return (
    <>
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
  // 사람이 고르기 전에는 intent 초안의 size를 따른다 (4.1)
  const [chosen, setChosen] = useState<Size | null | undefined>(undefined)
  const size = chosen === undefined ? review.draftSize : chosen
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const intake = review.node === 'intake'
  const gate = review.gates[intake ? (size ?? 'none') : 'none']
  const approveLabel = intake ? '의도 승인' : '승인'
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
      window.relay.approve(review.workKey, review.taskId, {
        ...(intake && size ? { size } : {}),
        ...(force ? { force: true } : {}),
      }),
    )
    setBusy(false)
    setConfirming(false)
    if (r.ok) onApproved?.()
    else setError(r.error)
  }

  const tabs: [Tab, string][] = [
    ...(verify ? ([['verdicts', '판정표']] as [Tab, string][]) : []),
    ['summary', '요약'],
    ['artifacts', '산출물'],
    ['changes', '변경'],
    ...(verify ? ([['work', '전체 변경']] as [Tab, string][]) : []),
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
        {tab === 'summary' ? <Summary review={review} /> : null}
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
                  <td>{v.verdict}</td>
                  <td>{v.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {tab === 'work' && review.completion ? <Diff text={review.completion.diff} /> : null}
      </div>

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
          onApproved={onApproved}
          onShowCleanup={onShowCleanup}
          onForce={() => setConfirming(true)}
        />
      ) : (
        <footer className="review-actions">
          {intake ? (
            <label className="size">
              size
              <select
                aria-label="size"
                value={size ?? ''}
                onChange={(e) => setChosen((e.target.value || null) as Size | null)}
              >
                {size === null ? <option value="">고르세요</option> : null}
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            className="primary"
            disabled={busy || cut || !gate.approve}
            onClick={() => void approve(false)}
          >
            {approveLabel}
          </button>
          {gate.force ? (
            <button className="danger" disabled={busy || cut} onClick={() => setConfirming(true)}>
              오류 무시하고 승인
            </button>
          ) : null}
          {!gate.approve && gate.blocking.length ? (
            <span className="error">intent 초안의 머리글 오류는 넘길 수 없습니다 (D90)</span>
          ) : null}
        </footer>
      )}
      {error ? <div className="error">{error}</div> : null}
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
  return (
    <>
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
 * PR 진행인 Work의 오른쪽 패널: PR 패널과 최종 검증 결과(읽기 전용)를 탭으로 오간다 (시나리오 10, D183)
 */
function PrSection({ work, pr, review }: { work: WorkView; pr: PrView; review: ReviewView }) {
  const [tab, setTab] = useState<'pr' | 'verify'>('pr')
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
          aria-selected={tab === 'verify'}
          className={tab === 'verify' ? 'active' : ''}
          onClick={() => setTab('verify')}
        >
          최종 검증 결과
        </button>
      </div>
      {tab === 'pr' ? <PrPanel work={work} pr={pr} /> : <Review review={review} readOnly />}
    </>
  )
}

const MERGE_LABEL: Readonly<Record<string, string>> = {
  merge: 'merge',
  squash: 'squash',
  rebase: 'rebase',
}

/** 완료한 Work의 전달과 결과 링크 (시나리오 7-4, 7-6). PR 진행으로 끝났으면 머지나 끝낸 것을 보인다 (D178, D179) */
function DoneNotice({ work }: { work: WorkView }) {
  const d = work.delivery?.status === 'succeeded' ? work.delivery : null
  const pr = work.pr
  return (
    <div className="notice done">
      Work 완료 (전달: {d ? d.label : '완료만'})
      {pr?.merged ? (
        <div>
          PR #{pr.number} 머지됨 (
          {pr.merged.outside
            ? 'relay 밖에서'
            : pr.merged.method
              ? MERGE_LABEL[pr.merged.method]
              : ''}
          , head {pr.merged.head.slice(0, 8)}). [Work 정리]로 정리하세요.
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
  onApproved,
  onShowCleanup,
  onForce,
}: {
  review: ReviewView
  work: WorkView
  onApproved: (() => void) | undefined
  onShowCleanup: (() => void) | undefined
  onForce: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 커밋 안 된 변경이 있어 고를 것 (7-5)
  const [pending, setPending] = useState<{ choice: DeliveryChoice; files: string[] } | null>(null)
  const c = review.completion
  if (!c) return null
  const gate = review.gates.none
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
            onClick={() => void complete()}
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
      onClick={() => void deliver(choice, null)}
    >
      {DELIVERY_BUTTON[choice]}
    </button>
  )
  return (
    <div className="completion-actions">
      <footer className="review-actions">
        <button
          className="primary"
          disabled={!!busy || open || !ready}
          onClick={() => void complete()}
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
    </div>
  )
}
