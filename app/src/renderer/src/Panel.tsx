// 오른쪽 패널 (D79, D83). handoff 상태와 형식 오류, 산출물 목록을 보이고,
// 승인할 수 있으면 넓어져 승인 화면이 된다. verify의 승인 화면은 Work 완료 화면이다 (시나리오 7-3).
import { useState } from 'react'
import type { Size } from '../../shared/contracts'
import type { ReviewView, TaskView, WorkView } from '../../shared/views'
import { ConfirmDialog } from './dialogs'
import { Diff, Markdown } from './Markdown'

type Tab = 'summary' | 'artifacts' | 'changes' | 'verdicts' | 'work'

const SIZES: Size[] = ['S', 'M', 'L']

interface Props {
  work: WorkView
  task: TaskView
  review: ReviewView | null
  onApproved: () => void
}

/** 승인 화면을 보일 task인가: 에이전트가 턴을 끝냈고 handoff가 있다. 막힘은 따로 보인다 */
export function wantsApproval(review: ReviewView | null): boolean {
  return (
    !!review && review.reviewable && review.handoffPresent && review.handoffStatus !== 'blocked'
  )
}

export function Panel({ work, task, review, onApproved }: Props) {
  if (!review) return <div className="panel-body dim">불러오는 중…</div>
  return (
    <div className="panel-body">
      <header className="panel-head">
        <span className="panel-title">{task.label}</span>
        <span className={`status s-${task.status}`}>{task.statusLabel}</span>
      </header>
      {work.stopNotice ? (
        <div className="notice stop">
          {work.stopNotice}
          <div className="dim">단계 선택은 아직 없습니다(M4). 필요하면 새 Work를 만드세요.</div>
        </div>
      ) : null}
      {work.status === 'completed' && task.id === work.current ? (
        <div className="notice done">Work 완료 (전달: 완료만)</div>
      ) : null}
      {task.status === 'approved' ? (
        <Review review={review} readOnly />
      ) : review.handoffPresent && review.handoffStatus === 'blocked' ? (
        <Review review={review} readOnly />
      ) : wantsApproval(review) ? (
        <Review
          key={`${review.workKey}|${review.taskId}`}
          review={review}
          onApproved={onApproved}
        />
      ) : (
        <Progress review={review} task={task} />
      )}
    </div>
  )
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
  readOnly,
  onApproved,
}: {
  review: ReviewView
  readOnly?: boolean
  onApproved?: () => void
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
  const approveLabel = intake ? '의도 승인' : verify ? '완료만' : '승인'

  const approve = async (force: boolean) => {
    setBusy(true)
    setError(null)
    const r = await window.relay.approve(review.workKey, review.taskId, {
      ...(intake && size ? { size } : {}),
      ...(force ? { force: true } : {}),
    })
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

      {readOnly ? null : (
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
          {verify ? <span className="dim">전달: push와 PR은 M5에서 넣습니다</span> : null}
          <button
            className="primary"
            disabled={busy || !gate.approve}
            onClick={() => void approve(false)}
          >
            {approveLabel}
          </button>
          {gate.force ? (
            <button className="danger" disabled={busy} onClick={() => setConfirming(true)}>
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
