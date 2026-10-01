import { useState } from 'react'
import type { HumanAnswers, PendingQuestionView } from '../../shared/questions'
import { call } from './commands'
import { Modal } from './dialogs'

export function QuestionDialog({
  workKey,
  taskId,
  pending,
  onHide,
}: {
  workKey: string
  taskId: string
  pending: PendingQuestionView
  onHide: () => void
}) {
  const [chosen, setChosen] = useState<HumanAnswers>({})
  const [written, setWritten] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const answers = Object.fromEntries(
    pending.questions.map((q) => [
      q.id,
      [...(chosen[q.id] ?? []), ...(written[q.id]?.trim() ? [written[q.id]?.trim() ?? ''] : [])],
    ]),
  )
  const submit = async (cancelled: boolean) => {
    setBusy(true)
    setError(null)
    const r = await call(() =>
      window.relay.answerQuestion(workKey, taskId, pending.id, cancelled ? null : answers),
    )
    setBusy(false)
    if (!r.ok) setError(r.error)
  }
  return (
    <Modal title="Codex 질문" onClose={onHide}>
      <p className="dim">답변을 보낼 때까지 작업이 기다립니다. 추천 선택지도 직접 골라야 합니다.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit(false)
        }}
      >
        {pending.questions.map((q) => (
          <fieldset key={q.id} className="human-question" disabled={busy}>
            <legend>{q.header}</legend>
            <p>{q.question}</p>
            {q.options?.map((o) => (
              <label key={o.label} className="human-option">
                <input
                  type={q.multiSelect ? 'checkbox' : 'radio'}
                  name={q.id}
                  checked={(chosen[q.id] ?? []).includes(o.label)}
                  onChange={(e) => {
                    setChosen((value) => ({
                      ...value,
                      [q.id]: q.multiSelect
                        ? e.target.checked
                          ? [...(value[q.id] ?? []), o.label]
                          : (value[q.id] ?? []).filter((s) => s !== o.label)
                        : [o.label],
                    }))
                    if (!q.multiSelect) setWritten((value) => ({ ...value, [q.id]: '' }))
                  }}
                />
                <span>
                  <strong>{o.label}</strong>
                  <br />
                  <span className="dim">{o.description}</span>
                </span>
              </label>
            ))}
            <label className="human-written">
              직접 입력
              <textarea
                aria-label={`${q.header} 직접 입력`}
                maxLength={8000}
                value={written[q.id] ?? ''}
                onChange={(e) => {
                  setWritten((value) => ({ ...value, [q.id]: e.target.value }))
                  if (!q.multiSelect) setChosen((value) => ({ ...value, [q.id]: [] }))
                }}
              />
            </label>
          </fieldset>
        ))}
        {error ? <div className="error">{error}</div> : null}
        <div className="dialog-actions">
          <button type="button" disabled={busy} onClick={onHide}>
            나중에 답변
          </button>
          <button type="button" disabled={busy} onClick={() => void submit(true)}>
            질문 취소
          </button>
          <button
            type="submit"
            disabled={busy || pending.questions.some((q) => !answers[q.id]?.length)}
          >
            답변 보내기
          </button>
        </div>
      </form>
    </Modal>
  )
}
