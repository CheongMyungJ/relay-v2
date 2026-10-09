// 요구사항 추출 extract의 순수 로직 (requirements-extraction-flow.md 8절, 15.3, 결정 6·7·24~42, 92~99).
// 기록(revision 변경분) 접기, 다음 단위 고르기, run 결과를 변경분으로 바꾸기, 연속 횟수와 멈춤, run 판정, 기준 커밋의
// 인용 대조, 패킷과 extraction.md·handoff.md 렌더링. 파일·git·프로세스는 adapters/requirements가 맡는다 (I9).
import type { RequirementsView } from '../shared/views'
import type {
  ActiveRun,
  AppliedRun,
  Answer,
  BuildTarget,
  Claim,
  DecisionState,
  Evidence,
  ExtractIntegrate,
  ExtractResult,
  ExtractReview,
  ExtractSummarize,
  HaltReason,
  HumanDecision,
  Link,
  NextIds,
  Note,
  RequirementsBudget,
  RequirementsPointer,
  RequirementsRevision,
  RequirementsState,
  Review,
  Unit,
  UnitKind,
  UnitState,
  UnitStatus,
} from '../shared/requirements'
import { CLOSED_STATUSES } from '../shared/requirements'
import {
  VERDICT_STATUS,
  compareAnswer,
  reviewBatches,
  reviewItems,
  type BlindAnswer,
} from '../../../skills/extract/review.mjs'
import {
  claimSummary,
  foldedBy,
  recordListing,
  renderIntegratePacket,
  renderReviewPacket,
  renderSummarizePacket,
  resolvedBy,
  type PacketRecord,
} from '../../../skills/extract/packets.mjs'

const pad = (n: number) => String(n).padStart(4, '0')
export const unitId = (n: number) => `u-${pad(n)}`
export const claimId = (n: number) => `c-${pad(n)}`
export const evidenceId = (n: number) => `e-${pad(n)}`
export const decisionId = (n: number) => `h-${pad(n)}`
export const runId = (n: number) => `r-${pad(n)}`
export const linkId = (n: number) => `l-${pad(n)}`
/** revision 파일 이름: 000001.json */
export const revisionFile = (n: number) => `${String(n).padStart(6, '0')}.json`

/** 처음 포인터 (결정 93). extract를 시작할 때 만든다 */
export function emptyPointer(): RequirementsPointer {
  return {
    revision: 0,
    revision_hash: null,
    next: { unit: 1, claim: 1, evidence: 1, decision: 1, revision: 1, run: 1 },
    runs_used: 0,
    runs_extra: 0,
    failures_in_row: 0,
    streaks: {},
  }
}

export const isClosed = (s: UnitStatus) => CLOSED_STATUSES.includes(s)

// ---------------------------------------------------------------------------------------------------------------
// 기록 접기 (결정 93)

/**
 * 계보(포인터에서 parent를 따라 거슬러 간 revision들을 오래된 차례로)가 이어지는가. 아니면 그 까닭 (결정 38의 무결성).
 * 계보의 처음은 parent가 없고, 다음 것은 앞 것을 parent로 가리키며 번호가 오른다. 되감기 뒤에는 번호가 건너뛴다 (결정 120)
 */
export function chainProblem(revisions: readonly RequirementsRevision[]): string | null {
  for (const [i, r] of revisions.entries()) {
    const prev = revisions[i - 1]
    if (!prev) {
      if (r.parent !== null) return `revision ${r.number}의 parent ${r.parent}가 계보에 없다`
      continue
    }
    if (r.parent !== prev.number) return `revision ${r.number}의 parent가 ${r.parent}다`
    if (r.number <= prev.number) return `revision ${r.number}가 앞 revision ${prev.number}보다 작다`
  }
  return null
}

/** 변경분을 차례로 접는다. 계보는 chainProblem으로 먼저 본다 */
export function fold(revisions: readonly RequirementsRevision[]): RequirementsState {
  const units: UnitState[] = []
  const byId = new Map<string, UnitState>()
  const claims: Claim[] = []
  const evidence: Evidence[] = []
  const decisions: DecisionState[] = []
  const decById = new Map<string, DecisionState>()
  const links: Link[] = []
  const reviews: Review[] = []
  const notes: Note[] = []
  const runs: AppliedRun[] = []
  let buildIndex: RequirementsState['build_index'] = null
  let summary: RequirementsState['summary'] = null
  for (const r of revisions) {
    for (const u of r.units) {
      const s: UnitState = {
        ...u,
        status: 'open',
        reason: '',
        run: null,
        checkpoint: null,
        checklist: null,
        revision: r.number,
      }
      units.push(s)
      byId.set(u.id, s)
    }
    for (const up of r.unit_updates) {
      const s = byId.get(up.id)
      if (!s) continue
      s.status = up.status
      s.reason = up.reason
      s.run = up.run
      s.checkpoint = up.checkpoint
      s.revision = r.number
      if (up.checklist) s.checklist = up.checklist
      if (up.status === 'merged') s.merged_into = up.reason
      if (up.decision) s.reopened_by = up.decision
    }
    if (r.cause.kind === 'run' && r.cause.run) {
      const up = r.unit_updates.find((u) => u.run === r.cause.run)
      const u = up ? byId.get(up.id) : undefined
      if (u) runs.push({ id: r.cause.run, unit: u.id, kind: u.kind, revision: r.number })
    }
    claims.push(...r.claims)
    evidence.push(...r.evidence)
    for (const d of r.decisions) {
      const s: DecisionState = { ...d, answer: null }
      decisions.push(s)
      decById.set(d.id, s)
    }
    for (const a of r.answers) {
      const d = decById.get(a.decision)
      if (d) d.answer = a
    }
    links.push(...(r.links ?? []))
    reviews.push(...(r.reviews ?? []))
    notes.push(...(r.notes ?? []))
    if (r.build_index) buildIndex = r.build_index
    if (r.summary) summary = r.summary
  }
  return {
    revision: revisions.at(-1)?.number ?? 0,
    units,
    claims,
    evidence,
    decisions,
    links,
    reviews,
    notes,
    build_index: buildIndex,
    summary,
    runs,
  }
}

/** 빈 revision 틀 */
function revision(
  number: number,
  at: string,
  cause: RequirementsRevision['cause'],
  parent: number | null = number > 1 ? number - 1 : null,
): RequirementsRevision {
  // 포인터는 늘 마지막으로 쓴 revision을 가리키고 다음 번호는 그 바로 뒤라, 보통의 parent는 번호 - 1이다. 되감기만 다른
  // parent를 준다 (결정 120)
  return {
    schema_version: 0,
    number,
    parent,
    at,
    cause,
    units: [],
    unit_updates: [],
    claims: [],
    evidence: [],
    decisions: [],
    answers: [],
  }
}

/**
 * extract를 시작하는 첫 revision: survey 단위 하나 (결정 95). 되감기로 새로 시작하면 parent 없는 새 번호의 revision이다
 * (결정 120)
 */
export function startRevision(
  next: NextIds,
  at: string,
  note = 'extract 시작',
): { revision: RequirementsRevision; next: NextIds } {
  const rev = revision(next.revision, at, { kind: 'app', run: null, note }, null)
  rev.units.push({
    id: unitId(next.unit),
    kind: 'survey',
    lens: null,
    purpose:
      'Discover the build configurations, entry points (reset, vectors, interrupt handlers, main loop or tasks, command tables and commands, DMA channels) and interfaces, mark vendor or third-party code as boundaries, and propose analysis units with a lens each.',
    scope: 'The whole repository.',
    priority: 'high',
    depends_on: [],
    reason: '',
    from: null,
  })
  return { revision: rev, next: { ...next, unit: next.unit + 1, revision: next.revision + 1 } }
}

// ---------------------------------------------------------------------------------------------------------------
// 다음 단위 (결정 7, 95)

const RANK = { high: 0, medium: 1, low: 2 } as const
/**
 * 종류의 층 (AI 결정 107): survey, 그다음 trace와 integrate, 그다음 review, 마지막 summarize. 층 안에서 우선순위와 만든
 * 차례로 고른다. review는 발견(trace)보다 먼저 예산을 쓰지 않는다
 */
const TIER: Readonly<Record<UnitKind, number>> = {
  survey: 0,
  trace: 1,
  integrate: 1,
  review: 2,
  summarize: 3,
}

/** 답을 받지 않은 사람 결정 */
export function openDecisions(state: RequirementsState): DecisionState[] {
  return state.decisions.filter((d) => !d.answer)
}

/** 열린 단위 */
export function openUnits(state: RequirementsState): UnitState[] {
  return state.units.filter((u) => u.status === 'open')
}

export interface Pick {
  unit: UnitState | null
  /** 열린 결정에 걸려 기다리는 단위 */
  waiting: UnitState[]
}

/**
 * 다음에 돌릴 단위: 열린 사람 결정에 걸리지 않고 의존이 모두 끝난 열린 단위 가운데 우선순위, 만든 차례 (결정 95).
 * 의존 사슬이 돌면(서로 기다림) 의존을 보지 않고 고른다
 */
export function pickUnit(state: RequirementsState): Pick {
  const blocked = new Set(openDecisions(state).flatMap((d) => d.blocks))
  const status = new Map(state.units.map((u) => [u.id, u.status]))
  const open = openUnits(state)
  const waiting = open.filter((u) => blocked.has(u.id))
  const free = open.filter((u) => !blocked.has(u.id))
  const ready = free.filter((u) => u.depends_on.every((d) => isClosed(status.get(d) ?? 'done')))
  const pool = ready.length ? ready : free
  const sorted = [...pool].sort(
    (a, b) =>
      TIER[a.kind] - TIER[b.kind] ||
      RANK[a.priority] - RANK[b.priority] ||
      a.id.localeCompare(b.id),
  )
  return { unit: sorted[0] ?? null, waiting }
}

// ---------------------------------------------------------------------------------------------------------------
// 앱이 만드는 단위: integrate, review, summarize (AI 결정 107, 111~113)

/** 주기 integrate의 간격: 지난 integrate 뒤 반영한 survey·trace run 수 (AI 결정 111) */
export const INTEGRATE_EVERY = 10

const PRODUCING: readonly UnitKind[] = ['survey', 'trace']

/** 마지막으로 끝난 integrate 단위의 revision. 없으면 0 */
export function lastIntegrate(state: RequirementsState): number {
  return Math.max(
    0,
    ...state.units
      .filter((u) => u.kind === 'integrate' && isClosed(u.status))
      .map((u) => u.revision),
  )
}

/** 마지막 integrate 뒤에 반영한 survey·trace run */
export function producingSince(state: RequirementsState): AppliedRun[] {
  const after = lastIntegrate(state)
  return state.runs.filter((r) => PRODUCING.includes(r.kind) && r.revision > after)
}

export interface Scheduled {
  revision: RequirementsRevision
  next: NextIds
  /** 만든 단위의 종류 */
  kind: 'integrate' | 'summarize'
}

/**
 * 다음 run을 고르기 전에 앱이 만들 단위 (AI 결정 111, 113). 없으면 null이고 pickUnit이 열린 단위를 고른다.
 * - integrate(주기): 돌릴 survey·trace가 남았고, 지난 integrate 뒤 survey·trace run을 INTEGRATE_EVERY번 반영했다
 * - integrate(마지막): 열린 survey·trace와 열린 사람 결정이 없고, integrate가 없었거나 그 뒤에 survey·trace 결과가
 *   반영됐다. 결정에 걸린 단위가 남았거나 답이 끝난 단위를 다시 열 수 있으면 먼저 멈춰 묻는다(결정 7, 103)
 * - summarize: 열린 단위와 열린 결정이 없고, 마지막 변경 뒤의 summarize가 없다
 * 열린 integrate나 summarize가 있으면 만들지 않는다
 */
export function scheduleRevision(
  state: RequirementsState,
  next: NextIds,
  at: string,
  every = INTEGRATE_EVERY,
): Scheduled | null {
  const open = openUnits(state)
  if (open.some((u) => u.kind === 'integrate' || u.kind === 'summarize')) return null
  // 부분 분석으로 넘겼으면 summarize 하나만 돈다 (결정 26, AI 결정 114)
  if (isPartial(state)) return null
  const blocked = new Set(openDecisions(state).flatMap((d) => d.blocks))
  const runnable = open.filter((u) => PRODUCING.includes(u.kind) && !blocked.has(u.id))
  const since = producingSince(state).length
  const hasIntegrate = state.units.some((u) => u.kind === 'integrate')
  const make = (kind: 'integrate' | 'summarize', note: string): Scheduled => {
    const rev = revision(next.revision, at, { kind: 'app', run: null, note })
    rev.units.push(appUnit(kind, unitId(next.unit), state))
    return {
      revision: rev,
      next: { ...next, unit: next.unit + 1, revision: next.revision + 1 },
      kind,
    }
  }
  if (runnable.length) {
    if (since >= every) return make('integrate', `survey·trace run ${since}번 뒤의 integrate`)
    return null
  }
  const decisions = openDecisions(state).length
  if (!state.runs.length || decisions || open.some((u) => PRODUCING.includes(u.kind))) return null
  if (!hasIntegrate || since > 0)
    return make('integrate', '돌릴 survey·trace 단위가 없어 마지막 integrate')
  if (open.length) return null
  const lastChange = Math.max(
    0,
    ...state.units.filter((u) => u.kind !== 'summarize').map((u) => u.revision),
  )
  const summarized = state.units.some(
    (u) => u.kind === 'summarize' && isClosed(u.status) && u.revision > lastChange,
  )
  if (summarized) return null
  return make('summarize', '열린 단위가 없어 summarize')
}

/** 앱이 만드는 단위의 모양 (AI 결정 107). review는 묶음의 주장을 갖는다 */
function appUnit(
  kind: 'integrate' | 'review' | 'summarize',
  id: string,
  state: RequirementsState,
  claims: string[] = [],
): Unit {
  const purpose =
    kind === 'integrate'
      ? 'Link records of earlier runs, judge coverage per perspective and configuration, and propose units for gaps.'
      : kind === 'review'
        ? `Review ${claims.length} claims with blind questions and refutation attempts.`
        : 'Write the overview, handoff summary and risks from the record.'
  return {
    id,
    kind,
    lens: null,
    purpose,
    scope:
      kind === 'review'
        ? claims.join(', ')
        : kind === 'integrate'
          ? `The whole record (${state.claims.length} claims, ${state.units.length} units).`
          : 'The whole record.',
    priority: kind === 'review' ? 'low' : 'high',
    depends_on: [],
    reason: '',
    from: null,
    ...(kind === 'review' ? { claims } : {}),
  }
}

/** 이미 review 묶음에 든 주장 */
function queuedForReview(state: RequirementsState): Set<string> {
  return new Set(state.units.flatMap((u) => (u.kind === 'review' ? (u.claims ?? []) : [])))
}

// ---------------------------------------------------------------------------------------------------------------
// run 결과를 변경분으로 (결정 34, 35, 94, 95)

/** 앵커 모양 */
interface Anchor {
  kind: Evidence['kind']
  path: string
  start: number
  end: number
  quote: string
  command: string | null
}

const isAnchor = (v: unknown): v is Anchor =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  'kind' in v &&
  'path' in v &&
  'quote' in v &&
  'start' in v &&
  'end' in v

/** 경로를 레포 상대로: 역슬래시, worktree 머리, ./ 를 뗀다 */
export function repoPath(p: string, root: string): string {
  let s = String(p ?? '').replace(/\\/g, '/')
  const r = String(root ?? '')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
  if (r && s.toLowerCase().startsWith(r.toLowerCase() + '/')) s = s.slice(r.length + 1)
  return s.replace(/^\.\//, '').replace(/^\/+/, '')
}

/** 결과 안의 모든 앵커 (위치와 함께) */
export function anchorsOf(result: unknown): { at: string; anchor: Anchor }[] {
  const out: { at: string; anchor: Anchor }[] = []
  const walk = (v: unknown, at: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}/${i}`))
    else if (isAnchor(v)) out.push({ at, anchor: v })
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) walk(x, `${at}/${k}`)
  }
  walk(result, '')
  return out
}

/** 단위·결정·checkpoint·점검표를 뺀, 주장이 되는 절 (결정 94) */
const NOT_CLAIMS = new Set(['units', 'followups', 'human_decisions', 'checkpoint', 'checklist'])

/** 범위 글을 견주는 꼴: 공백을 하나로, 소문자 */
const scopeKey = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

export interface ApplyInput {
  state: RequirementsState
  next: NextIds
  unit: UnitState
  run: string
  result: ExtractResult
  /** 기준 커밋 */
  base: string
  /** 분석 대상 worktree 경로(앵커의 절대 경로를 레포 상대로 바꿀 때) */
  repo: string
  /** 레포 상대 경로 → 기준 커밋의 blob sha. 없는 파일은 null */
  blobs: Readonly<Record<string, string | null>>
  at: string
}

export interface ApplyOutput {
  revision: RequirementsRevision
  next: NextIds
  /** 경고(결정 37): 겹치는 후속 단위를 합침 */
  warnings: string[]
  /** 이 run으로 단위가 끝났는가(outcome이 incomplete가 아님) */
  closed: boolean
}

/** 앵커를 근거로: 같은 (종류, 경로, 범위, 인용, 명령)은 하나 (결정 35). rev에 새 근거를 더한다 */
function evidenceMapper(o: ApplyInput, rev: RequirementsRevision, next: NextIds) {
  const evKey = (a: Anchor) =>
    JSON.stringify([a.kind, a.path, a.start, a.end, a.quote, a.command ?? null])
  const known = new Map(o.state.evidence.map((e) => [evKey(e), e.id]))
  const evidenceOf = (raw: Anchor & { inputs?: Evidence['inputs'] }): string => {
    const inRepo = raw.kind === 'code' || raw.kind === 'doc_claim'
    const a: Anchor = {
      kind: raw.kind,
      path: inRepo ? repoPath(raw.path, o.repo) : raw.path,
      start: raw.start,
      end: raw.end,
      quote: raw.quote,
      command: raw.command ?? null,
    }
    const k = evKey(a)
    const have = known.get(k)
    if (have) return have
    const id = evidenceId(next.evidence++)
    known.set(k, id)
    rev.evidence.push({
      id,
      ...a,
      commit: inRepo ? o.base : null,
      blob: inRepo ? (o.blobs[a.path] ?? null) : null,
      ...(raw.inputs?.length ? { inputs: raw.inputs } : {}),
    })
    return id
  }
  const withEvidence = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(withEvidence)
    if (isAnchor(v)) return { evidence: evidenceOf(v) }
    if (v && typeof v === 'object')
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, withEvidence(x)]))
    return v
  }
  const idsOf = (anchors: unknown): string[] =>
    Array.isArray(anchors) ? anchors.filter(isAnchor).map((a) => evidenceOf(a)) : []
  return { withEvidence, idsOf }
}

/** 결과의 key가 있는 항목을 주장으로 (결정 94) */
function pushClaims(
  o: ApplyInput,
  rev: RequirementsRevision,
  next: NextIds,
  withEvidence: (v: unknown) => unknown,
  sections?: readonly string[],
) {
  for (const [section, value] of Object.entries(o.result)) {
    if (NOT_CLAIMS.has(section) || !Array.isArray(value)) continue
    if (sections && !sections.includes(section)) continue
    for (const item of value) {
      if (!item || typeof item !== 'object' || typeof (item as { key?: unknown }).key !== 'string')
        continue
      rev.claims.push({
        id: claimId(next.claim++),
        unit: o.unit.id,
        run: o.run,
        section,
        key: (item as { key: string }).key,
        body: withEvidence(item) as Record<string, unknown>,
      })
    }
  }
}

interface Proposal {
  key: string
  purpose: string
  lens: Unit['lens']
  scope: string
  priority: Unit['priority']
  depends_on: string[]
  reason: string
}

/**
 * 제안한 단위를 trace 단위로 (결정 95). 렌즈·범위가 같은 단위가 이미 있으면(끝난 것도) 새로 만들지 않고 그 단위를
 * 가리킨다 (결정 37, 103). 지역 key → 전역 ID를 돌려준다
 */
function pushUnits(
  o: ApplyInput,
  rev: RequirementsRevision,
  next: NextIds,
  proposed: readonly Proposal[],
  warnings: string[],
): Map<string, string> {
  const byScope = new Map<string, UnitState>(
    o.state.units
      .filter((u) => u.id !== o.unit.id && u.status !== 'merged' && u.kind === 'trace')
      .map((u) => [`${u.lens}|${scopeKey(u.scope)}`, u] as const),
  )
  const localToId = new Map<string, string>()
  const fresh: Unit[] = []
  for (const p of proposed) {
    const k = `${p.lens}|${scopeKey(p.scope)}`
    const same = byScope.get(k)
    if (same) {
      localToId.set(p.key, same.id)
      warnings.push(
        same.status === 'open'
          ? `후속 단위 ${p.key}(${p.lens})는 열린 단위 ${same.id}와 렌즈·범위가 같아 합쳤다`
          : `후속 단위 ${p.key}(${p.lens})는 끝난 단위 ${same.id}(${same.status})와 렌즈·범위가 같아 새로 만들지 않았다`,
      )
      continue
    }
    const id = unitId(next.unit++)
    localToId.set(p.key, id)
    const unit: Unit = {
      id,
      kind: 'trace',
      lens: p.lens,
      purpose: p.purpose,
      scope: p.scope,
      priority: p.priority,
      depends_on: [],
      reason: p.reason,
      from: { run: o.run, key: p.key },
    }
    fresh.push(unit)
    byScope.set(k, {
      ...unit,
      status: 'open',
      reason: '',
      run: null,
      checkpoint: null,
      checklist: null,
      revision: rev.number,
    })
  }
  for (const p of proposed) {
    const u = fresh.find((f) => f.from?.key === p.key)
    if (!u) continue
    u.depends_on = [
      ...new Set(p.depends_on.map((d) => localToId.get(d)).filter((x): x is string => !!x)),
    ].filter((d) => d !== u.id)
  }
  rev.units.push(...fresh)
  return localToId
}

/** 사람 결정 (결정 7): refs가 가리키는 이 결과의 단위를 기다리게 한다 */
function pushDecisions(
  o: ApplyInput,
  rev: RequirementsRevision,
  next: NextIds,
  decisions: readonly {
    key: string
    trigger: HumanDecision['trigger']
    question: string
    options: string[]
    refs: string[]
  }[],
  localToId: Map<string, string>,
) {
  for (const d of decisions) {
    const blocks = [...new Set(d.refs.map((r) => localToId.get(r)).filter((x): x is string => !!x))]
    rev.decisions.push({
      id: decisionId(next.decision++),
      unit: o.unit.id,
      run: o.run,
      key: d.key,
      trigger: d.trigger,
      question: d.question,
      options: d.options,
      blocks,
    })
  }
}

/** 이 단위의 상태 바꿈. outcome이 없는 결과(summarize)는 done이다 */
function pushUpdate(
  o: ApplyInput,
  rev: RequirementsRevision,
  checklist: Record<string, unknown> | null,
): boolean {
  const r = o.result as { outcome?: string; outcome_reason?: string; checkpoint?: unknown }
  const outcome = r.outcome ?? 'done'
  const closed = outcome !== 'incomplete'
  rev.unit_updates.push({
    id: o.unit.id,
    status: closed ? (outcome as UnitStatus) : 'open',
    reason: r.outcome_reason ?? '',
    run: o.run,
    checkpoint: closed ? null : ((r.checkpoint as Record<string, unknown> | null) ?? null),
    checklist,
  })
  return closed
}

/** 성공한 run의 결과를 revision 변경분으로 (결정 34, 35, 94, 95, AI 결정 107~113). 단위의 종류로 나눈다 */
export function applyResult(o: ApplyInput): ApplyOutput {
  const next = { ...o.next, link: o.next.link ?? 1 }
  const rev = revision(next.revision, o.at, { kind: 'run', run: o.run, note: '' })
  next.revision++
  const warnings: string[] = []
  const { withEvidence, idsOf } = evidenceMapper(o, rev, next)
  let closed: boolean
  if (o.unit.kind === 'integrate') {
    const r = o.result as ExtractIntegrate
    // 연결 (AI 결정 110): 상태를 바꾸지 않는다
    for (const l of r.links ?? []) {
      rev.links = rev.links ?? []
      rev.links.push({
        id: linkId(next.link++),
        run: o.run,
        kind: l.kind,
        from: [...l.from],
        to: [...l.to],
        reason: l.reason,
        evidence: idsOf(l.anchors),
      })
    }
    pushClaims(o, rev, next, withEvidence, ['unknowns'])
    const localToId = pushUnits(o, rev, next, r.units ?? [], warnings)
    pushDecisions(o, rev, next, r.human_decisions ?? [], localToId)
    closed = pushUpdate(o, rev, (withEvidence(r.coverage) as Record<string, unknown>) ?? null)
    // review 묶음 (AI 결정 112): 아직 묶지 않은 생산 run의 주장 가운데 연결로 접히지 않은 것
    const folded = foldedBy([...o.state.links, ...(rev.links ?? [])])
    const queued = queuedForReview(o.state)
    const producing = new Set(
      o.state.units.filter((u) => PRODUCING.includes(u.kind)).map((u) => u.id),
    )
    const candidates = o.state.claims.filter(
      (c) => producing.has(c.unit) && !queued.has(c.id) && !folded.has(c.id),
    )
    for (const batch of reviewBatches(candidates))
      rev.units.push(
        appUnit(
          'review',
          unitId(next.unit++),
          o.state,
          batch.map((c) => c.id),
        ),
      )
  } else if (o.unit.kind === 'review') {
    const r = o.result as ExtractReview & {
      answers: Record<string, BlindAnswer & { anchors: unknown[] }>
      verdicts: Record<
        string,
        {
          verdict: 'refuted' | 'overclaimed' | 'needs_more' | 'not_refuted'
          attempts: string[]
          anchors: unknown[]
          note: string
        }
      >
    }
    const byId = new Map(o.state.claims.map((c) => [c.id, c]))
    const claims = (o.unit.claims ?? []).flatMap((id) => {
      const c = byId.get(id)
      return c ? [c] : []
    })
    const confirmed = configsOf(o.state)
      .filter((c) => c.status === 'confirmed')
      .map((c) => String(c.name))
    for (const it of reviewItems(claims)) {
      const claim = byId.get(it.claim)
      if (!claim) continue
      if (it.kind === 'statement') {
        const v = r.verdicts?.[it.key]
        if (!v) continue
        rev.reviews = rev.reviews ?? []
        rev.reviews.push({
          claim: it.claim,
          run: o.run,
          unit: o.unit.id,
          item: it.key,
          kind: 'statement',
          result: v.verdict,
          status: VERDICT_STATUS[v.verdict] ?? null,
          note: [v.note, v.attempts.length ? `시도: ${v.attempts.join('; ')}` : '']
            .filter(Boolean)
            .join(' — '),
          evidence: idsOf(v.anchors),
        })
      } else {
        const a = r.answers?.[it.key]
        if (!a) continue
        const cmp = compareAnswer(claim, it.kind, a, confirmed)
        rev.reviews = rev.reviews ?? []
        rev.reviews.push({
          claim: it.claim,
          run: o.run,
          unit: o.unit.id,
          item: it.key,
          kind: it.kind,
          result: cmp.result,
          status: cmp.result === 'conflict' ? 'conflict' : null,
          note: [cmp.note, a.text].filter(Boolean).join(' — '),
          evidence: idsOf(a.anchors),
        })
      }
    }
    pushClaims(o, rev, next, withEvidence, ['unknowns'])
    closed = pushUpdate(o, rev, null)
  } else if (o.unit.kind === 'summarize') {
    const r = o.result as ExtractSummarize
    rev.summary = {
      run: o.run,
      overview: r.overview.map((p) => ({ text: p.text, ids: [...p.ids] })),
      handoff_summary: { text: r.handoff_summary.text, ids: [...r.handoff_summary.ids] },
      risks: r.risks.map((p) => ({ text: p.text, ids: [...p.ids] })),
    }
    closed = pushUpdate(o, rev, null)
  } else {
    pushClaims(o, rev, next, withEvidence)
    const res = o.result as { units?: Proposal[]; followups?: Proposal[] }
    const localToId = pushUnits(o, rev, next, res.units ?? res.followups ?? [], warnings)
    pushDecisions(
      o,
      rev,
      next,
      (o.result as { human_decisions?: Parameters<typeof pushDecisions>[3] }).human_decisions ?? [],
      localToId,
    )
    if (o.unit.kind === 'survey') buildIndexDecision(o, rev, next, [...localToId.values()])
    const checklist = (o.result as { checklist?: Record<string, unknown> }).checklist ?? null
    closed = pushUpdate(o, rev, checklist)
  }
  return { revision: rev, next, warnings, closed }
}

// ---------------------------------------------------------------------------------------------------------------
// 구성별 빌드 인덱스 (AI 결정 118)

/** survey 결과의 빌드 명령이 있는 확정 구성 */
export function buildTargets(configs: readonly Record<string, unknown>[]): BuildTarget[] {
  return configs
    .filter((c) => c.status === 'confirmed' && typeof c.build_command === 'string')
    .map((c) => ({ name: String(c.name), command: String(c.build_command).trim() }))
    .filter((t) => t.command)
}

/** 빌드 명령이 make 계열인가: 앞의 변수 대입(`CC=x`)을 건너뛴 첫 낱말이 make, gmake, mingw32-make (경로 포함) */
export function isMakeCommand(command: string): boolean {
  const first = command
    .trim()
    .split(/\s+/)
    .find((w) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w))
  return /(^|[\\/])(g?make|mingw32-make)(\.exe)?$/i.test(first ?? '')
}

/**
 * 빌드 인덱스를 만들어도 되는지 묻는 앱의 결정 (AI 결정 118): survey가 빌드 명령이 있는 확정 구성을 냈고 이 계보에서 아직
 * 묻지 않았으면, 그 명령들을 보이고 묻는다. 답을 받을 때까지 그 survey가 낸 단위를 기다리게 한다(인덱스가 생기면 survey를
 * 다시 돌 수 있어, trace보다 먼저 정한다). make 계열 명령이 하나도 없으면 묻지 않고 "만들 수 없음"으로 남긴다
 */
function buildIndexDecision(
  o: ApplyInput,
  rev: RequirementsRevision,
  next: NextIds,
  blocks: string[],
) {
  if (o.state.build_index || o.state.decisions.some((d) => d.kind === 'build_index')) return
  const targets = buildTargets((o.result as { configs?: Record<string, unknown>[] }).configs ?? [])
  if (!targets.length) return
  if (!targets.some((t) => isMakeCommand(t.command))) {
    rev.build_index = {
      status: 'unavailable',
      configs: [],
      file: null,
      detail: `make 계열 빌드 명령이 없음(${targets.map((t) => `${t.name}: ${t.command}`).join('; ')})`,
    }
    return
  }
  rev.decisions.push({
    id: decisionId(next.decision++),
    unit: o.unit.id,
    run: o.run,
    key: 'build_index',
    trigger: 'toolchain_material',
    question: [
      '구성별 빌드 인덱스를 만들까요? 허용하면 앱이 Work 디렉터리 아래 기준 커밋의 별도 체크아웃(분석 worktree가 아님)에서 구성마다 아래 빌드 명령을 한 번 돌리고, make 계열이면 `-n -B`로 모은 컴파일 명령으로 소스마다 전처리·컴파일해 구성마다 정의된 심볼과 컴파일되는 줄을 모읍니다. survey의 구성 주장을 이것으로 검사합니다.',
      ...targets.map((t) => `- ${t.name}: \`${t.command}\``),
    ].join('\n'),
    options: [BUILD_ALLOW, BUILD_DENY],
    blocks,
    kind: 'build_index',
  })
}

export const BUILD_ALLOW = '허용'
export const BUILD_DENY = '허용하지 않음'

/** 빌드 인덱스 결정의 답이 허용인가: "허용"으로 시작하되 "허용하지"는 아니다(영어 yes, allow도) */
export function allowsBuild(answer: string): boolean {
  const a = answer.trim()
  return /^허용(?!하지)/.test(a) || /^(yes|allow)\b/i.test(a)
}

/**
 * 지금 할 빌드 인덱스 일 (AI 결정 118): 답한 빌드 인덱스 결정이 있고 이 계보에 아직 빌드 인덱스 상태가 없을 때. 허용이면
 * 만들 구성, 아니면 거절. 그 밖에는 null
 */
export function buildIndexWork(
  state: RequirementsState,
): { kind: 'build'; targets: BuildTarget[] } | { kind: 'denied'; answer: string } | null {
  if (state.build_index) return null
  const d = state.decisions.find((x) => x.kind === 'build_index' && x.answer)
  if (!d?.answer) return null
  if (!allowsBuild(d.answer.answer)) return { kind: 'denied', answer: d.answer.answer }
  return { kind: 'build', targets: buildTargets(configsOf(state)) }
}

/** 지금 survey의 inventory를 결과 꼴로 (앵커는 근거에서 되살린다). config_active 뒤 검사가 읽는다 */
export function surveyInventory(state: RequirementsState): {
  inventory: Record<string, unknown>[]
} {
  const ev = new Map(state.evidence.map((e) => [e.id, e]))
  const anchors = (v: unknown) =>
    (Array.isArray(v) ? v : []).flatMap((a) => {
      const e = ev.get(String((a as { evidence?: unknown } | null)?.evidence ?? ''))
      return e ? [{ kind: e.kind, path: e.path, start: e.start, end: e.end }] : []
    })
  return {
    inventory: currentClaims(state, 'inventory').map((c) => ({
      ...c.body,
      key: c.id,
      anchors: anchors(c.body.anchors),
    })),
  }
}

/**
 * 빌드 인덱스 상태의 revision (AI 결정 118). 만든 인덱스와 지금 survey의 목록이 맞지 않으면(problems) 그 survey 단위를 문제와
 * 함께 다시 연다. 다시 연 survey의 제출은 config_active로 검사한다
 */
export function buildIndexRevision(
  state: RequirementsState,
  next: NextIds,
  at: string,
  o: NonNullable<RequirementsRevision['build_index']> & { problems: readonly string[] },
): { revision: RequirementsRevision; next: NextIds; reopened: string | null } {
  const { problems, ...build_index } = o
  const rev = revision(next.revision, at, {
    kind: 'app',
    run: null,
    note: `빌드 인덱스: ${build_index.status}${problems.length ? `, 목록 문제 ${problems.length}건으로 survey를 다시 엶` : ''}`,
  })
  rev.build_index = build_index
  const survey = [...state.units].reverse().find((u) => u.kind === 'survey')
  let reopened: string | null = null
  if (problems.length && survey) {
    reopened = survey.id
    rev.unit_updates.push({
      id: survey.id,
      status: 'open',
      reason: `빌드 인덱스와 맞지 않는 목록 항목 ${problems.length}건`,
      run: null,
      checkpoint: { build_index: [...problems] },
      checklist: null,
    })
  }
  return { revision: rev, next: { ...next, revision: next.revision + 1 }, reopened }
}

/**
 * 답을 받은 결정으로 다시 열 단위 (결정 103): 결정이 기다리게 한 단위(blocks) 가운데 이미 끝난 것, blocks가 없으면 결정을
 * 낸 단위가 이미 끝났을 때 그 단위. 열린 단위는 답을 받고 어차피 돌고, 합쳐진 단위는 받은 단위가 대신한다
 */
export function reopenTargets(
  state: RequirementsState,
  answers: readonly { decision: string }[],
): { unit: string; decision: string }[] {
  const units = new Map(state.units.map((u) => [u.id, u]))
  const out: { unit: string; decision: string }[] = []
  for (const a of answers) {
    const d = state.decisions.find((x) => x.id === a.decision)
    // 빌드 인덱스 결정의 답은 단위를 다시 열지 않는다: 인덱스를 만든 뒤 검사가 정한다 (AI 결정 118)
    if (!d || d.answer || d.kind === 'build_index') continue
    for (const id of d.blocks.length ? d.blocks : [d.unit]) {
      const u = units.get(id)
      if (!u || u.status === 'open' || u.status === 'merged') continue
      if (!out.some((x) => x.unit === id)) out.push({ unit: id, decision: d.id })
    }
  }
  return out
}

/** 사람 답을 revision으로 (결정 41). 답으로 다시 볼 끝난 단위를 같은 revision에서 연다 (결정 103) */
export function answerRevision(
  state: RequirementsState,
  next: NextIds,
  answers: RequirementsRevision['answers'],
  at: string,
): { revision: RequirementsRevision; next: NextIds } {
  const reopen = reopenTargets(state, answers)
  const note = reopen.length
    ? `사람 결정 필요의 답. 다시 연 단위 ${reopen.map((r) => r.unit).join(', ')}`
    : '사람 결정 필요의 답'
  const rev = revision(next.revision, at, { kind: 'human', run: null, note })
  rev.answers.push(...answers)
  for (const r of reopen)
    rev.unit_updates.push({
      id: r.unit,
      status: 'open',
      reason: `사람 결정 ${r.decision}의 답을 받아 다시 연다`,
      run: null,
      checkpoint: null,
      checklist: null,
      decision: r.decision,
    })
  return { revision: rev, next: { ...next, revision: next.revision + 1 } }
}

/** 앱이 단위를 끝내는 revision (결정 6의 failed, 결정 30의 stalled) */
export function closeRevision(
  next: NextIds,
  unit: string,
  status: 'failed' | 'stalled',
  reason: string,
  checkpoint: Record<string, unknown> | null,
  at: string,
): { revision: RequirementsRevision; next: NextIds } {
  const rev = revision(next.revision, at, { kind: 'app', run: null, note: reason })
  rev.unit_updates.push({ id: unit, status, reason, run: null, checkpoint, checklist: null })
  return { revision: rev, next: { ...next, revision: next.revision + 1 } }
}

/**
 * [범위 줄이고 계속] (결정 26, AI 결정 114): 고른 열린 단위를 사람이 범위에서 뺀다. 메모는 뒤 패킷의 "Notes from a
 * person"에 들어간다. 열린 단위가 아닌 id는 무시한다
 */
export function scopeRevision(
  state: RequirementsState,
  next: NextIds,
  units: readonly string[],
  note: string,
  at: string,
): { revision: RequirementsRevision; next: NextIds; units: string[] } {
  const open = new Set(openUnits(state).map((u) => u.id))
  const picked = [...new Set(units)].filter((id) => open.has(id))
  const text = note.trim() || '(메모 없음)'
  const rev = revision(next.revision, at, {
    kind: 'human',
    run: null,
    note: `범위 줄이기: ${picked.join(', ') || '없음'}`,
  })
  for (const id of picked)
    rev.unit_updates.push({
      id,
      status: 'out_of_scope',
      reason: `사람이 범위에서 뺌: ${text}`,
      run: null,
      checkpoint: null,
      checklist: null,
    })
  rev.notes = [{ at, by: 'human', text, units: picked }]
  return { revision: rev, next: { ...next, revision: next.revision + 1 }, units: picked }
}

/**
 * 되감기로 시작한 extract task가 기록을 이어받는 revision (결정 120). parent는 지금 포인터의 revision이다.
 * - 이어서([현재 기록 위에서 이어서]): 지금 기록 위의 사람 revision. 추가 지시를 메모로 두고, 부분 분석으로 보류한 단위를
 *   다시 열고, 열린 integrate가 없으면 integrate 단위를 연다(지시를 단위로 바꾸는 몫)
 * - 처음부터: parent 없는 새 시작 revision(survey 단위 하나). 추가 지시가 있으면 메모로 둔다
 */
export function rewindRevision(
  state: RequirementsState,
  next: NextIds,
  opts: { keep: boolean; instruction: string | null; at: string; parent: number },
): { revision: RequirementsRevision; next: NextIds } {
  const text = opts.instruction?.trim() ?? ''
  const notes: Note[] = text ? [{ at: opts.at, by: 'human', text, units: [] }] : []
  if (!opts.keep) {
    const r = startRevision(next, opts.at, '되감기: 처음부터')
    if (notes.length) r.revision.notes = notes
    return r
  }
  const rev = revision(
    next.revision,
    opts.at,
    { kind: 'human', run: null, note: '되감기: 현재 기록 위에서 이어서' },
    opts.parent,
  )
  if (notes.length) rev.notes = notes
  for (const u of state.units.filter((x) => x.status === 'held'))
    rev.unit_updates.push({
      id: u.id,
      status: 'open',
      reason: '되감기로 다시 엶',
      run: null,
      checkpoint: u.checkpoint,
      checklist: null,
    })
  let unit = next.unit
  if (!openUnits(state).some((u) => u.kind === 'integrate'))
    rev.units.push(appUnit('integrate', unitId(unit++), state))
  return { revision: rev, next: { ...next, unit, revision: next.revision + 1 } }
}

/**
 * 되감기로 연 계보의 포인터 (결정 120): 연속 횟수, 멈춤, 사용량 대기, 반영 대기 답, 열린 결정 수, 내보낸 결과는 비우고
 * run 수와 늘린 양은 Work의 소비 기록이라 그대로 둔다
 */
export function rewoundPointer(p: RequirementsPointer, taskId: string): RequirementsPointer {
  return {
    revision: p.revision,
    revision_hash: p.revision_hash,
    next: p.next,
    runs_used: p.runs_used,
    runs_extra: p.runs_extra,
    failures_in_row: 0,
    streaks: {},
    task: taskId,
  }
}

/**
 * [부분 분석으로 넘기기] (결정 26, AI 결정 114): 열린 단위를 보류(held)로 닫고 summarize 단위를 연다(이미 열려 있으면 그것).
 * summarize 하나만 상한 밖에서 돈다. 답하지 않은 결정은 막지 않는다
 */
export function partialRevision(
  state: RequirementsState,
  next: NextIds,
  at: string,
): { revision: RequirementsRevision; next: NextIds } {
  const rev = revision(next.revision, at, { kind: 'human', run: null, note: '부분 분석으로 넘김' })
  const open = openUnits(state)
  for (const u of open.filter((x) => x.kind !== 'summarize'))
    rev.unit_updates.push({
      id: u.id,
      status: 'held',
      reason: '보류: 예산 상한(사람이 부분 분석으로 넘김)',
      run: null,
      checkpoint: u.checkpoint,
      checklist: null,
    })
  let unit = next.unit
  if (!open.some((u) => u.kind === 'summarize'))
    rev.units.push(appUnit('summarize', unitId(unit++), state))
  return { revision: rev, next: { ...next, unit, revision: next.revision + 1 } }
}

// ---------------------------------------------------------------------------------------------------------------
// 연속 횟수와 멈춤 (결정 6, 24, 30, 40)

/** run 하나의 결말: 성공해 단위가 끝남, 성공했지만 미완료, 실패, 세지 않음(사용량 한도, 사람의 중단) */
export type RunEnd = 'closed' | 'incomplete' | 'failed' | 'uncounted'

export interface StreakOutcome {
  pointer: RequirementsPointer
  /** 앱이 이 단위를 끝낸다 */
  close: 'failed' | 'stalled' | null
  /** 전체를 멈춘다 */
  halt: HaltReason | null
}

/** run 하나가 끝난 뒤 run 수와 연속 횟수를 고친다 */
export function afterRun(
  pointer: RequirementsPointer,
  unit: string,
  end: RunEnd,
  budget: RequirementsBudget,
): StreakOutcome {
  const p: RequirementsPointer = { ...pointer, streaks: { ...pointer.streaks } }
  if (end === 'uncounted') return { pointer: p, close: null, halt: null }
  p.runs_used++
  const s = { ...(p.streaks[unit] ?? { failures: 0, incompletes: 0 }) }
  let close: StreakOutcome['close'] = null
  const drop = () => {
    p.streaks = Object.fromEntries(Object.entries(p.streaks).filter(([k]) => k !== unit))
  }
  if (end === 'closed') {
    drop()
    p.failures_in_row = 0
  } else if (end === 'incomplete') {
    s.incompletes++
    p.failures_in_row = 0
    p.streaks[unit] = s
    if (s.incompletes >= budget.unit_incompletes) close = 'stalled'
  } else {
    s.failures++
    p.failures_in_row++
    p.streaks[unit] = s
    if (s.failures >= budget.unit_failures) close = 'failed'
  }
  if (close) drop()
  const halt = p.failures_in_row >= budget.failures_in_row ? 'failures' : null
  return { pointer: p, close, halt }
}

/** run 상한 (결정 24, 31): 앱 설정 + 늘린 양 */
export const runLimit = (p: RequirementsPointer, b: RequirementsBudget) =>
  b.run_limit + p.runs_extra

// ---------------------------------------------------------------------------------------------------------------
// run 판정 (15.3, 결정 29, 37, 39, 97, 17.12의 D129 run용 판정)

export interface RunFacts {
  /** 사람이 [즉시 중단]했거나 앱이 꺼지며 끝냈다 */
  stoppedByApp: boolean
  timedOut: boolean
  exitCode: number | null
  /** stream-json의 result 메시지 */
  result: { is_error?: boolean; subtype?: string; structured_output?: unknown } | null
  schemaValid: boolean
  /** 마지막 Stop 훅 본문 */
  lastStop: Record<string, unknown> | null
  usageLimit: { type: string | null; resetsAt: number | null } | null
  worktreeChanged: boolean
  inputRevision: number
  currentRevision: number
  /** 반영 검사(규칙 표, 기준 커밋 대조)에서 남은 문제 */
  applyProblems: string[]
}

export type RunVerdict =
  { ok: true } | { ok: false; failure: string; end: RunEnd; halt?: HaltReason; waitUntil?: number }

/** run이 성공했는가 (15.3). 실패면 까닭과 셈(결정 40), 멈춤(결정 29, 39) */
export function judgeRun(f: RunFacts): RunVerdict {
  if (f.worktreeChanged)
    return { ok: false, failure: 'worktree_changed', end: 'uncounted', halt: 'source_changed' }
  if (f.stoppedByApp) return { ok: false, failure: 'stopped', end: 'uncounted' }
  if (f.usageLimit) {
    const weekly = /seven_day|weekly/.test(f.usageLimit.type ?? '')
    if (weekly || !f.usageLimit.resetsAt)
      return { ok: false, failure: 'usage_limit', end: 'uncounted', halt: 'usage_weekly' }
    return { ok: false, failure: 'usage_limit', end: 'uncounted', waitUntil: f.usageLimit.resetsAt }
  }
  const fail = (failure: string): RunVerdict => ({ ok: false, failure, end: 'failed' })
  if (f.timedOut) return fail('hard_timeout')
  if (f.exitCode !== 0) return fail(`exit_${f.exitCode}`)
  if (!f.result) return fail('no_result')
  if (f.result.is_error) return fail(`error_${f.result.subtype ?? 'unknown'}`)
  if (!f.result.structured_output) return fail('no_structured_output')
  if (!f.schemaValid) return fail('schema')
  const stop = f.lastStop
  if (!stop || !Array.isArray(stop.background_tasks) || !Array.isArray(stop.session_crons))
    return fail('stop_fields_missing')
  if (stop.background_tasks.length || stop.session_crons.length) return fail('background_tasks')
  if (f.inputRevision !== f.currentRevision) return fail('stale_revision')
  if (f.applyProblems.length) return fail('apply_check')
  return { ok: true }
}

// ---------------------------------------------------------------------------------------------------------------
// 기준 커밋의 인용 대조 (규칙 path_at_base, quote_match, 결정 13, 37)

/** 인용 비교용: Read 출력의 줄 번호 머리를 떼고 공백을 하나로 (평가 채점기와 같은 규칙) */
export function normQuote(q: string): string {
  return String(q ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/^\s*\d+(\t|→|:\s)/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function includesInOrder(hay: string, quote: string): boolean {
  const parts = quote
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return false
  let at = 0
  for (const p of parts) {
    const i = hay.indexOf(p, at)
    if (i < 0) return false
    at = i + p.length
  }
  return true
}

/** ASCII 뼈대로 대조할 때 남아야 하는 ASCII 글자 수(공백 빼고, AI 결정 123) */
export const ASCII_MIN = 8

/** ASCII가 아닌 글자를 빼고 공백을 정규화한 글 */
const asciiSkeleton = (s: string) => normQuote(s.replace(/[^\t\n\r\x20-\x7E]/g, ''))

/**
 * 비 UTF-8 파일의 인용 대조 (AI 결정 123): 기준 커밋 파일이 UTF-8이 아니거나(디코드에 U+FFFD) 인용에 U+FFFD가 있으면 양쪽에서
 * ASCII가 아닌 글자를 빼고 차례대로 대조한다. 남은 인용의 ASCII(공백 빼고)가 ASCII_MIN자보다 짧으면 맞음으로 보지 않는다.
 * 코드 부분(ASCII)은 그대로 대조하므로 지어낸 앵커는 여전히 걸린다
 */
export function asciiMatch(file: string, range: string, rawQuote: string): boolean {
  if (!file.includes('\uFFFD') && !String(rawQuote ?? '').includes('\uFFFD')) return false
  const quote = asciiSkeleton(rawQuote)
  if (quote.replace(/\s/g, '').length < ASCII_MIN) return false
  return includesInOrder(asciiSkeleton(range), quote)
}

/** 인용의 첫 조각이 시작하는 줄(1부터). 줄 처음부터의 인용이 아니면 그 조각의 앞부분이 든 첫 줄. 없으면 null */
function lineOf(lines: string[], quote: string): number | null {
  const first = quote
    .split(/\s*(?:\.\.\.|…)\s*/)
    .find((p) => p.trim())
    ?.trim()
  if (!first) return null
  const head = first.slice(0, 40)
  for (const [i, l] of lines.entries())
    if (l.trim() && normQuote(lines.slice(i, i + 50).join('\n')).startsWith(head)) return i + 1
  const part = first.slice(0, 30)
  for (const [i, l] of lines.entries()) if (normQuote(l).includes(part)) return i + 1
  return null
}

/**
 * 인용이 앵커의 줄 범위에 있는가. 아니면 고칠 곳을 알리는 글(결정 13: 그 줄의 실제 내용과 인용이 실제로 있는 줄).
 * where는 문제 글에서 파일을 가리키는 이름이다
 */
function quoteProblem(at: string, where: string, text: string, anchor: Anchor): string | null {
  const quote = normQuote(anchor.quote)
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const s = Math.max(1, Number(anchor.start) || 1)
  const e = Math.max(s, Number(anchor.end) || s)
  if (quote && includesInOrder(normQuote(lines.slice(s - 1, e).join('\n')), quote)) return null
  if (asciiMatch(text, lines.slice(s - 1, e).join('\n'), anchor.quote)) return null
  const found = quote && includesInOrder(normQuote(text), quote) ? lineOf(lines, quote) : null
  const actual = normQuote(lines.slice(s - 1, Math.min(e, s + 2)).join('\n')).slice(0, 120)
  return found
    ? `${at}: ${where}:${s}-${e} reads "${actual}"; the quote is at line ${found}`
    : `${at}: ${where}:${s}-${e} reads "${actual}"; the quote is not in this file`
}

/**
 * code 앵커의 경로가 기준 커밋에 있고 인용이 그 줄에 있는가 (결정 37, 42: 경로 검사는 code 근거만). readFile은 기준
 * 커밋의 그 경로 내용(없으면 null)
 */
export function codeAnchorProblems(
  result: unknown,
  repo: string,
  readFile: (path: string) => string | null,
): { rule: 'path_at_base' | 'quote_match'; problem: string }[] {
  const out: { rule: 'path_at_base' | 'quote_match'; problem: string }[] = []
  for (const { at, anchor } of anchorsOf(result)) {
    if (anchor.kind !== 'code') continue
    const rel = repoPath(anchor.path, repo)
    const text = readFile(rel)
    if (text === null) {
      out.push({ rule: 'path_at_base', problem: `${at}: ${rel} is not in the base commit` })
      continue
    }
    const problem = quoteProblem(at, rel, text, anchor)
    if (problem) out.push({ rule: 'quote_match', problem })
  }
  return out
}

/**
 * tool_output 앵커의 인용이 출력 파일의 그 줄에 있는가 (결정 101). readOutput은 앵커가 적은 출력 파일의 내용이고,
 * 앱이 requirements/outputs/에 둘 사본과 같은 바이트다(결정 42). 파일이 없으면 근거가 깨지므로(결정 2) 이것도 문제다.
 * 규칙 id는 quote_match 그대로다(L1의 앱 검사 목록을 바꾸지 않는다)
 */
export function outputAnchorProblems(
  result: unknown,
  readOutput: (path: string) => string | null,
): { rule: 'quote_match'; problem: string }[] {
  const out: { rule: 'quote_match'; problem: string }[] = []
  for (const { at, anchor } of anchorsOf(result)) {
    if (anchor.kind !== 'tool_output') continue
    const text = readOutput(anchor.path)
    const problem =
      text === null
        ? `${at}: the output file ${anchor.path} was not found; write the tool output to a file in the scratch directory and cite that file`
        : quoteProblem(at, `output ${anchor.path}`, text, anchor)
    if (problem) out.push({ rule: 'quote_match', problem })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// 패킷 (결정 96)

export interface PacketInput {
  unit: UnitState
  state: RequirementsState
  /** 승인된 intent.md 본문(머리글 없이) */
  intent: string
  repo: string
  base: string
  scratch: string
  budget: RequirementsBudget
}

/** survey만 내는 절. 다시 연 survey는 앞 survey의 것을 다시 낸다 (결정 103) */
const SURVEY_SECTIONS = new Set(['configs', 'inventory', 'boundaries', 'not_found'])

/**
 * 한 절의 지금 주장. survey만 내는 절은 마지막 survey run의 것만이다(앞 run의 것은 기록에 남는다, 결정 103). 다른 절은
 * 모든 run의 것이다
 */
export function currentClaims(state: RequirementsState, section: string): Claim[] {
  const of = state.claims.filter((c) => c.section === section)
  if (!SURVEY_SECTIONS.has(section)) return of
  const last = state.claims.filter((c) => SURVEY_SECTIONS.has(c.section)).at(-1)?.run
  return of.filter((c) => c.run === last)
}

/**
 * 미확정이 가리킨 뒤 단위 (결정 104): 미확정의 refs가 같은 run이 낸 단위 제안의 key를 가리키면 그 제안으로 만든 단위.
 * run은 다른 run의 항목을 가리킬 수 없어(지역 key) 앱이 이을 수 있는 것은 이것뿐이다. 미확정을 닫지는 않는다
 */
export function followingUnits(state: RequirementsState, claim: Claim): UnitState[] {
  const refs = Array.isArray(claim.body.refs)
    ? (claim.body.refs as unknown[]).filter((r): r is string => typeof r === 'string')
    : []
  return state.units.filter((u) => u.from && u.from.run === claim.run && refs.includes(u.from.key))
}

/** 단위를 낸 run이 그 단위 제안에 이은 미확정 (결정 104). 그 단위의 패킷에 질문으로 들어간다 */
export function linkedUnknowns(state: RequirementsState, unit: UnitState): Claim[] {
  return state.claims.filter(
    (c) => c.section === 'unknowns' && followingUnits(state, c).some((u) => u.id === unit.id),
  )
}

/** survey가 낸 구성 (주장의 configs 절) */
export function configsOf(state: RequirementsState): Record<string, unknown>[] {
  return currentClaims(state, 'configs').map((c) => c.body)
}

/** 지금 coverage: 마지막으로 끝난 integrate 단위의 coverage 원문 (AI 결정 111) */
export function currentCoverage(state: RequirementsState): Record<string, unknown[]> | null {
  const last = [...state.units]
    .filter((u) => u.kind === 'integrate' && u.status === 'done' && u.checklist)
    .sort((a, b) => a.revision - b.revision)
    .at(-1)
  return (last?.checklist as Record<string, unknown[]> | undefined) ?? null
}

/** 부분 분석인가: 보류(held) 단위가 있다 (결정 26, AI 결정 114) */
export const isPartial = (state: RequirementsState) => state.units.some((u) => u.status === 'held')

/** 접은 기록을 세 종류(integrate, review, summarize)의 패킷 모듈이 읽는 꼴로 (AI 결정 109) */
export function recordOf(state: RequirementsState): PacketRecord {
  return {
    configs: configsOf(state).map((c) => ({
      name: String(c.name),
      status: String(c.status),
      select: String(c.select ?? ''),
      build_command: typeof c.build_command === 'string' ? c.build_command : null,
    })),
    units: state.units.map((u) => ({
      id: u.id,
      kind: u.kind,
      lens: u.lens,
      purpose: u.purpose,
      scope: u.scope,
      status: u.status,
      reason: u.reason,
    })),
    claims: state.claims.map((c) => ({ ...c })),
    evidence: state.evidence.map((e) => ({
      id: e.id,
      kind: e.kind,
      path: e.path,
      start: e.start,
      end: e.end,
      command: e.command,
    })),
    decisions: state.decisions.map((d) => ({
      id: d.id,
      trigger: d.trigger,
      question: d.question,
      answer: d.answer?.answer ?? null,
    })),
    links: state.links.map((l) => ({ ...l })),
    reviews: state.reviews.map((r) => ({
      claim: r.claim,
      result: r.result,
      status: r.status,
      note: r.note,
    })),
    coverage: currentCoverage(state),
    partial: isPartial(state),
    build_index: state.build_index
      ? { status: state.build_index.status, detail: state.build_index.detail }
      : null,
    notes: state.notes.map((n) => ({ at: n.at, text: n.text })),
  }
}

/** run에 넘길 패킷과 따로 쓸 파일: integrate의 기록 목록, review의 질문·서술 키 (AI 결정 109, 112) */
export interface RunPacket {
  packet: string
  /** integrate: run 디렉터리에 둘 기록 목록 */
  listing: string | null
  /** review: 결과 스키마 answers·verdicts의 키 */
  keys: { answers: string[]; verdicts: string[] } | null
}

/**
 * 단위의 종류로 패킷을 만든다. survey·trace는 renderPacket, 나머지는 skills/extract/packets.mjs다. listingPath는 integrate의
 * 기록 목록을 둘 경로(run 디렉터리)다
 */
export function buildPacket(o: PacketInput & { listingPath: string }): RunPacket {
  const k = o.unit.kind
  if (k === 'survey' || k === 'trace') return { packet: renderPacket(o), listing: null, keys: null }
  const record = recordOf(o.state)
  const common = {
    intent: o.intent,
    soft: o.budget.soft_minutes,
    hard: o.budget.hard_minutes,
    record,
    scratch: o.scratch,
  }
  if (k === 'integrate')
    return {
      packet: renderIntegratePacket({
        ...common,
        repo: o.repo,
        base: o.base,
        listing: o.listingPath,
        since: producingSince(o.state).map((r) => r.id),
      }),
      listing: recordListing(record),
      keys: null,
    }
  if (k === 'review') {
    const ids = new Set(o.unit.claims ?? [])
    const { packet, items } = renderReviewPacket({
      ...common,
      repo: o.repo,
      base: o.base,
      claims: record.claims.filter((c) => ids.has(c.id)),
    })
    return {
      packet,
      listing: null,
      keys: {
        answers: items.filter((i) => i.kind !== 'statement').map((i) => i.key),
        verdicts: items.filter((i) => i.kind === 'statement').map((i) => i.key),
      },
    }
  }
  return { packet: renderSummarizePacket(common), listing: null, keys: null }
}

/** run의 패킷 (평가의 손으로 쓴 패킷과 같은 꼴, 결정 96) */
export function renderPacket(o: PacketInput): string {
  const u = o.unit
  const title = u.kind === 'survey' ? 'survey' : `trace (lens: ${u.lens})`
  const out = [
    `# Packet: ${title}`,
    '',
    '## Source',
    '',
    `- Repository (read-only): ${o.repo}`,
    `- Base commit: ${o.base}`,
    `- Scratch directory (you may write here): ${o.scratch}`,
    '',
    '## Intent',
    '',
    o.intent.trim(),
    '',
  ]
  const configs = configsOf(o.state)
  if (u.kind === 'trace' && configs.length) {
    out.push('## Configurations (from the survey)', '')
    for (const c of configs) {
      const cmd = c.build_command ? `\`${String(c.build_command)}\`` : 'build command unknown'
      out.push(`- ${String(c.name)} (${String(c.status)}): ${cmd}; selected by ${String(c.select)}`)
    }
    out.push('')
  }
  out.push('## Unit', '')
  if (u.lens) out.push(`- Lens: ${u.lens}`)
  out.push(`- Purpose: ${u.purpose}`, `- Scope: ${u.scope}`)
  const reopened = u.reopened_by
    ? o.state.decisions.find((d) => d.id === u.reopened_by && d.answer)
    : undefined
  if (reopened?.answer)
    out.push(
      '- This unit was analysed before a human answered a decision about it. Analyse it again with the answer and record what changes:',
      `  - Q: ${reopened.question}`,
      `  - A: ${reopened.answer.answer}`,
    )
  const questions = linkedUnknowns(o.state, u)
  if (questions.length) {
    out.push('- The run that proposed this unit left these questions open about it:')
    for (const q of questions) out.push(`  - ${text(q.body.question ?? '')}`)
  }
  const indexProblems = (u.checkpoint as { build_index?: unknown } | null)?.build_index
  if (Array.isArray(indexProblems)) {
    out.push(
      '- The app built a per-configuration build index from the build commands. These inventory items of the previous survey do not match it. Check their configurations and anchors; the index is checked again when you submit:',
      ...indexProblems.map((p) => `  - ${text(String(p))}`),
    )
  } else if (u.checkpoint) {
    const cp = u.checkpoint as { checked?: string[]; remaining?: string[]; next?: string }
    out.push(
      '- A previous run on this unit stopped early. Continue from its checkpoint:',
      `  - Checked: ${(cp.checked ?? []).join('; ') || '(none)'}`,
      `  - Remaining: ${(cp.remaining ?? []).join('; ') || '(none)'}`,
      `  - Next: ${cp.next ?? '(none)'}`,
    )
  }
  out.push('')
  const answered = o.state.decisions.flatMap((d) =>
    d.answer ? [{ q: d.question, a: d.answer.answer }] : [],
  )
  if (answered.length) {
    out.push('## Human decisions', '')
    for (const d of answered) out.push(`- Q: ${d.q}`, `  A: ${d.a}`)
    out.push('')
  }
  // 사람 메모: 범위 줄이기와 되감기의 추가 지시 (AI 결정 114, 120)
  if (o.state.notes.length) {
    out.push('## Notes from a person', '')
    for (const n of o.state.notes) out.push(`- ${n.text}`)
    out.push('')
  }
  out.push(
    '## Limits',
    '',
    `- Soft deadline: ${o.budget.soft_minutes} minutes. Hard limit: ${o.budget.hard_minutes} minutes.`,
    '',
  )
  return out.join('\n')
}

// ---------------------------------------------------------------------------------------------------------------
// extraction.md와 handoff.md (결정 15, 99)

export const STATUS_LABEL: Readonly<Record<UnitStatus, string>> = {
  open: '열림',
  done: '완료',
  needs_external: '외부 근거 필요',
  out_of_scope: '범위 밖',
  failed: '보류: 연속 실패',
  stalled: '보류: 수렴 안 됨',
  merged: '합쳐짐',
  held: '보류: 예산 상한',
}

const text = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v))
const firstOf = (body: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (typeof body[k] === 'string' && body[k]) return body[k] as string
  return ''
}
const evidenceRefs = (body: unknown, ev: Map<string, Evidence>): string[] => {
  const ids: string[] = []
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') {
      const e = (v as { evidence?: unknown }).evidence
      if (typeof e === 'string' && ev.has(e)) ids.push(e)
      else Object.values(v).forEach(walk)
    }
  }
  walk(body)
  return [...new Set(ids)]
    .flatMap((id) => {
      const e = ev.get(id)
      return e ? [e] : []
    })
    .map((e) =>
      e.kind === 'code' || e.kind === 'doc_claim'
        ? `${e.path}:${e.start}-${e.end}`
        : e.kind === 'tool_output'
          ? `실행${e.command ? ` \`${e.command}\`` : ''} 출력 ${e.path}:${e.start}-${e.end}`
          : `${e.kind} ${e.path}`,
    )
}

const NEEDS_LABEL: Readonly<Record<string, string>> = {
  external_doc: '외부 문서',
  measurement: '측정',
  toolchain: '툴체인',
  other: '기타',
}

const BOUNDARY_LABEL: Readonly<Record<string, string>> = {
  vendor_hal: '벤더 HAL',
  rtos_kernel: 'RTOS 커널',
  third_party: '서드파티',
  generated: '생성 코드',
}

const searchText = (v: unknown): string =>
  Array.isArray(v)
    ? (v as { tool?: unknown; pattern?: unknown; scope?: unknown }[])
        .map((x) => `${text(x.tool ?? '')} \`${text(x.pattern ?? '')}\` (${text(x.scope ?? '')})`)
        .join('; ')
    : ''

/** 검토 상태의 이름 (결정 12: 내리기만 한다) */
const REVIEW_LABEL: Readonly<Record<string, string>> = {
  conflict: '충돌',
  refuted: '반증',
  overclaim: '범위 과장',
  needs_more: '보완 필요',
}

/** 단위 종류의 이름 (표) */
function kindLabel(u: UnitState): string {
  return u.kind === 'trace' ? `trace(${u.lens})` : u.kind
}

/** 단위 목적의 사람용 글: survey와 앱이 만든 단위의 목적은 지시의 영어 문장이라 짧게 보인다 */
function purposeLabel(u: UnitState): string {
  if (u.kind === 'survey') return '구성·진입점·경계를 찾고 분석 단위를 나눈다'
  if (u.kind === 'integrate') return '기록을 잇고 관점·구성별 빈칸을 찾는다'
  if (u.kind === 'review')
    return `주장 ${(u.claims ?? []).length}개를 맹검 질문과 반박으로 다시 본다`
  if (u.kind === 'summarize') return '개요, 다음 단계 요약, 위험을 쓴다'
  return u.purpose
}

/** 관점 행렬의 칸 글 */
function cellText(cells: unknown[] | undefined, config: string, all: string[]): string {
  const list = (cells ?? []) as { configs?: string[]; status?: string; ids?: string[] }[]
  const hit = list.find((c) => {
    const cs = c.configs ?? []
    return cs.includes(config) || (cs.length === 1 && cs[0] === 'all' && all.includes(config))
  })
  if (!hit) return '-'
  const label =
    hit.status === 'covered'
      ? '다룸'
      : hit.status === 'not_applicable'
        ? '해당 없음'
        : hit.status === 'unreached'
          ? '**못 닿음**'
          : '모름'
  return hit.status === 'covered' && hit.ids?.length
    ? `${label} (${hit.ids.slice(0, 3).join(', ')}${hit.ids.length > 3 ? ' …' : ''})`
    : label
}

/**
 * extraction.md (결정 99, AI 결정 110~114, 118). 사람이 읽을 요약이고 기준은 revision이다. intake의 기본 완료조건
 * (work-start의 requirements 블록)을 이 문서로 판정할 수 있게: 분석 범위와 제외 범위, 항목별 끝난 상태, 후보마다 원본
 * 위치(refs가 가리키는 관찰의 근거까지), 미확정의 필요한 자료, 누락 가능성과 검증 계획을 둔다. 연결로 대체·합쳐진 주장은
 * 따로 둔 절로 접고(지우지 않는다), 검토는 상태를 내리기만 한다(결정 12)
 */
export function renderExtraction(state: RequirementsState, base: string): string {
  const ev = new Map(state.evidence.map((e) => [e.id, e]))
  // 결과 안의 지역 key는 같은 run의 항목을 가리킨다
  const byKey = new Map(state.claims.map((c) => [`${c.run}/${c.key}`, c]))
  const folded = foldedBy(state.links)
  const resolved = resolvedBy(state.links)
  const of = (section: string) => currentClaims(state, section).filter((c) => !folded.has(c.id))
  const cell = (v: string) => v.replace(/\|/g, '\\|').replace(/\n/g, ' ')
  const partial = isPartial(state)
  /** 항목의 근거: 자기 앵커와, refs가 가리키는 같은 run 항목(과 그 앵커) */
  const where = (c: Claim): string[] => {
    const own = evidenceRefs(c.body, ev)
    const refs = Array.isArray(c.body.refs) ? (c.body.refs as unknown[]) : []
    const linked = refs.flatMap((k) => {
      const r = typeof k === 'string' ? byKey.get(`${c.run}/${k}`) : undefined
      if (!r) return []
      const at = evidenceRefs(r.body, ev)
      return [at.length ? `${r.id}(${at.join(', ')})` : r.id]
    })
    return [...own, ...linked]
  }
  /** 주장의 검토: 내린 상태가 있으면 그것, 없으면 반박되지 않은 횟수 (결정 12) */
  const reviewTag = (id: string): string | null => {
    const rs = state.reviews.filter((r) => r.claim === id)
    if (!rs.length) return null
    const lowered = rs.filter((r) => r.status)
    if (lowered.length)
      return `검토: ${[...new Set(lowered.map((r) => REVIEW_LABEL[r.status ?? ''] ?? r.status))].join('·')}(${lowered.map((r) => r.run).join(', ')})`
    return `검토에서 반박되지 않음 ${rs.length}회(확인 아님)`
  }
  const lines = [
    '# 요구사항 추출 결과',
    '',
    `기준 커밋: \`${base}\`. 기록 revision ${state.revision}. 모든 주장은 미검토이거나 검토로 내려간 상태다(결정 12). 채택 결정은 "미결정"이다(15.1).`,
    '',
  ]
  if (partial) {
    const held = state.units.filter((u) => u.status === 'held')
    lines.push(
      `**부분 분석**: run 상한에서 사람이 부분 분석으로 넘겼다. 보류: 예산 상한 단위 ${held.length}개(${held.map((u) => u.id).join(', ')}). 발견한 항목을 모두 처리했다는 뜻이 아니다.`,
      '',
    )
  }
  if (state.summary?.overview.length) {
    lines.push('## 개요', '', '(summarize run의 서술. 상태와 근거는 아래 절이 기준이다.)', '')
    for (const p of state.summary.overview)
      lines.push(`${p.text}${p.ids.length ? ` (${p.ids.join(', ')})` : ''}`, '')
  }
  lines.push('## 구성', '')
  const configs = configsOf(state)
  if (!configs.length) lines.push('- (없음)')
  for (const c of configs)
    lines.push(
      `- ${text(c.name)} (${text(c.status)}): ${text(c.select)}${c.build_command ? `, \`${text(c.build_command)}\`` : ''}`,
    )

  // 분석 범위 (기본 완료조건 1, 5)
  const unitsShown = state.units.filter((u) => u.status !== 'merged')
  const notDone = unitsShown.filter((u) => u.status !== 'done')
  lines.push(
    '',
    '## 분석 범위',
    '',
    `기준 커밋 \`${base}\`의 저장소. intent.md의 비목표에 적은 것은 보지 않았다.`,
    '',
  )
  const bi = state.build_index
  lines.push(
    bi
      ? `빌드 인덱스(구성별 정의된 심볼과 살아 있는 줄, 결정 87·88): ${bi.status === 'built' ? `만듦(구성 ${bi.configs.join(', ')})` : bi.status === 'denied' ? '사람이 허용하지 않아 만들지 않음' : bi.status === 'unavailable' ? '만들 수 없음' : '만들지 못함'}${bi.detail ? `. ${bi.detail}` : ''}${bi.status === 'built' ? '' : '. 구성 활성 검사(config_active) 없이 돌았다'}`
      : '빌드 인덱스: 없음(구성 활성 검사 config_active 없이 돌았다)',
    '',
  )
  lines.push('대상(survey가 찾은 것):', '')
  const inventory = of('inventory')
  if (!inventory.length) lines.push('- (없음)')
  for (const c of inventory) {
    const at = where(c)
    const rt = reviewTag(c.id)
    lines.push(
      `- ${c.id}: ${text(c.body.name ?? '')} (${text(c.body.kind ?? '')})${Array.isArray(c.body.configs) ? ` [${(c.body.configs as string[]).join(', ')}]` : ''}${at.length ? ` — ${at.join(', ')}` : ''}${rt ? `. ${rt}` : ''}`,
    )
  }
  lines.push('', '제외 범위(경계, 내부는 보지 않음):', '')
  const boundaries = of('boundaries')
  if (!boundaries.length) lines.push('- (survey가 찾은 경계 없음)')
  for (const c of boundaries)
    lines.push(
      `- ${c.id}: \`${text(c.body.path ?? '')}\` (${BOUNDARY_LABEL[text(c.body.kind ?? '')] ?? text(c.body.kind ?? '')}): ${text(c.body.reason ?? '')}`,
    )
  lines.push('', '찾았으나 없던 것:', '')
  const missing = of('not_found')
  if (!missing.length) lines.push('- (없음)')
  for (const c of missing) {
    const how = searchText(c.body.searches)
    lines.push(`- ${c.id}: ${text(c.body.what ?? '')}${how ? ` — 찾아봄: ${how}` : ''}`)
  }

  lines.push(
    '',
    '## 분석 단위',
    '',
    '| 단위 | 종류 | 목적 | 끝난 상태 | 까닭 |',
    '| --- | --- | --- | --- | --- |',
  )
  for (const u of unitsShown)
    lines.push(
      `| ${u.id} | ${kindLabel(u)} | ${cell(purposeLabel(u))} | ${STATUS_LABEL[u.status]} | ${cell(u.reason)} |`,
    )

  // 관점별 범위 (AI 결정 111): 마지막 integrate의 coverage
  const coverage = currentCoverage(state)
  if (coverage) {
    const names = configs.map((c) => text(c.name))
    lines.push(
      '',
      '## 관점별 범위',
      '',
      '마지막 integrate run의 판정이다. "못 닿음"은 어느 단위도 다루지 않은 칸이다.',
      '',
      `| 관점 | ${names.join(' | ')} |`,
      `| --- | ${names.map(() => '---').join(' | ')} |`,
    )
    for (const [p, cells] of Object.entries(coverage))
      lines.push(`| ${p} | ${names.map((n) => cell(cellText(cells, n, names))).join(' | ')} |`)
  }

  const sections: [string, string, string[]][] = [
    ['requirements', '요구사항 후보', ['behavior', 'text']],
    ['constraints', '제약 후보', ['text', 'statement']],
    ['observations', '관찰', ['text']],
    ['quantities', '수치', ['symbol', 'expr']],
    ['unknowns', '미확정', ['question', 'text']],
    ['conflicts', '충돌', ['text', 'summary']],
    ['absences', '부재 주장', ['claim']],
  ]
  for (const [section, title, keys] of sections) {
    const cs = of(section)
    const conflictLinks =
      section === 'conflicts' ? state.links.filter((l) => l.kind === 'conflicts') : []
    lines.push('', `## ${title}`, '')
    if (!cs.length && !conflictLinks.length) {
      lines.push('- (없음)')
      continue
    }
    for (const c of cs) {
      const b = c.body
      let head = firstOf(b, keys)
      if (section === 'requirements')
        head = [b.condition, b.behavior, b.result]
          .filter((x) => typeof x === 'string' && x)
          .join(' → ')
      if (section === 'quantities') {
        const vals = Array.isArray(b.values)
          ? (b.values as { configs?: string[]; value?: string }[])
              .map((v) => `${(v.configs ?? []).join(',')}: ${v.value ?? ''}`)
              .join('; ')
          : ''
        head = `${text(b.symbol)} = ${vals} (${text(b.unit_status ?? '')})`
      }
      if (section === 'constraints' && typeof b.reason === 'string' && b.reason)
        head += ` (까닭: ${b.reason})`
      const cfg = Array.isArray(b.configs) ? ` [${(b.configs as string[]).join(', ')}]` : ''
      const tail: string[] = []
      const at = where(c)
      if (at.length) tail.push(`근거: ${at.join(', ')}`)
      if (section === 'unknowns' && typeof b.needs === 'string')
        tail.push(`필요한 자료: ${NEEDS_LABEL[b.needs] ?? b.needs}`)
      if (section === 'unknowns') {
        const later = followingUnits(state, c)
        if (later.length)
          tail.push(
            `다룬 뒤 단위: ${later.map((u) => `${u.id}(${STATUS_LABEL[u.status]})`).join(', ')}`,
          )
        const answers = resolved.get(c.id)
        if (answers?.length)
          tail.push(`답 후보: ${answers.join(', ')}(integrate의 연결, 확정 아님)`)
      }
      if (section === 'absences') {
        const how = searchText(b.searches)
        if (how) tail.push(`찾아봄: ${how}`)
      }
      const rt = reviewTag(c.id)
      if (rt) tail.push(rt)
      lines.push(
        `- ${c.id} (${c.unit})${cfg}: ${head || '(글 없음)'}${tail.length ? ` — ${tail.join('. ')}` : ''}`,
      )
    }
    for (const l of conflictLinks)
      lines.push(
        `- ${l.id} (integrate ${l.run}): ${l.from.join(', ')} ↔ ${l.to.join(', ')}: ${l.reason}`,
      )
  }

  // 연결로 접힌 주장 (AI 결정 110): 지우지 않고 따로 둔다
  const foldedClaims = state.claims.filter((c) => folded.has(c.id))
  if (foldedClaims.length) {
    lines.push(
      '',
      '## 대체되거나 합쳐진 주장',
      '',
      'integrate run의 연결로 접은 주장이다. 기록에는 그대로 있다.',
      '',
    )
    for (const c of foldedClaims) {
      const l = state.links.find(
        (x) => (x.kind === 'supersedes' || x.kind === 'merges') && x.from.includes(c.id),
      )
      lines.push(
        `- ${c.id} (${c.section}, ${c.unit}): ${claimSummary(c) || '(글 없음)'} → ${folded.get(c.id)?.join(', ')}${l ? ` (${l.kind === 'merges' ? '같은 말' : '다시 본 주장'}, ${l.id}: ${l.reason})` : ''}`,
      )
    }
  }

  // 검토 (AI 결정 112)
  if (state.reviews.length) {
    const lowered = state.reviews.filter((r) => r.status)
    const reviewed = new Set(state.reviews.map((r) => r.claim))
    lines.push(
      '',
      '## 검토',
      '',
      `review run이 주장 ${reviewed.size}개를 맹검 질문과 반박으로 다시 봤다. 상태를 내리기만 하고, 반박되지 않은 것도 확인이 아니다(결정 12).`,
      '',
    )
    if (!lowered.length) lines.push('- 내린 주장 없음')
    for (const r of lowered)
      lines.push(
        `- ${r.claim}: ${REVIEW_LABEL[r.status ?? ''] ?? r.status} (${r.run} ${r.item}) — ${r.note}${evidenceRefs({ e: r.evidence.map((x) => ({ evidence: x })) }, ev).length ? ` 근거: ${evidenceRefs({ e: r.evidence.map((x) => ({ evidence: x })) }, ev).join(', ')}` : ''}`,
      )
  }

  const answered = state.decisions
  if (answered.length) {
    lines.push('', '## 사람 결정', '')
    for (const d of answered) {
      const reopened = state.units.filter((u) => u.reopened_by === d.id).map((u) => u.id)
      const waited = d.blocks.filter((b) => !reopened.includes(b))
      const after = d.answer
        ? [
            ...(waited.length ? [`기다린 단위 ${waited.join(', ')}가 답을 받고 돌았다`] : []),
            ...(reopened.length
              ? [`끝난 단위 ${reopened.join(', ')}를 답을 받아 다시 열어 돌렸다`]
              : []),
          ].join('. ')
        : ''
      lines.push(
        `- ${d.id} (${d.trigger}): ${d.question} — 답: ${d.answer ? d.answer.answer : '(답 없음)'}.${after ? ` ${after}` : ''}`,
      )
    }
  }
  if (state.notes.length) {
    lines.push('', '## 사람 메모', '')
    for (const n of state.notes)
      lines.push(
        `- ${n.at}: ${n.text}${n.units.length ? ` (범위에서 뺀 단위 ${n.units.join(', ')})` : ''}`,
      )
  }

  // 누락 가능성과 검증 계획 (기본 완료조건 5)
  const unknowns = of('unknowns')
  const conflicts = of('conflicts')
  const runOnly = of('observations').filter((c) => {
    const at = evidenceRefs(c.body, ev)
    return at.length > 0 && at.every((x) => !/:\d+-\d+$/.test(x))
  })
  const unsupported = [...of('requirements'), ...of('constraints')].filter((c) => !where(c).length)
  // 뒤 단위가 다룬 미확정 (결정 104): 풀렸는지는 그 단위의 결과로 사람이나 verify가 본다
  const followed = unknowns.filter((c) => followingUnits(state, c).some((u) => u.status === 'done'))
  const answeredUnknowns = unknowns.filter((c) => resolved.has(c.id))
  const needs = unknowns.reduce<Record<string, number>>((m, c) => {
    const k = NEEDS_LABEL[text(c.body.needs ?? 'other')] ?? text(c.body.needs)
    return { ...m, [k]: (m[k] ?? 0) + 1 }
  }, {})
  const gaps = coverage
    ? Object.entries(coverage).flatMap(([p, cells]) =>
        ((cells ?? []) as { configs?: string[]; status?: string }[])
          .filter((c) => c.status === 'unreached' || c.status === 'unknown')
          .map(
            (c) =>
              `${p}[${(c.configs ?? []).join(', ')}] ${c.status === 'unreached' ? '못 닿음' : '모름'}`,
          ),
      )
    : []
  const loweredClaims = [...new Set(state.reviews.filter((r) => r.status).map((r) => r.claim))]
  const reviewedSet = new Set(state.reviews.map((r) => r.claim))
  const unreviewedRisk = [
    ...of('requirements'),
    ...of('constraints'),
    ...of('quantities'),
    ...of('absences'),
  ].filter((c) => !reviewedSet.has(c.id))
  lines.push('', '## 누락 가능성', '')
  const risks = [
    ...(partial ? ['부분 분석이다: 보류한 단위가 다룰 범위는 이 기록에 없다'] : []),
    ...notDone.map((u) => `${u.id}는 ${STATUS_LABEL[u.status]}로 끝났다: ${u.reason}`),
    ...(unknowns.length
      ? [
          `코드로 정할 수 없는 미확정 ${unknowns.length}건이 남았다${followed.length ? `(그 가운데 ${followed.length}건은 뒤 단위가 다뤄 완료했으나 앱은 풀렸는지 가르지 않는다)` : ''}${answeredUnknowns.length ? `(답 후보가 연결된 것 ${answeredUnknowns.length}건, 확정 아님)` : ''}`,
        ]
      : []),
    ...(gaps.length ? [`관점별 범위의 빈칸 ${gaps.length}곳: ${gaps.join('; ')}`] : []),
    ...(!coverage ? ['integrate가 관점별 범위를 판정하지 않았다'] : []),
    ...(boundaries.length ? [`경계 ${boundaries.length}곳의 내부는 보지 않았다`] : []),
    ...(unsupported.length
      ? [
          `원본 위치가 없는 후보 ${unsupported.length}건: ${unsupported.map((c) => c.id).join(', ')}`,
        ]
      : []),
    ...(loweredClaims.length
      ? [`검토로 내려간 주장 ${loweredClaims.length}건: ${loweredClaims.join(', ')}`]
      : []),
    ...(unreviewedRisk.length
      ? [`검토하지 않은 위험 등급 주장 ${unreviewedRisk.length}건(표본 밖이거나 예산 밖)`]
      : []),
    'survey가 단위로 나누지 않은 기능, 빌드하지 않은 구성, 실행 중에만 정해지는 동작은 이 기록에 없을 수 있다',
  ]
  for (const r of risks) lines.push(`- ${r}`)
  lines.push('', '## 검증 계획', '')
  const plan = [
    '요구사항 후보와 제약 후보마다 근거 위치를 기준 커밋에서 다시 읽어 글과 맞는지 본다',
    ...(loweredClaims.length
      ? [`검토로 내려간 주장 ${loweredClaims.length}건부터 원본을 본다`]
      : []),
    ...(runOnly.length
      ? [
          `실행 출력만 근거인 관찰 ${runOnly.length}건(${runOnly.map((c) => c.id).join(', ')})은 같은 입력으로 다시 실행해 본다`,
        ]
      : []),
    ...(unknowns.length
      ? [
          `미확정은 필요한 자료(${Object.entries(needs)
            .map(([k, n]) => `${k} ${n}`)
            .join(', ')})를 받아 확인한다`,
        ]
      : []),
    ...(followed.length || answeredUnknowns.length
      ? [
          `뒤 단위가 다루거나 답 후보가 연결된 미확정(${[...new Set([...followed, ...answeredUnknowns].map((c) => c.id))].join(', ')})은 그 관찰로 풀렸는지 본다`,
        ]
      : []),
    ...(conflicts.length || state.links.some((l) => l.kind === 'conflicts')
      ? [`충돌은 사람이 의도를 정한다`]
      : []),
    ...(gaps.length ? ['관점별 범위의 빈칸은 자료를 보태거나 extract를 이어서 돈다'] : []),
    ...(notDone.length ? [`끝나지 않은 단위 ${notDone.length}개는 자료를 받은 뒤 다시 돈다`] : []),
  ]
  for (const x of plan) lines.push(`- ${x}`)
  lines.push('')
  return lines.join('\n')
}

/** extract의 handoff.md (결정 99, AI 결정 113). 기존 승인 화면이 읽는다 */
export function renderHandoff(state: RequirementsState): string {
  const unknownClaims = state.claims.filter((c) => c.section === 'unknowns')
  const unknowns = unknownClaims.length
  const followed = unknownClaims.filter((c) =>
    followingUnits(state, c).some((u) => u.status === 'done'),
  ).length
  const conflicts =
    state.claims.filter((c) => c.section === 'conflicts').length +
    state.links.filter((l) => l.kind === 'conflicts').length
  const held = state.units.filter(
    (u) => u.status === 'failed' || u.status === 'stalled' || u.status === 'held',
  )
  const unanswered = state.decisions.filter((d) => !d.answer)
  const lowered = new Set(state.reviews.filter((r) => r.status).map((r) => r.claim))
  const partial = isPartial(state)
  const decisions = state.decisions
    .flatMap((d) => (d.answer ? [{ d, answer: d.answer.answer }] : []))
    .map(({ d, answer }) => ({
      what: `${d.question} → ${answer}`,
      why: `사람 결정 필요(${d.trigger})`,
      by: 'human',
    }))
  const yamlStr = (s: string) => JSON.stringify(s)
  const open = [
    ...(partial ? ['부분 분석이다: run 상한에서 넘겨 보류한 단위가 있다'] : []),
    ...(unknowns
      ? [
          `미확정 ${unknowns}건이 extraction.md의 미확정 절에 있다${followed ? `(그 가운데 ${followed}건은 뒤 단위가 다뤘다)` : ''}`,
        ]
      : []),
    ...(conflicts ? [`충돌 ${conflicts}건이 extraction.md의 충돌 절에 있다`] : []),
    ...(lowered.size
      ? [`검토로 내려간 주장 ${lowered.size}건이 extraction.md의 검토 절에 있다`]
      : []),
    ...held.map((u) => `${u.id}는 ${STATUS_LABEL[u.status]}로 끝났다: ${u.reason}`),
    ...unanswered.map((d) => `사람 결정 ${d.id}에 답이 없다: ${d.question}`),
  ]
  const risks = (state.summary?.risks ?? []).map(
    (r) => `${r.text}${r.ids.length ? ` (${r.ids.join(', ')})` : ''}`,
  )
  const lines = [
    '---',
    'status: awaiting_approval',
    'blocked_reason: null',
    decisions.length ? 'decisions:' : 'decisions: []',
    ...decisions.flatMap((d) => [
      `  - what: ${yamlStr(d.what)}`,
      `    why: ${yamlStr(d.why)}`,
      `    by: ${d.by}`,
    ]),
    'assumptions: []',
    'rejected: []',
    open.length ? 'open_questions:' : 'open_questions: []',
    ...open.map((q) => `  - ${yamlStr(q)}`),
    'intent_deviation: null',
    risks.length ? 'risks:' : 'risks: []',
    ...risks.map((r) => `  - ${yamlStr(r)}`),
    'recommended_next:',
    '  node: verify',
    `  reason: ${yamlStr(partial ? '부분 분석으로 넘겼다' : 'extract의 열린 단위와 열린 사람 결정이 없다')}`,
    '---',
    '',
    '## 요약',
    '',
    `extract의 분석 단위 ${state.units.filter((u) => u.status !== 'merged').length}개가 끝났다${partial ? '(부분 분석)' : ''}. 주장 ${state.claims.length}개, 근거 ${state.evidence.length}개다. 모든 주장은 미검토이거나 검토로 내려간 상태다(결정 12).`,
    ...(state.summary
      ? [
          '',
          `${state.summary.handoff_summary.text}${state.summary.handoff_summary.ids.length ? ` (${state.summary.handoff_summary.ids.join(', ')})` : ''}`,
        ]
      : []),
    '',
    '## 다음 task가 알아야 할 것',
    '',
    '- 기록의 요약은 이 task 디렉터리의 `extraction.md`에 있고, 기준은 앱이 쓴 `requirements/` 기록이다.',
    ...open.map((q) => `- ${q}`),
    '',
  ]
  return lines.join('\n')
}

// ---------------------------------------------------------------------------------------------------------------
// 저장소로 내보내기 (11절, 결정 1, AI 결정 119)

/** 내보낼 폴더(레포 상대)를 바르게 한다. 절대 경로, `..`, `.git`, 빈 경로는 null */
export function exportDir(dir: string): string | null {
  const s = dir.trim().replace(/\\/g, '/').replace(/\/+$/, '').replace(/^\.\//, '')
  if (!s || s.startsWith('/') || /^[A-Za-z]:/.test(s)) return null
  const parts = s.split('/').filter((x) => x && x !== '.')
  if (!parts.length || parts.some((x) => x === '..') || parts[0] === '.git') return null
  return parts.join('/')
}

/** 기본 내보내기 폴더 */
export const defaultExportDir = (workId: string) => `docs/requirements/${workId}`

/**
 * record.json(docs/contracts/requirements-export.v0)의 내용. outputs는 Work 디렉터리 상대의 실행 출력 사본 경로 →
 * 내보내는 폴더 상대 경로다(근거의 path와 inputs의 copy를 바꾼다)
 */
export function exportRecord(
  state: RequirementsState,
  meta: {
    work: { id: string; title: string }
    base: string
    revisionHash: string
    at: string
    outputs: ReadonlyMap<string, string>
  },
): Record<string, unknown> {
  const folded = foldedBy(state.links)
  const reviews = (id: string) => state.reviews.filter((r) => r.claim === id)
  const moved = (p: string) => meta.outputs.get(p) ?? p
  return {
    schema_version: 0,
    work: meta.work,
    base_commit: meta.base,
    revision: state.revision,
    revision_hash: meta.revisionHash,
    exported_at: meta.at,
    schemas: [
      'requirements-revision.v0',
      'requirements-export.v0',
      ...[...new Set(state.units.map((u) => `extract-${u.kind}.v0`))],
    ],
    partial: isPartial(state),
    configs: configsOf(state),
    units: state.units.map((u) => ({
      id: u.id,
      kind: u.kind,
      lens: u.lens,
      purpose: u.purpose,
      scope: u.scope,
      status: u.status,
      reason: u.reason,
      ...(u.claims ? { claims: u.claims } : {}),
    })),
    claims: state.claims.map((c) => ({
      ...c,
      adoption: '미결정',
      review: {
        status: [...new Set(reviews(c.id).flatMap((r) => (r.status ? [r.status] : [])))],
        history: reviews(c.id).map((r) => `${r.run} ${r.item}: ${r.result}`),
      },
      folded_into: folded.get(c.id) ?? [],
    })),
    evidence: state.evidence.map((e) =>
      e.kind === 'tool_output'
        ? {
            ...e,
            path: moved(e.path),
            ...(e.inputs ? { inputs: e.inputs.map((i) => ({ ...i, copy: moved(i.copy) })) } : {}),
          }
        : e,
    ),
    decisions: state.decisions,
    links: state.links,
    reviews: state.reviews,
    notes: state.notes,
    coverage: currentCoverage(state),
    build_index: state.build_index,
    summary: state.summary,
  }
}

/** 실행 출력과 그 입력의 사본(Work 디렉터리 상대 경로) */
export function outputCopies(state: RequirementsState): string[] {
  return [
    ...new Set(
      state.evidence
        .filter((e) => e.kind === 'tool_output')
        .flatMap((e) => [e.path, ...(e.inputs ?? []).map((i) => i.copy)])
        .filter((p) => p.startsWith('requirements/outputs/')),
    ),
  ]
}

/** 반영 대기 run을 지울 때 pointer에서 도는 run을 뺀다 */
export function withoutRun(p: RequirementsPointer): RequirementsPointer {
  const { run: _run, ...rest } = p
  void _run
  return rest
}

/** 도는 run 기록 */
export function withRun(p: RequirementsPointer, run: ActiveRun): RequirementsPointer {
  return { ...p, run }
}

// ---------------------------------------------------------------------------------------------------------------
// 화면 (15.5, 결정 98)

/** 멈춘 까닭의 이름 (결정 98) */
export const HALT_LABEL: Record<HaltReason, string> = {
  human: '사람이 멈춤',
  failures: '연속 실패',
  decisions: '사람 결정 필요에 답해야 함',
  integrity: '기록 무결성 오류',
  source_changed: '기준 소스가 바뀜',
  run_limit: 'run 상한에 닿음',
  usage_weekly: '주간 사용량 한도',
  restart: '앱을 다시 켬',
  launch: 'run을 띄우지 못함',
}

const STOPPED: readonly UnitStatus[] = ['failed', 'stalled']

/**
 * 패널의 진행 상자. state는 마지막으로 접은 기록(아직 못 읽었으면 null), pending은 반영 대기 답의 내용이다. 포인터에
 * 반영 대기가 없으면 pending은 이미 revision이 된 것이라 보지 않는다
 */
export function requirementsView(input: {
  pointer: RequirementsPointer
  state: RequirementsState | null
  pending: readonly Answer[]
  current: { run: string; unit: string; tool: string | null } | null
  budget: RequirementsBudget
  runs?: RequirementsView['runs']
}): RequirementsView {
  const { pointer: p, state, current } = input
  const units = state?.units ?? []
  const pending = new Map(
    p.pending_answers?.length ? input.pending.map((a) => [a.decision, a.answer]) : [],
  )
  return {
    runsUsed: p.runs_used,
    runLimit: runLimit(p, input.budget),
    units: {
      open: units.filter((u) => u.status === 'open').length,
      done: units.filter((u) => CLOSED_STATUSES.includes(u.status) && !STOPPED.includes(u.status))
        .length,
      stopped: units.filter((u) => STOPPED.includes(u.status)).length,
    },
    current: current
      ? {
          ...current,
          purpose: units.find((u) => u.id === current.unit)?.purpose ?? '',
        }
      : null,
    halt: p.halt
      ? { reason: p.halt.reason, label: HALT_LABEL[p.halt.reason], detail: p.halt.detail }
      : null,
    usageWait: p.usage_wait?.until ?? null,
    decisions: (state ? openDecisions(state) : []).map((d) => ({
      id: d.id,
      question: d.question,
      options: [...d.options],
      pending: pending.get(d.id) ?? null,
    })),
    openUnits: units
      .filter((u) => u.status === 'open')
      .map((u) => ({ id: u.id, kind: u.kind, lens: u.lens, purpose: u.purpose, scope: u.scope })),
    partial: state ? isPartial(state) : false,
    runs: input.runs ?? [],
    exported: p.exported ?? null,
  }
}

/** run.json 하나를 run 목록의 한 줄로 (AI 결정 115). 모양이 틀리면 null */
export function runRow(json: unknown): RequirementsView['runs'][number] | null {
  if (!json || typeof json !== 'object') return null
  const r = json as Record<string, unknown>
  if (typeof r['id'] !== 'string' || typeof r['unit'] !== 'string') return null
  const list = (k: string) =>
    Array.isArray(r[k])
      ? (r[k] as unknown[]).map((x) => (typeof x === 'string' ? x : JSON.stringify(x)))
      : []
  const submits = Array.isArray(r['submits'])
    ? (r['submits'] as { denied?: unknown; problems?: unknown }[])
    : []
  const denied = submits.filter((x) => x.denied === true)
  return {
    id: r['id'],
    unit: r['unit'],
    kind: typeof r['kind'] === 'string' ? r['kind'] : '',
    lens: typeof r['lens'] === 'string' ? r['lens'] : null,
    result: typeof r['failure'] === 'string' ? r['failure'] : String(r['end'] ?? ''),
    denials: denied.length,
    ms: typeof r['ms'] === 'number' ? r['ms'] : null,
    cost: typeof r['cost_usd'] === 'number' ? r['cost_usd'] : null,
    details: [
      ...list('apply_problems').map((x) => `반영 검사: ${x}`),
      ...list('schema_errors').map((x) => `스키마: ${x}`),
      ...denied
        .flatMap((x) => (Array.isArray(x.problems) ? x.problems : []))
        .map((x) => `되돌린 제출: ${String(x)}`),
      ...list('warnings').map((x) => `경고: ${x}`),
    ],
  }
}
