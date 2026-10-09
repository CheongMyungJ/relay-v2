// 요구사항 추출의 진행 상자 (requirements-extraction-flow.md 15.5, 17.12, 결정 7, 41, 98). extract task는 터미널이 없으므로
// 패널 맨 위에 run 진행(쓴 run/상한, 단위), 지금 run과 도구, 멈춘 까닭을 보이고 사람 결정 필요에 답하는 양식을 둔다.
// 답은 반영 대기로 두었다가 루프가 다음 run을 띄우기 전에(멈췄으면 [재개] 뒤에) revision으로 만든다.
import { useState } from 'react'
import type { RequirementsDecisionView, RequirementsView } from '../../shared/views'
import { call } from './commands'

export function RequirementsBox({ workKey, req }: { workKey: string; req: RequirementsView }) {
  const { units, current } = req
  return (
    <div
      className={req.halt ? 'requirements-box notice' : 'requirements-box'}
      aria-label="요구사항 추출"
    >
      <div>
        run {req.runsUsed}/{req.runLimit} · 단위 끝남 {units.done} · 남음 {units.open}
        {units.stopped ? ` · 멈춘 단위 ${units.stopped}` : ''}
      </div>
      {current ? (
        <div className="dim">
          {current.run} 도는 중: {current.unit} {current.purpose}
          {current.tool ? ` · ${current.tool}` : ''}
        </div>
      ) : null}
      {req.usageWait ? (
        <div className="dim">사용량 한도: {req.usageWait}까지 기다렸다 같은 단위부터 잇습니다</div>
      ) : null}
      {req.halt ? (
        <div>
          멈춤: {req.halt.label}
          {req.halt.detail ? <div className="dim">{req.halt.detail}</div> : null}
          {req.halt.reason === 'run_limit' ? <Extend workKey={workKey} /> : null}
        </div>
      ) : null}
      {req.decisions.length ? <DecisionForm workKey={workKey} decisions={req.decisions} /> : null}
    </div>
  )
}

/** 늘리는 run 수 ([계속 +N], 결정 26, 99). [범위 줄이고 계속]과 [부분 분석으로 넘기기]는 다음 PR이다 */
const EXTEND_RUNS = 20

/** run 상한으로 멈췄을 때 상한을 늘리고 이어서 돈다 */
function Extend({ workKey }: { workKey: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const extend = async () => {
    setBusy(true)
    setError(null)
    const r = await call(() => window.relay.extendRequirements(workKey, EXTEND_RUNS))
    setBusy(false)
    if (!r.ok) setError(r.error)
  }
  return (
    <div className="notice-actions">
      <button className="primary" disabled={busy} onClick={() => void extend()}>
        계속 +{EXTEND_RUNS}
      </button>
      {error ? <div className="error">{error}</div> : null}
    </div>
  )
}

/** 사람 결정 필요의 양식 (결정 7, 41): 선택지를 고르거나 직접 적는다. 반영 대기인 답은 고칠 수 없다 */
function DecisionForm({
  workKey,
  decisions,
}: {
  workKey: string
  decisions: RequirementsDecisionView[]
}) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = decisions.filter((d) => d.pending === null)
  const answers = open
    .map((d) => ({ decision: d.id, answer: (draft[d.id] ?? '').trim() }))
    .filter((a) => a.answer)
  const send = async () => {
    setBusy(true)
    setError(null)
    const r = await call(() => window.relay.answerRequirements(workKey, answers))
    setBusy(false)
    if (r.ok) setDraft({})
    else setError(r.error)
  }
  const set = (id: string, v: string) => setDraft((m) => ({ ...m, [id]: v }))
  return (
    <div className="requirements-decisions">
      {decisions.map((d) => (
        <fieldset key={d.id} className="requirements-decision">
          <legend>
            {d.id} · {d.question}
          </legend>
          {d.pending !== null ? (
            <div className="dim">답: {d.pending} (반영 대기)</div>
          ) : (
            <>
              {d.options.map((o) => (
                <label key={o} className="radio">
                  <input
                    type="radio"
                    name={`decision-${d.id}`}
                    checked={draft[d.id] === o}
                    onChange={() => set(d.id, o)}
                  />{' '}
                  {o}
                </label>
              ))}
              <input
                type="text"
                aria-label={`${d.id} 답`}
                placeholder="직접 적기"
                value={draft[d.id] ?? ''}
                onChange={(e) => set(d.id, e.target.value)}
              />
            </>
          )}
        </fieldset>
      ))}
      {open.length ? (
        <div className="notice-actions">
          <button
            className="primary"
            disabled={busy || !answers.length}
            onClick={() => void send()}
          >
            답 보내기
          </button>{' '}
          <span className="dim">답은 다음 run 전에 반영합니다 (멈췄으면 [재개] 뒤)</span>
        </div>
      ) : (
        <div className="dim">모든 결정에 답했습니다. [재개]하면 반영하고 잇습니다</div>
      )}
      {error ? <div className="error">{error}</div> : null}
    </div>
  )
}
