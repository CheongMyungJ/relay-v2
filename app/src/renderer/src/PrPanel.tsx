// PR 패널 (시나리오 10, D183)과 머지 창 (D176, D177). PR 요약, [대응 시작]과 [실패한 체크 다시 실행](D175, D203), 머지
// 조건, 항목 목록, 대응 라운드 기록, 받은 원격 커밋을 보인다. 코멘트 본문과 CI 로그는 남이 쓴 글이라 마크다운으로 그리지
// 않고 글자 그대로 보인다(D162). 머지 창은 대응 라운드가 코드를 바꿨으면 판정표 경고를 보인다(D180, D206).
import { useEffect, useState } from 'react'
import type {
  MergeInfo,
  PrItemAction,
  PrItemView,
  PrView,
  RoundView,
  WorkView,
} from '../../shared/views'
import type { MergeMethod } from '../../shared/work'
import { call } from './commands'
import { ConfirmDialog, Modal } from './dialogs'

const short = (commit: string) => commit.slice(0, 8)

const METHOD_LABEL: Readonly<Record<MergeMethod, string>> = {
  merge: '머지 커밋 (merge)',
  squash: '하나로 합침 (squash)',
  rebase: '다시 쌓음 (rebase)',
}

/** 항목 목록의 묶음: 새 항목, 대응 중, 처리됨, 해소됨(D199), 제외, 받지 않음 (화면 구성의 PR 패널) */
const GROUPS: readonly [PrItemView['status'], string][] = [
  ['new', '새 항목'],
  ['responding', '대응 중'],
  ['done', '처리됨'],
  ['resolved', '해소됨'],
  ['excluded', '제외'],
  ['not_accepted', '받지 않음'],
]

/** 항목의 조작 버튼 (D160, D161, D170, D189) */
const ITEM_ACTION: Partial<Record<PrItemView['status'], [PrItemAction, string]>> = {
  new: ['exclude', '제외'],
  excluded: ['include', '다시 넣기'],
  not_accepted: ['accept', '받기'],
}

export function PrPanel({ work, pr }: { work: WorkView; pr: PrView }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [merging, setMerging] = useState(false)
  const [ending, setEnding] = useState(false)
  const [instruction, setInstruction] = useState('')
  const active = work.status === 'pr'
  const cut = work.operation !== null
  // 도는 PR 대응 task가 있으면 [머지 없이 끝내기] 전에 [즉시 중단]한다
  const current = work.tasks.find((t) => t.id === work.current)
  const respondLive = current?.node === 'respond' && (current.live || current.status === 'queued')
  const respondCount = pr.respond.items.length

  const run = async (
    label: string,
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
  ) => {
    setBusy(label)
    setError(null)
    const r = await call(fn)
    setBusy(null)
    if (!r.ok) setError(r.error)
    return r.ok
  }

  return (
    <div className="pr-panel" aria-label="PR 패널">
      <section className="pr-summary" aria-label="PR 요약">
        <div className="pr-title">
          <strong>PR #{pr.number}</strong>
          {pr.labels.state ? (
            <span className={`pr-state${pr.state ? ` ps-${pr.state.toLowerCase()}` : ''}`}>
              {pr.labels.state}
            </span>
          ) : null}
          <button onClick={() => void call(() => window.relay.openExternal(pr.url))}>
            브라우저에서 열기
          </button>
        </div>
        <dl className="pr-facts">
          <dt>head</dt>
          <dd>
            <code>{short(pr.head)}</code>
          </dd>
          <dt>CI</dt>
          <dd className={pr.ci ? `ci-${pr.ci}` : ''}>{pr.labels.ci ?? '아직 읽지 않음'}</dd>
          <dt>리뷰</dt>
          <dd>{pr.labels.review ?? '없음'}</dd>
          <dt>충돌</dt>
          <dd>{pr.labels.mergeable ?? '모름'}</dd>
          {pr.labels.sync ? (
            <>
              <dt>로컬</dt>
              <dd>{pr.labels.sync}</dd>
            </>
          ) : null}
        </dl>
        {pr.checks.length ? (
          <ul className="pr-checks" aria-label="체크">
            {pr.checks.map((c) => (
              <li key={c.label} className={`check-${c.bucket}`}>
                {c.label}: {c.state}
                {c.url ? (
                  <button
                    className="link"
                    onClick={() => void call(() => window.relay.openExternal(c.url ?? ''))}
                  >
                    보기
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="pr-read">
          <span className="dim">
            {pr.reading
              ? '읽는 중…'
              : pr.readAt
                ? `마지막으로 읽은 때 ${pr.readAt}`
                : '아직 읽지 않음'}
            {pr.closed && active ? ' · 닫혀 자동 읽기를 멈춤' : ''}
          </span>
          {active ? (
            <button
              disabled={!!busy || pr.reading || cut}
              onClick={() => void run('새로 고침', () => window.relay.prRefresh(work.key))}
            >
              새로 고침
            </button>
          ) : null}
        </div>
        {pr.error ? <div className="error">{pr.error}</div> : null}
      </section>

      {active && pr.closed ? (
        <div className="notice fail" role="status">
          PR이 닫혔습니다. 자동 읽기를 멈췄습니다. 다시 열었으면 [새로 고침]을 누르세요. 끝내려면
          [머지 없이 끝내기]를 누르세요.
        </div>
      ) : null}

      {active ? (
        <section className="pr-respond" aria-label="대응">
          <h3>대응</h3>
          {/* 자동 대응 (D154, D169, D171): 상한에 닿으면 멈춤을 강조한다 */}
          <div
            className={pr.auto.paused ? 'notice fail' : 'dim'}
            role={pr.auto.paused ? 'status' : undefined}
            aria-label="자동 대응"
          >
            {pr.auto.text}
          </div>
          <textarea
            aria-label="사람 지시"
            placeholder="사람 지시 (선택). 항목이 없으면 지시만으로 시작합니다 (D182)"
            value={instruction}
            disabled={!pr.respond.enabled || !!busy}
            onChange={(e) => setInstruction(e.target.value)}
          />
          <div className="notice-actions">
            <button
              className="primary"
              disabled={!!busy || !pr.respond.enabled || (!respondCount && !instruction.trim())}
              onClick={() =>
                void run('대응 시작', () =>
                  window.relay.prRespond(work.key, { items: pr.respond.items, instruction }),
                ).then((ok) => {
                  if (ok) setInstruction('')
                })
              }
            >
              대응 시작
            </button>
            <span className="dim">
              {pr.respond.enabled
                ? respondCount
                  ? `새 항목 ${respondCount}개를 넣습니다. 뺄 항목은 먼저 [제외]하세요`
                  : '새 항목이 없습니다. 지시를 적으면 지시만으로 시작합니다'
                : pr.respond.reason}
            </span>
          </div>
          {pr.rerun ? (
            <div className="notice-actions">
              <button
                disabled={!!busy || !pr.rerun.enabled}
                onClick={() =>
                  void run('실패한 체크 다시 실행', () => window.relay.prRerun(work.key))
                }
              >
                실패한 체크 다시 실행
              </button>
              <span className="dim">
                {pr.rerun.enabled ? pr.rerun.checks.join(', ') : pr.rerun.reason}
                {pr.rerun.others.length
                  ? ` · Actions 밖 체크(${pr.rerun.others.join(', ')})는 GitHub에서 다시 실행하세요`
                  : ''}
              </span>
            </div>
          ) : null}
        </section>
      ) : null}

      {active ? (
        <section className="pr-actions" aria-label="머지">
          <div className="notice-actions">
            <button
              className="primary"
              disabled={!!busy || !pr.gate.enabled}
              onClick={() => setMerging(true)}
            >
              머지
            </button>
            <button
              disabled={!!busy || cut || respondLive}
              title={respondLive ? 'PR 대응 task가 돌고 있음: 먼저 [즉시 중단]하세요' : undefined}
              onClick={() => setEnding(true)}
            >
              머지 없이 끝내기
            </button>
            {busy ? <span className="dim">{busy}: 하는 중…</span> : null}
          </div>
          {!pr.gate.enabled && pr.gate.reasons.length ? (
            <ul className="gate-reasons" aria-label="머지 조건">
              {pr.gate.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {error ? <div className="error">{error}</div> : null}

      <section aria-label="항목">
        <h3>항목</h3>
        {pr.items.length ? (
          GROUPS.map(([status, label]) => {
            const items = pr.items.filter((i) => i.status === status)
            if (!items.length) return null
            return (
              <div key={status} className="item-group">
                <h4>
                  {label} {items.length}
                </h4>
                {items.map((i) => (
                  <Item
                    key={i.id}
                    item={i}
                    busy={!!busy || !active || cut}
                    onAction={(action) =>
                      void run(ITEM_ACTION[i.status]?.[1] ?? '항목', () =>
                        window.relay.prItem(work.key, i.id, action),
                      )
                    }
                  />
                ))}
              </div>
            )
          })
        ) : (
          <div className="dim">없음</div>
        )}
      </section>

      {pr.rounds.length ? (
        <section aria-label="대응 라운드">
          <h3>대응 라운드</h3>
          {[...pr.rounds].reverse().map((r) => (
            <Round key={r.taskId} round={r} />
          ))}
        </section>
      ) : null}

      {pr.synced.length ? (
        <section aria-label="받은 원격 커밋">
          <h3>받은 원격 커밋 (D193)</h3>
          <ul>
            {pr.synced.map((s, i) => (
              <li key={i}>
                {s.at}: {s.commits.length}개 ({s.commits.map(short).join(', ')})
                {s.baseCommit ? ` · 기준 커밋을 ${short(s.baseCommit)}로 옮김` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pr.ghVersion ? <div className="dim">PR 진행을 시작할 때의 gh {pr.ghVersion}</div> : null}

      {merging ? <MergeDialog work={work} onClose={() => setMerging(false)} /> : null}
      {ending ? (
        <ConfirmDialog
          title="머지 없이 끝내기"
          confirm="머지 없이 끝내기"
          onConfirm={() => {
            setEnding(false)
            void run('머지 없이 끝내기', () => window.relay.prEnd(work.key))
          }}
          onClose={() => setEnding(false)}
        >
          <p>
            Work를 완료(머지 없이)로 바꿉니다. GitHub의 PR은 건드리지 않습니다. 끝낸 뒤에는 이 PR을
            읽지 않습니다.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  )
}

/** 대응 라운드 하나 (화면 구성의 PR 패널): task, 항목, push한 커밋, 게시한 답글(링크), 미룸과 실패 (D193, D194, D205) */
function Round({ round }: { round: RoundView }) {
  return (
    <div className={`pr-round round-${round.state}`} aria-label={`라운드 ${round.round}`}>
      <div className="pr-item-head">
        <strong>라운드 {round.round}</strong>
        <span>{round.label}</span>
        <span className="dim">{round.stateLabel}</span>
      </div>
      {round.failure ? (
        <div className="error">
          {round.failure.stage} 실패: {round.failure.error}
        </div>
      ) : null}
      <ul>
        {round.items.map((i) => (
          <li key={i.id}>
            <span className="kind">{i.kindLabel}</span> {i.title}
          </li>
        ))}
        {!round.items.length ? <li className="dim">항목 없음 (사람 지시만)</li> : null}
      </ul>
      {round.instruction ? <pre className="pr-item-text">{round.instruction}</pre> : null}
      {round.pushed ? (
        <div className="dim">
          push {round.pushed.at}: 커밋 {round.pushed.commits.length}개
          {round.pushed.commits.length ? ` (${round.pushed.commits.map(short).join(', ')})` : ''}
        </div>
      ) : null}
      {round.pushedWith ? <div className="dim">{round.pushedWith} 라운드와 함께 push함</div> : null}
      {round.replies.length ? (
        <ul aria-label="답글">
          {round.replies.map((x) => (
            <li key={x.item}>
              {x.item}:{' '}
              {x.url ? (
                <button
                  className="link"
                  onClick={() => void call(() => window.relay.openExternal(x.url ?? ''))}
                >
                  게시한 답글
                </button>
              ) : x.skipped ? (
                <span className="dim">{x.skipped}</span>
              ) : (
                <span className="dim">게시 전</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Item({
  item,
  busy,
  onAction,
}: {
  item: PrItemView
  busy: boolean
  onAction: (action: PrItemAction) => void
}) {
  const action = item.gone ? undefined : ITEM_ACTION[item.status]
  return (
    <div className={`pr-item st-${item.status}`} aria-label={`${item.kindLabel} ${item.id}`}>
      <div className="pr-item-head">
        <span className="kind">{item.kindLabel}</span>
        <span className="pr-item-title">{item.title}</span>
        {action ? (
          <button disabled={busy} onClick={() => onAction(action[0])}>
            {action[1]}
          </button>
        ) : null}
        {item.url ? (
          <button
            className="link"
            onClick={() => void call(() => window.relay.openExternal(item.url ?? ''))}
          >
            GitHub
          </button>
        ) : null}
      </div>
      {item.where ? <div className="dim">{item.where}</div> : null}
      {item.why ? <div className="dim">{item.why}</div> : null}
      {item.gone ? <div className="dim">GitHub에서 없어짐</div> : null}
      {item.text ? <pre className="pr-item-text">{item.text}</pre> : null}
      {item.note ? <div className="dim">{item.note}</div> : null}
    </div>
  )
}

/**
 * 머지 창 (D176, D177): 레포가 허용하는 방식 가운데 고르고(기본은 프로젝트 설정, 없으면 허용하는 첫 방식), 머지할
 * head 커밋을 보인다. 이 커밋이 아니면 머지하지 않는다. GitHub가 막으면(리뷰 승인, 브랜치 보호) 그 오류를 보인다.
 * 대응 라운드가 커밋을 push했거나 앱이 원격 커밋을 받았으면 "판정표는 대응 전 코드 기준"을 경고하고 verify의 판정표를
 * 함께 보인다 (D180, D206)
 */
function MergeDialog({ work, onClose }: { work: WorkView; onClose: () => void }) {
  const [info, setInfo] = useState<MergeInfo | null>(null)
  const [method, setMethod] = useState<MergeMethod | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stale = false
    void call(() => window.relay.prMergeInfo(work.key)).then((r) => {
      if (stale) return
      if (r.ok) {
        setInfo(r.info)
        setMethod(r.info.preferred)
      } else setError(r.error)
    })
    return () => {
      stale = true
    }
  }, [work.key])

  const merge = async () => {
    if (!info || !method) return
    setBusy(true)
    setError(null)
    const r = await call(() => window.relay.prMerge(work.key, { method, head: info.head }))
    setBusy(false)
    if (r.ok) onClose()
    else setError(r.error)
  }

  return (
    <Modal title={`머지 · PR #${work.pr?.number ?? ''}`} onClose={onClose}>
      {!info ? (
        <div className="dim">{error ? null : '레포의 머지 방식을 읽는 중…'}</div>
      ) : (
        <div className="merge-form">
          <div>
            머지할 head 커밋: <code>{info.head}</code>
          </div>
          <div className="dim">그사이 PR에 새 커밋이 생기면 머지하지 않습니다.</div>
          {info.stale ? (
            <div className="notice fail" role="alert" aria-label="판정표 경고">
              <strong>판정표는 대응 전 코드 기준입니다.</strong> verify 뒤에 코드가 바뀌었습니다:
              {info.stale.rounds ? ` 커밋을 push한 대응 라운드 ${info.stale.rounds}개` : ''}
              {info.stale.rounds && info.stale.synced ? ',' : ''}
              {info.stale.synced ? ` 받은 원격 커밋 ${info.stale.synced}개` : ''}. 대응 뒤에는
              verify를 다시 돌리지 않고, 대응 task의 테스트 실행과 CI로 갈음합니다 (D180).
              {info.verdicts.length ? (
                <table className="verdicts">
                  <thead>
                    <tr>
                      <th>완료조건</th>
                      <th>판정</th>
                      <th>근거</th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.verdicts.map((v, i) => (
                      <tr key={i} className={v.warn ? 'warn' : ''}>
                        <td>{v.criterion}</td>
                        <td>{v.verdict}</td>
                        <td>{v.basis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          ) : null}
          <fieldset>
            <legend>머지 방식</legend>
            {info.methods.map((m) => (
              <label key={m} className="toggle">
                <input
                  type="radio"
                  name="merge-method"
                  aria-label={METHOD_LABEL[m]}
                  checked={method === m}
                  onChange={() => setMethod(m)}
                />
                {METHOD_LABEL[m]}
              </label>
            ))}
          </fieldset>
          {!info.gate.enabled ? (
            <ul className="gate-reasons" aria-label="머지 조건">
              {info.gate.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      {error ? <div className="error">{error}</div> : null}
      <div className="buttons">
        <button onClick={onClose}>취소</button>
        <button
          className="primary"
          disabled={busy || !info || !method || !info.gate.enabled}
          onClick={() => void merge()}
        >
          {busy ? '머지하는 중…' : '머지'}
        </button>
      </div>
    </Modal>
  )
}
