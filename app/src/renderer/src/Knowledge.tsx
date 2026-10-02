// 지식 화면 (M17): Work 완료 화면의 [지식 n] 탭(I75), 머지 뒤 정리 창과 [머지 없이 끝내기] 확인 창의 지식 칸(I76),
// 사이드바 프로젝트 줄의 [지식]으로 여는 지식 화면(I77). 고른 것은 렌더러가 들고 있다가 전달·승인 명령에 실어 보낸다.
// 손대지 않은 것은 기본 선택이다(D303): 에이전트 후보는 채택, 다듬지 않은 사람 결정과 같은 결정의 뒤 후보(D324)는
// 채택 안 함, supersedes는 대체.
import { useEffect, useState } from 'react'
import {
  KNOWLEDGE_KINDS,
  KNOWLEDGE_KIND_LABEL,
  KNOWLEDGE_SCOPE_LABEL,
  KNOWLEDGE_SUBKIND_LABEL,
  SUBKIND_KIND,
  candidateChoice,
  candidateProblem,
  editedCandidate,
  type CandidateChoice,
  type CandidateEdit,
  type EntryAction,
  type KnowledgeCandidateView,
  type KnowledgeChoices,
  type KnowledgeKind,
  type KnowledgeRefView,
  type KnowledgeReview,
  type KnowledgeScreen,
  type KnowledgeScreenEntry,
  type KnowledgeSubkind,
  type PendingAction,
} from '../../shared/knowledge'
import type { ProjectView } from '../../shared/views'
import { call } from './commands'
import { Modal } from './dialogs'

/** 지식 칸의 항목 수: [지식 n] 탭의 n */
export function knowledgeCount(k: KnowledgeReview | null | undefined): number {
  if (!k) return 0
  return k.candidates.length + k.pending.length + k.stale.length + k.feedback.length
}

const list = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean)

function RefLine({ r }: { r: KnowledgeRefView }) {
  return (
    <span>
      [{r.kindLabel}] {r.rule}
      {r.paths.length ? <span className="dim"> ({r.paths.join(', ')})</span> : null}{' '}
      <span className="dim">
        — {KNOWLEDGE_SCOPE_LABEL[r.scope]} <code>{r.id}</code>
        {r.carriedPr ? ` · PR #${r.carriedPr}에 실림` : ''}
        {r.stale ? ' · 재확인 필요' : ''}
      </span>
    </span>
  )
}

/** 후보의 고침 (I75): 종류, 갈래, 규칙, 경로, 용어, 이유 */
function EditForm({
  c,
  edit,
  onChange,
}: {
  c: KnowledgeCandidateView
  edit: CandidateEdit | undefined
  onChange: (e: CandidateEdit) => void
}) {
  const e = editedCandidate(c, edit)
  const set = (patch: CandidateEdit) => onChange({ ...edit, ...patch })
  // 입력란은 사람이 친 글을 그대로 들고 있다. 다듬기(trim)와 쉼표 나누기는 고침 값에만 한다
  // (다듬은 값을 다시 그리면 끝의 띄어쓰기와 쉼표가 지워져 여러 낱말을 칠 수 없다)
  const [pathsText, setPathsText] = useState((edit?.paths ?? c.paths).join(', '))
  const [termsText, setTermsText] = useState((edit?.terms ?? c.terms).join(', '))
  const subkinds = (Object.keys(SUBKIND_KIND) as KnowledgeSubkind[]).filter(
    (s) => SUBKIND_KIND[s] === e.kind,
  )
  return (
    <div className="knowledge-edit">
      <label>
        종류{' '}
        <select
          aria-label="종류"
          value={e.kind ?? ''}
          onChange={(ev) => set({ kind: ev.target.value as KnowledgeKind, subkind: null })}
        >
          <option value="" disabled>
            고르세요
          </option>
          {KNOWLEDGE_KINDS.map((k) => (
            <option key={k} value={k}>
              {KNOWLEDGE_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      {subkinds.length ? (
        <label>
          갈래{' '}
          <select
            aria-label="갈래"
            value={e.subkind ?? ''}
            onChange={(ev) =>
              set({ subkind: ev.target.value ? (ev.target.value as KnowledgeSubkind) : null })
            }
          >
            <option value="">없음</option>
            {subkinds.map((s) => (
              <option key={s} value={s}>
                {KNOWLEDGE_SUBKIND_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="form-col">
        <span>규칙 (한 줄)</span>
        <input
          aria-label="규칙"
          value={edit?.rule ?? c.rule}
          onChange={(ev) => set({ rule: ev.target.value })}
        />
      </label>
      <label className="form-col">
        <span>경로 (쉼표로 나눔)</span>
        <input
          aria-label="경로"
          value={pathsText}
          onChange={(ev) => {
            setPathsText(ev.target.value)
            set({ paths: list(ev.target.value) })
          }}
        />
      </label>
      <label className="form-col">
        <span>용어 1~5개 (쉼표로 나눔)</span>
        <input
          aria-label="용어"
          value={termsText}
          onChange={(ev) => {
            setTermsText(ev.target.value)
            set({ terms: list(ev.target.value) })
          }}
        />
      </label>
      <label className="form-col">
        <span>이유</span>
        <textarea
          aria-label="이유"
          rows={2}
          value={edit?.why ?? c.why}
          onChange={(ev) => set({ why: ev.target.value })}
        />
      </label>
    </div>
  )
}

function CandidateRow({
  c,
  choice,
  share,
  readOnly,
  onChange,
}: {
  c: KnowledgeCandidateView
  choice: CandidateChoice
  share: boolean
  readOnly: boolean
  onChange: (c: CandidateChoice) => void
}) {
  const [editing, setEditing] = useState(c.unrefined && choice.adopt)
  const e = editedCandidate(c, choice.edit)
  const problem = choice.adopt ? candidateProblem(e) : null
  const targets = [...(c.supersedes ? [c.supersedes] : []), ...c.overlaps]
  return (
    <li className={`knowledge-item${choice.adopt ? '' : ' dropped'}`}>
      <div className="knowledge-head">
        <label>
          <input
            type="checkbox"
            aria-label="채택"
            disabled={readOnly}
            checked={choice.adopt}
            onChange={(ev) => {
              onChange({ ...choice, adopt: ev.target.checked })
              if (ev.target.checked && c.unrefined) setEditing(true)
            }}
          />{' '}
          채택
        </label>
        {share ? (
          <select
            aria-label="팀/나만"
            disabled={readOnly || !choice.adopt}
            value={choice.share}
            onChange={(ev) => onChange({ ...choice, share: ev.target.value as 'team' | 'mine' })}
          >
            <option value="team">팀</option>
            <option value="mine">나만</option>
          </select>
        ) : (
          <span className="dim">나만 (팀 공유 꺼짐)</span>
        )}
        <span className="knowledge-rule">
          [{e.kind ? KNOWLEDGE_KIND_LABEL[e.kind] : '종류 없음'}] {e.rule}
        </span>
      </div>
      <div className="dim">
        {c.unrefined ? '다듬지 않은 사람 결정 · ' : ''}
        {c.sameDecisionAs ? `같은 결정의 후보(앞: ${c.sameDecisionAs.split('#')[0]}) · ` : ''}
        {c.taskId} · {c.by === 'human' ? '사람이 정함' : 'AI'}
        {e.paths.length ? ` · 경로: ${e.paths.join(', ')}` : ''}
        {e.terms.length ? ` · 용어: ${e.terms.join(', ')}` : ''}
      </div>
      {c.not_in_code && !c.unrefined ? <div className="dim">코드불가: {c.not_in_code}</div> : null}
      {c.unknownSupersedes ? (
        <div className="dim">대체할 항목 {c.unknownSupersedes}을 찾지 못함: 새로 더함으로 둠</div>
      ) : null}
      {c.feedback.map((f, i) => (
        <div key={i} className="dim">
          틀렸다는 보고: {f}
        </div>
      ))}
      {targets.length && choice.adopt ? (
        <div className="knowledge-targets">
          <label>
            <input
              type="radio"
              disabled={readOnly}
              checked={choice.replace === null}
              onChange={() => onChange({ ...choice, replace: null })}
            />{' '}
            새로 더함
          </label>
          {targets.map((t) => (
            <label key={t.id}>
              <input
                type="radio"
                disabled={readOnly || t.carriedPr !== null}
                checked={choice.replace === t.id}
                onChange={() => onChange({ ...choice, replace: t.id })}
              />{' '}
              대체: <RefLine r={t} />
            </label>
          ))}
        </div>
      ) : null}
      {readOnly ? null : (
        <button onClick={() => setEditing(!editing)}>{editing ? '고침 닫기' : '고침'}</button>
      )}
      {editing && !readOnly ? (
        <EditForm c={c} edit={choice.edit} onChange={(edit) => onChange({ ...choice, edit })} />
      ) : null}
      {problem ? <div className="error">채택할 수 없음: {problem}</div> : null}
    </li>
  )
}

const PENDING_LABEL: Readonly<Record<PendingAction, string>> = {
  share: '함께 싣기',
  hold: '이번에는 빼기',
  mine: '나만으로',
  drop: '버림',
}

const ENTRY_LABEL: Readonly<Record<EntryAction, string>> = {
  leave: '그대로 둠',
  confirm: '그대로 맞음',
  replace: '대체',
  drop: '버림',
}

function EntryRow({
  r,
  notes,
  value,
  readOnly,
  onChange,
}: {
  r: KnowledgeRefView | null
  notes?: readonly string[]
  value: { action: EntryAction; rule?: string }
  readOnly: boolean
  onChange: (v: { action: EntryAction; rule?: string }) => void
}) {
  return (
    <li className="knowledge-item">
      {r ? <RefLine r={r} /> : <span className="dim">모르는 항목</span>}
      {notes?.map((n, i) => (
        <div key={i} className="dim">
          보고: {n}
        </div>
      ))}
      {r && !r.carriedPr ? (
        <div className="knowledge-head">
          <select
            aria-label="재확인"
            disabled={readOnly}
            value={value.action}
            onChange={(ev) => onChange({ ...value, action: ev.target.value as EntryAction })}
          >
            {(Object.keys(ENTRY_LABEL) as EntryAction[]).map((a) => (
              <option key={a} value={a}>
                {ENTRY_LABEL[a]}
              </option>
            ))}
          </select>
          {value.action === 'replace' ? (
            <input
              aria-label="새 규칙"
              placeholder="새 규칙 한 줄"
              disabled={readOnly}
              value={value.rule ?? ''}
              onChange={(ev) => onChange({ ...value, rule: ev.target.value })}
            />
          ) : null}
        </div>
      ) : r?.carriedPr ? (
        <div className="dim">PR #{r.carriedPr}에서 고칩니다</div>
      ) : null}
    </li>
  )
}

/**
 * 지식 칸 (I75, I76): 이 Work의 후보, 함께 실릴 공유 대기, 재확인, 틀렸다는 보고. 고른 것은 choices로 들고 바뀔 때마다
 * onChange로 알린다
 */
export function KnowledgePanel({
  review,
  choices,
  onChange,
  readOnly = false,
}: {
  review: KnowledgeReview
  choices: KnowledgeChoices
  onChange: (c: KnowledgeChoices) => void
  readOnly?: boolean
}) {
  const empty = knowledgeCount(review) === 0
  return (
    <div className="knowledge">
      {empty ? <div className="dim">지식 후보가 없습니다.</div> : null}
      {review.candidates.length ? (
        <section>
          <h3>이 Work의 후보</h3>
          <ul>
            {review.candidates.map((c) => (
              <CandidateRow
                key={c.key}
                c={c}
                share={review.share}
                readOnly={readOnly}
                choice={candidateChoice(c, choices, review.share)}
                onChange={(next) =>
                  onChange({ ...choices, candidates: { ...choices.candidates, [c.key]: next } })
                }
              />
            ))}
          </ul>
        </section>
      ) : null}
      {review.pending.length ? (
        <section>
          <h3>공유 대기에서 함께 실림</h3>
          <ul>
            {review.pending.map((p) => (
              <li key={p.id} className="knowledge-item">
                <RefLine r={p} />{' '}
                <select
                  aria-label="공유 대기"
                  disabled={readOnly}
                  value={choices.pending?.[p.id] ?? 'share'}
                  onChange={(ev) =>
                    onChange({
                      ...choices,
                      pending: { ...choices.pending, [p.id]: ev.target.value as PendingAction },
                    })
                  }
                >
                  {(Object.keys(PENDING_LABEL) as PendingAction[]).map((a) => (
                    <option key={a} value={a}>
                      {PENDING_LABEL[a]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {review.stale.length ? (
        <section>
          <h3>재확인 (이 Work가 경로를 바꿈)</h3>
          <ul>
            {review.stale.map((r) => (
              <EntryRow
                key={r.id}
                r={r}
                readOnly={readOnly}
                value={choices.stale?.[r.id] ?? { action: 'leave' }}
                onChange={(v) => onChange({ ...choices, stale: { ...choices.stale, [r.id]: v } })}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {review.feedback.length ? (
        <section>
          <h3>틀렸다는 보고</h3>
          <ul>
            {review.feedback.map((f) => (
              <EntryRow
                key={f.id}
                r={f.entry}
                notes={f.notes}
                readOnly={readOnly}
                value={choices.feedback?.[f.id] ?? { action: 'leave' }}
                onChange={(v) =>
                  onChange({ ...choices, feedback: { ...choices.feedback, [f.id]: v } })
                }
              />
            ))}
          </ul>
        </section>
      ) : null}
      <div className="dim">
        손대지 않으면 기본 선택대로 정해집니다. 지식 폴더: <code>{review.dir}</code>
      </div>
    </div>
  )
}

/**
 * PR 대응 task의 지식 칸 (I76): 머지 뒤 정리 창과 [머지 없이 끝내기] 확인 창. 열 때 읽고, 고른 것을 onChange로 알린다.
 * 거를 것이 없으면 아무것도 보이지 않는다
 */
export function RespondKnowledge({
  workKey,
  choices,
  onChange,
}: {
  workKey: string
  choices: KnowledgeChoices
  onChange: (c: KnowledgeChoices) => void
}) {
  const [review, setReview] = useState<KnowledgeReview | null>(null)
  useEffect(() => {
    let alive = true
    void window.relay.respondKnowledge(workKey).then((r) => {
      if (alive && r.ok) setReview(r.review)
    })
    return () => {
      alive = false
    }
  }, [workKey])
  if (!review || knowledgeCount(review) === 0) return null
  return (
    <section className="knowledge-box">
      <h3>PR 대응의 지식 후보</h3>
      <p className="dim">
        PR이 끝나 그 PR에 실을 수 없어, 팀으로 채택한 것은 공유 대기로 남아 다음 [PR 생성]에
        실립니다. 창을 어느 버튼으로 닫든 고른 대로 씁니다.
      </p>
      <KnowledgePanel review={review} choices={choices} onChange={onChange} />
    </section>
  )
}

// ---------- 지식 화면 (D307, I77) ----------

function ScreenEntry({
  e,
  scope,
  share,
  busy,
  onEdit,
}: {
  e: KnowledgeScreenEntry
  scope: 'team' | 'mine' | 'pending'
  share: boolean
  busy: boolean
  onEdit: (input: Parameters<typeof window.relay.editKnowledge>[1]) => void
}) {
  const [editing, setEditing] = useState(false)
  const [rule, setRule] = useState(e.rule)
  const [paths, setPaths] = useState(e.paths.join(', '))
  const [terms, setTerms] = useState(e.terms.join(', '))
  const locked = e.carriedPr !== null
  return (
    <li className={`knowledge-item${e.status === 'superseded' ? ' dropped' : ''}`}>
      <RefLine r={e} />
      {e.status === 'superseded' ? <span className="dim"> (대체됨)</span> : null}
      <div className="dim">
        출처: {e.source.work} {e.source.task} · {e.source.by === 'human' ? '사람' : 'AI'} · 용어:{' '}
        {e.terms.join(', ')}
      </div>
      {e.why ? <div className="dim">이유: {e.why}</div> : null}
      {locked ? (
        <div className="dim">열린 PR #{e.carriedPr}에 실려 있어 그 PR에서 고칩니다 (D310)</div>
      ) : (
        <div className="notice-actions">
          <button disabled={busy} onClick={() => setEditing(!editing)}>
            {editing ? '고침 닫기' : '고침'}
          </button>
          <button disabled={busy} onClick={() => onEdit({ op: 'drop', scope, id: e.id })}>
            버림
          </button>
          {scope === 'mine' && share ? (
            <button disabled={busy} onClick={() => onEdit({ op: 'move', scope, id: e.id })}>
              팀으로
            </button>
          ) : null}
          {scope === 'pending' ? (
            <button disabled={busy} onClick={() => onEdit({ op: 'move', scope, id: e.id })}>
              나만으로
            </button>
          ) : null}
          {scope === 'team' && e.stale ? (
            <button disabled={busy} onClick={() => onEdit({ op: 'confirm', id: e.id })}>
              그대로 맞음
            </button>
          ) : null}
        </div>
      )}
      {editing && !locked ? (
        <div className="knowledge-edit">
          <label className="form-col">
            <span>규칙</span>
            <input aria-label="규칙" value={rule} onChange={(ev) => setRule(ev.target.value)} />
          </label>
          <label className="form-col">
            <span>경로 (쉼표로 나눔)</span>
            <input aria-label="경로" value={paths} onChange={(ev) => setPaths(ev.target.value)} />
          </label>
          <label className="form-col">
            <span>용어 (쉼표로 나눔)</span>
            <input aria-label="용어" value={terms} onChange={(ev) => setTerms(ev.target.value)} />
          </label>
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              setEditing(false)
              onEdit({
                op: 'edit',
                scope,
                id: e.id,
                edit: { rule, paths: list(paths), terms: list(terms) },
              })
            }}
          >
            {scope === 'team' ? '대체 항목으로 저장' : '저장'}
          </button>
        </div>
      ) : null}
    </li>
  )
}

/** 지식 화면 (D307, I77): 팀(기본 브랜치), 나만, 공유 대기 */
export function KnowledgeDialog({
  project,
  onClose,
}: {
  project: ProjectView
  onClose: () => void
}) {
  const [screen, setScreen] = useState<KnowledgeScreen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // 조작한 뒤 다시 읽는다
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let alive = true
    void window.relay.knowledgeScreen(project.id).then((r) => {
      if (!alive) return
      if (r.ok) setScreen(r.screen)
      else setError(r.error)
    })
    return () => {
      alive = false
    }
  }, [project.id, version])
  const edit = async (input: Parameters<typeof window.relay.editKnowledge>[1]) => {
    setBusy(true)
    setError(null)
    const r = await call(() => window.relay.editKnowledge(project.id, input))
    setBusy(false)
    if (!r.ok) setError(r.error)
    setVersion((v) => v + 1)
  }
  const group = (title: string, scope: 'team' | 'mine' | 'pending', xs: KnowledgeScreenEntry[]) => (
    <section>
      <h3>
        {title} ({xs.length})
      </h3>
      {xs.length ? (
        <ul>
          {xs.map((e) => (
            <ScreenEntry
              key={e.id}
              e={e}
              scope={scope}
              share={screen?.share ?? true}
              busy={busy}
              onEdit={(i) => void edit(i)}
            />
          ))}
        </ul>
      ) : (
        <div className="dim">없음</div>
      )}
    </section>
  )
  return (
    <Modal title={`지식 · ${project.name}`} onClose={onClose}>
      {screen ? (
        <div className="knowledge knowledge-screen">
          <div className="dim">
            지식 폴더 <code>{screen.dir}</code> · 팀 지식: {screen.teamFrom ?? '읽지 못함'} · 팀
            공유 {screen.share ? '켬' : '꺼짐'}
          </div>
          {screen.warnings.map((w, i) => (
            <div key={i} className="notice">
              {w}
            </div>
          ))}
          {group('팀', 'team', screen.team)}
          {group('공유 대기', 'pending', screen.pending)}
          {group('나만', 'mine', screen.mine)}
        </div>
      ) : (
        <div className="dim">읽는 중…</div>
      )}
      {error ? <div className="error">{error}</div> : null}
      <div className="modal-actions">
        <button onClick={onClose}>닫기</button>
      </div>
    </Modal>
  )
}
