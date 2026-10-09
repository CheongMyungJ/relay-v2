// 요구사항 추출 extract의 순수 로직 (requirements-extraction-flow.md 8절, 15.3, 결정 6·7·24~42, 92~99).
// 기록(revision 변경분) 접기, 다음 단위 고르기, run 결과를 변경분으로 바꾸기, 연속 횟수와 멈춤, run 판정, 기준 커밋의
// 인용 대조, 패킷과 extraction.md·handoff.md 렌더링. 파일·git·프로세스는 adapters/requirements가 맡는다 (I9).
import type { RequirementsView } from '../shared/views'
import type {
  ActiveRun,
  Answer,
  Claim,
  DecisionState,
  Evidence,
  ExtractResult,
  HaltReason,
  HumanDecision,
  NextIds,
  RequirementsBudget,
  RequirementsPointer,
  RequirementsRevision,
  RequirementsState,
  Unit,
  UnitState,
  UnitStatus,
  UnitUpdate,
} from '../shared/requirements'
import { CLOSED_STATUSES } from '../shared/requirements'

const pad = (n: number) => String(n).padStart(4, '0')
export const unitId = (n: number) => `u-${pad(n)}`
export const claimId = (n: number) => `c-${pad(n)}`
export const evidenceId = (n: number) => `e-${pad(n)}`
export const decisionId = (n: number) => `h-${pad(n)}`
export const runId = (n: number) => `r-${pad(n)}`
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

/** revision 사슬이 1부터 끊김 없이 parent로 이어지는가. 아니면 그 까닭 (결정 38의 무결성) */
export function chainProblem(revisions: readonly RequirementsRevision[]): string | null {
  for (const [i, r] of revisions.entries()) {
    if (r.number !== i + 1) return `revision ${i + 1} 자리에 ${r.number}가 있다`
    if (r.parent !== (i === 0 ? null : i)) return `revision ${r.number}의 parent가 ${r.parent}다`
  }
  return null
}

/** 변경분을 차례로 접는다. 사슬은 chainProblem으로 먼저 본다 */
export function fold(revisions: readonly RequirementsRevision[]): RequirementsState {
  const units: UnitState[] = []
  const byId = new Map<string, UnitState>()
  const claims: Claim[] = []
  const evidence: Evidence[] = []
  const decisions: DecisionState[] = []
  const decById = new Map<string, DecisionState>()
  for (const r of revisions) {
    for (const u of r.units) {
      const s: UnitState = {
        ...u,
        status: 'open',
        reason: '',
        run: null,
        checkpoint: null,
        checklist: null,
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
      if (up.checklist) s.checklist = up.checklist
      if (up.status === 'merged') s.merged_into = up.reason
      if (up.decision) s.reopened_by = up.decision
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
  }
  return { revision: revisions.at(-1)?.number ?? 0, units, claims, evidence, decisions }
}

/** 빈 revision 틀 */
function revision(
  number: number,
  at: string,
  cause: RequirementsRevision['cause'],
): RequirementsRevision {
  return {
    schema_version: 0,
    number,
    parent: number > 1 ? number - 1 : null,
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

/** extract를 시작하는 첫 revision: survey 단위 하나 (결정 95) */
export function startRevision(
  next: NextIds,
  at: string,
): { revision: RequirementsRevision; next: NextIds } {
  const rev = revision(next.revision, at, { kind: 'app', run: null, note: 'extract 시작' })
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
    (a, b) => RANK[a.priority] - RANK[b.priority] || a.id.localeCompare(b.id),
  )
  return { unit: sorted[0] ?? null, waiting }
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

/** 성공한 run의 결과를 revision 변경분으로 (결정 34, 35, 94, 95) */
export function applyResult(o: ApplyInput): ApplyOutput {
  const next = { ...o.next }
  const rev = revision(next.revision, o.at, { kind: 'run', run: o.run, note: '' })
  next.revision++
  const warnings: string[] = []

  // 근거: 같은 (종류, 경로, 범위, 인용, 명령)은 하나 (결정 35)
  const evKey = (a: Anchor) =>
    JSON.stringify([a.kind, a.path, a.start, a.end, a.quote, a.command ?? null])
  const known = new Map(o.state.evidence.map((e) => [evKey(e), e.id]))
  const evidenceOf = (raw: Anchor): string => {
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

  // 주장: key가 있는 항목 하나 (결정 94)
  for (const [section, value] of Object.entries(o.result)) {
    if (NOT_CLAIMS.has(section) || !Array.isArray(value)) continue
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

  // 단위: survey의 units, trace의 followups (결정 95). 렌즈·범위가 같은 단위가 이미 있으면(끝난 것도) 새로 만들지 않고
  // 그 단위를 가리킨다 (결정 37, 103: 다시 연 survey가 같은 단위를 다시 낸다)
  const proposed = ('units' in o.result ? o.result.units : o.result.followups) ?? []
  const byScope = new Map<string, UnitState>(
    o.state.units
      .filter((u) => u.id !== o.unit.id && u.status !== 'merged')
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

  // 사람 결정 (결정 7): refs가 가리키는 이 결과의 단위를 기다리게 한다
  for (const d of o.result.human_decisions ?? []) {
    const blocks = [...new Set(d.refs.map((r) => localToId.get(r)).filter((x): x is string => !!x))]
    const hd: HumanDecision = {
      id: decisionId(next.decision++),
      unit: o.unit.id,
      run: o.run,
      key: d.key,
      trigger: d.trigger,
      question: d.question,
      options: d.options,
      blocks,
    }
    rev.decisions.push(hd)
  }

  // 이 단위의 상태
  const outcome = o.result.outcome
  const closed = outcome !== 'incomplete'
  const update: UnitUpdate = {
    id: o.unit.id,
    status: closed ? (outcome as UnitStatus) : 'open',
    reason: o.result.outcome_reason,
    run: o.run,
    checkpoint: closed ? null : ((o.result.checkpoint as Record<string, unknown> | null) ?? null),
    checklist:
      'checklist' in o.result && o.result.checklist
        ? (o.result.checklist as Record<string, unknown>)
        : null,
  }
  rev.unit_updates.push(update)
  return { revision: rev, next, warnings, closed }
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
    if (!d || d.answer) continue
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
  if (u.checkpoint) {
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

const STATUS_LABEL: Readonly<Record<UnitStatus, string>> = {
  open: '열림',
  done: '완료',
  needs_external: '외부 근거 필요',
  out_of_scope: '범위 밖',
  failed: '보류: 연속 실패',
  stalled: '보류: 수렴 안 됨',
  merged: '합쳐짐',
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

/**
 * extraction.md (결정 99). 사람이 읽을 요약이고 기준은 revision이다. intake의 기본 완료조건(work-start의 requirements
 * 블록)을 이 문서로 판정할 수 있게: 분석 범위와 제외 범위, 항목별 끝난 상태, 후보마다 원본 위치(refs가 가리키는 관찰의
 * 근거까지), 미확정의 필요한 자료, 누락 가능성과 검증 계획을 둔다
 */
export function renderExtraction(state: RequirementsState, base: string): string {
  const ev = new Map(state.evidence.map((e) => [e.id, e]))
  // 결과 안의 지역 key는 같은 run의 항목을 가리킨다
  const byKey = new Map(state.claims.map((c) => [`${c.run}/${c.key}`, c]))
  const of = (section: string) => currentClaims(state, section)
  const cell = (v: string) => v.replace(/\|/g, '\\|').replace(/\n/g, ' ')
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
  const lines = [
    '# 요구사항 추출 결과',
    '',
    `기준 커밋: \`${base}\`. 기록 revision ${state.revision}. 모든 주장은 미검토다(결정 12). 채택 결정은 "미결정"이다(15.1).`,
    '',
    '## 구성',
    '',
  ]
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
  lines.push('대상(survey가 찾은 것):', '')
  const inventory = of('inventory')
  if (!inventory.length) lines.push('- (없음)')
  for (const c of inventory) {
    const at = where(c)
    lines.push(
      `- ${c.id}: ${text(c.body.name ?? '')} (${text(c.body.kind ?? '')})${at.length ? ` — ${at.join(', ')}` : ''}`,
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
  for (const u of unitsShown) {
    const kind = u.kind === 'survey' ? 'survey' : `trace(${u.lens})`
    // survey 단위의 목적은 지시의 영어 문장이라 짧게 보인다
    const purpose = u.kind === 'survey' ? '구성·진입점·경계를 찾고 분석 단위를 나눈다' : u.purpose
    lines.push(
      `| ${u.id} | ${kind} | ${cell(purpose)} | ${STATUS_LABEL[u.status]} | ${cell(u.reason)} |`,
    )
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
    lines.push('', `## ${title}`, '')
    if (!cs.length) {
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
      }
      if (section === 'absences') {
        const how = searchText(b.searches)
        if (how) tail.push(`찾아봄: ${how}`)
      }
      lines.push(
        `- ${c.id} (${c.unit})${cfg}: ${head || '(글 없음)'}${tail.length ? ` — ${tail.join('. ')}` : ''}`,
      )
    }
  }
  const answered = state.decisions
  if (answered.length) {
    lines.push('', '## 사람 결정', '')
    for (const d of answered) {
      const reopened = state.units.filter((u) => u.reopened_by === d.id).map((u) => u.id)
      const waited = d.blocks.filter((b) => !reopened.includes(b))
      const after = [
        ...(waited.length ? [`기다린 단위 ${waited.join(', ')}가 답을 받고 돌았다`] : []),
        ...(reopened.length
          ? [`끝난 단위 ${reopened.join(', ')}를 답을 받아 다시 열어 돌렸다`]
          : []),
      ].join('. ')
      lines.push(
        `- ${d.id} (${d.trigger}): ${d.question} — 답: ${d.answer ? d.answer.answer : '(답 없음)'}.${after ? ` ${after}` : ''}`,
      )
    }
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
  const needs = unknowns.reduce<Record<string, number>>((m, c) => {
    const k = NEEDS_LABEL[text(c.body.needs ?? 'other')] ?? text(c.body.needs)
    return { ...m, [k]: (m[k] ?? 0) + 1 }
  }, {})
  lines.push('', '## 누락 가능성', '')
  const risks = [
    ...notDone.map((u) => `${u.id}는 ${STATUS_LABEL[u.status]}로 끝났다: ${u.reason}`),
    ...(unknowns.length
      ? [
          `코드로 정할 수 없는 미확정 ${unknowns.length}건이 남았다${followed.length ? `(그 가운데 ${followed.length}건은 뒤 단위가 다뤄 완료했으나 앱은 풀렸는지 가르지 않는다)` : ''}`,
        ]
      : []),
    ...(boundaries.length ? [`경계 ${boundaries.length}곳의 내부는 보지 않았다`] : []),
    ...(unsupported.length
      ? [
          `원본 위치가 없는 후보 ${unsupported.length}건: ${unsupported.map((c) => c.id).join(', ')}`,
        ]
      : []),
    'survey가 단위로 나누지 않은 기능, 빌드하지 않은 구성, 실행 중에만 정해지는 동작은 이 기록에 없을 수 있다',
  ]
  for (const r of risks) lines.push(`- ${r}`)
  lines.push('', '## 검증 계획', '')
  const plan = [
    '요구사항 후보와 제약 후보마다 근거 위치를 기준 커밋에서 다시 읽어 글과 맞는지 본다',
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
    ...(followed.length
      ? [
          `뒤 단위가 다룬 미확정 ${followed.length}건(${followed.map((c) => c.id).join(', ')})은 그 단위의 관찰로 풀렸는지 본다`,
        ]
      : []),
    ...(conflicts.length ? [`충돌 ${conflicts.length}건은 사람이 의도를 정한다`] : []),
    ...(notDone.length ? [`끝나지 않은 단위 ${notDone.length}개는 자료를 받은 뒤 다시 돈다`] : []),
  ]
  for (const x of plan) lines.push(`- ${x}`)
  lines.push('')
  return lines.join('\n')
}

/** extract의 handoff.md (결정 99). 기존 승인 화면이 읽는다 */
export function renderHandoff(state: RequirementsState): string {
  const unknownClaims = state.claims.filter((c) => c.section === 'unknowns')
  const unknowns = unknownClaims.length
  const followed = unknownClaims.filter((c) =>
    followingUnits(state, c).some((u) => u.status === 'done'),
  ).length
  const conflicts = state.claims.filter((c) => c.section === 'conflicts').length
  const held = state.units.filter((u) => u.status === 'failed' || u.status === 'stalled')
  const decisions = state.decisions
    .flatMap((d) => (d.answer ? [{ d, answer: d.answer.answer }] : []))
    .map(({ d, answer }) => ({
      what: `${d.question} → ${answer}`,
      why: `사람 결정 필요(${d.trigger})`,
      by: 'human',
    }))
  const yamlStr = (s: string) => JSON.stringify(s)
  const open = [
    ...(unknowns
      ? [
          `미확정 ${unknowns}건이 extraction.md의 미확정 절에 있다${followed ? `(그 가운데 ${followed}건은 뒤 단위가 다뤘다)` : ''}`,
        ]
      : []),
    ...(conflicts ? [`충돌 ${conflicts}건이 extraction.md의 충돌 절에 있다`] : []),
    ...held.map((u) => `${u.id}는 ${STATUS_LABEL[u.status]}로 끝났다: ${u.reason}`),
  ]
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
    'risks: []',
    'recommended_next:',
    '  node: verify',
    `  reason: ${yamlStr('extract의 열린 단위와 열린 사람 결정이 없다')}`,
    '---',
    '',
    '## 요약',
    '',
    `extract의 분석 단위 ${state.units.filter((u) => u.status !== 'merged').length}개가 끝났다. 주장 ${state.claims.length}개, 근거 ${state.evidence.length}개다. 모든 주장은 미검토다(결정 12).`,
    '',
    '## 다음 task가 알아야 할 것',
    '',
    '- 기록의 요약은 이 task 디렉터리의 `extraction.md`에 있고, 기준은 앱이 쓴 `requirements/` 기록이다.',
    ...open.map((q) => `- ${q}`),
    '',
  ]
  return lines.join('\n')
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
  }
}
