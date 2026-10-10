// 요구사항 추출의 진행 상자 (requirements-extraction-flow.md 15.5, 17.12, 결정 7, 41, 98). extract task는 터미널이 없으므로
// 패널 맨 위에 run 진행(쓴 run/상한, 단위), 지금 run과 도구, 멈춘 까닭을 보이고 사람 결정 필요에 답하는 양식을 둔다.
// 답은 반영 대기로 두었다가 루프가 다음 run을 띄우기 전에(멈췄으면 [재개] 뒤에) revision으로 만든다.
import { useState } from 'react'
import type {
  RequirementsDecisionView,
  RequirementsRunView,
  RequirementsView,
} from '../../shared/views'
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
        <div className="dim">
          사용량 한도: {localTime(req.usageWait)}까지 기다렸다 같은 단위부터 잇습니다
        </div>
      ) : null}
      {req.partial ? (
        <div>부분 분석: 보류한 단위가 있다. 끝나면 결과 문서에 부분 분석으로 보인다</div>
      ) : null}
      {req.halt ? (
        <div>
          멈춤: {req.halt.label}
          {req.halt.detail ? <div className="dim">{req.halt.detail}</div> : null}
          {req.halt.reason === 'run_limit' ? <RunLimit workKey={workKey} req={req} /> : null}
        </div>
      ) : null}
      {req.decisions.length ? <DecisionForm workKey={workKey} decisions={req.decisions} /> : null}
      <RunList workKey={workKey} runs={req.runs} />
    </div>
  )
}

/** 늘리는 run 수 ([계속 +N], [범위 줄이고 계속], 결정 26, 99, AI 결정 114) */
const EXTEND_RUNS = 20

/**
 * run 상한으로 멈췄을 때 (결정 26, AI 결정 114): [계속 +N]은 상한을 늘려 잇고, [범위 줄이고 계속]은 고른 열린 단위를 빼고
 * 메모를 남긴 뒤 같은 수를 늘리고, [부분 분석으로 넘기기]는 열린 단위를 보류로 닫고 summarize 하나만 돌려 끝낸다
 */
function RunLimit({ workKey, req }: { workKey: string; req: RequirementsView }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'none' | 'narrow' | 'partial'>('none')
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState('')
  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setBusy(true)
    setError(null)
    const r = await call(fn)
    setBusy(false)
    if (!r.ok) setError(r.error)
    else setMode('none')
  }
  const toggle = (id: string) =>
    setPicked((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]))
  return (
    <div className="notice-actions">
      <button
        className="primary"
        disabled={busy}
        onClick={() => void run(() => window.relay.extendRequirements(workKey, EXTEND_RUNS))}
      >
        계속 +{EXTEND_RUNS}
      </button>{' '}
      <button disabled={busy || !req.openUnits.length} onClick={() => setMode('narrow')}>
        범위 줄이고 계속
      </button>{' '}
      <button disabled={busy} onClick={() => setMode('partial')}>
        부분 분석으로 넘기기
      </button>
      {mode === 'narrow' ? (
        <fieldset className="requirements-decision" aria-label="범위 줄이기">
          <legend>범위에서 뺄 열린 단위 (빼고 +{EXTEND_RUNS})</legend>
          {req.openUnits.map((u) => (
            <label key={u.id} className="radio">
              <input
                type="checkbox"
                checked={picked.includes(u.id)}
                onChange={() => toggle(u.id)}
              />{' '}
              {u.id} {u.kind === 'trace' ? `trace(${u.lens})` : u.kind}: {u.scope}
            </label>
          ))}
          <input
            type="text"
            aria-label="범위 줄이기 메모"
            placeholder="메모 (뒤 run에도 전합니다)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="notice-actions">
            <button
              className="primary"
              disabled={busy || !picked.length}
              onClick={() =>
                void run(() =>
                  window.relay.narrowRequirements(workKey, picked, note.trim(), EXTEND_RUNS),
                )
              }
            >
              빼고 계속
            </button>{' '}
            <button disabled={busy} onClick={() => setMode('none')}>
              취소
            </button>
          </div>
        </fieldset>
      ) : null}
      {mode === 'partial' ? (
        <div className="notice">
          열린 단위 {req.openUnits.length}개를 &quot;보류: 예산 상한&quot;으로 닫고 summarize run
          하나를 상한 밖에서 돌려 부분 분석으로 끝냅니다. 답하지 않은 결정은 &quot;답 없음&quot;으로
          남습니다.
          <div className="notice-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => void run(() => window.relay.partialRequirements(workKey))}
            >
              부분 분석으로 넘기기
            </button>{' '}
            <button disabled={busy} onClick={() => setMode('none')}>
              취소
            </button>
          </div>
        </div>
      ) : null}
      {error ? <div className="error">{error}</div> : null}
    </div>
  )
}

/** 걸린 시간 */
function seconds(ms: number | null): string {
  if (ms === null) return ''
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`
}

/** run 목록 (AI 결정 115): 진행 상자 아래 접힌 표. 행을 누르면 반영 검사 문제와 경고를 보인다 */
function RunList({ workKey, runs }: { workKey: string; runs: RequirementsRunView[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!runs.length) return null
  const folder = async () => {
    setError(null)
    const r = await call(() => window.relay.openRequirementsRuns(workKey))
    if (!r.ok) setError(r.error)
  }
  return (
    <details className="requirements-runs">
      <summary>run 기록 {runs.length}개</summary>
      <table className="verdicts">
        <thead>
          <tr>
            <th>run</th>
            <th>단위</th>
            <th>종류</th>
            <th>결과</th>
            <th>되돌림</th>
            <th>시간</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <RunRow
              key={r.id}
              r={r}
              open={open === r.id}
              onToggle={() => setOpen(open === r.id ? null : r.id)}
            />
          ))}
        </tbody>
      </table>
      <div className="notice-actions">
        <button onClick={() => void folder()}>run 기록 폴더 열기</button>
        {error ? <div className="error">{error}</div> : null}
      </div>
    </details>
  )
}

function RunRow({
  r,
  open,
  onToggle,
}: {
  r: RequirementsRunView
  open: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr>
        <td>
          {r.details.length ? (
            <button className="link" aria-expanded={open} onClick={onToggle}>
              {r.id}
            </button>
          ) : (
            r.id
          )}
        </td>
        <td>{r.unit}</td>
        <td>{r.kind === 'trace' ? `trace(${r.lens ?? ''})` : r.kind}</td>
        <td>{r.result}</td>
        <td>{r.denials}</td>
        <td>
          {seconds(r.ms)}
          {r.cost !== null ? ` · $${r.cost.toFixed(2)}` : ''}
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={6} className="dim">
            {r.details.map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </td>
        </tr>
      ) : null}
    </>
  )
}

/**
 * 저장소로 결과 내보내기 (AI 결정 119): 완료 화면(verify 승인 대기)에서 레포 상대 폴더를 받아 extraction.md, record.json,
 * 실행 출력 사본을 쓰고 그 폴더만 커밋한다. 전달(push·PR)은 그 뒤에 따로 한다
 */
export function RequirementsExport({
  workKey,
  workId,
  req,
}: {
  workKey: string
  workId: string
  req: RequirementsView
}) {
  const [dir, setDir] = useState(`docs/requirements/${workId}`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const send = async () => {
    setBusy(true)
    setError(null)
    const r = await call(() => window.relay.exportRequirements(workKey, dir.trim()))
    setBusy(false)
    if (!r.ok) setError(r.error)
  }
  return (
    <div className="requirements-box" aria-label="결과 내보내기">
      <div>
        결과를 저장소에 커밋: extraction.md, record.json(채택 칸 미결정), 실행 출력 사본
        {req.partial ? ' · 부분 분석' : ''}
      </div>
      {req.exported ? (
        <div className="dim">
          내보냄: <code>{req.exported.path}</code> (커밋 {req.exported.commit.slice(0, 7)})
        </div>
      ) : null}
      <input
        type="text"
        aria-label="내보낼 폴더"
        value={dir}
        onChange={(e) => setDir(e.target.value)}
      />
      <div className="notice-actions">
        <button className="primary" disabled={busy || !dir.trim()} onClick={() => void send()}>
          결과를 저장소에 커밋
        </button>
        {error ? <div className="error">{error}</div> : null}
      </div>
    </div>
  )
}

/** 기록의 ISO 시각을 이 컴퓨터의 시각으로 보인다. 읽지 못하면 그대로 */
function localTime(iso: string): string {
  const t = new Date(iso)
  return Number.isNaN(t.getTime()) ? iso : t.toLocaleString()
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
