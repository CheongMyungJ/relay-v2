// PR 진행 (시나리오 10, D152~D200)의 판정. main이 gh와 git으로 읽은 것을 넘기면 체크를 나누고(D176, D196),
// 코멘트를 거르고(D160, D161, D197), 항목을 모으고 상태를 바꾸고(D189, D199), 머지 조건(D176)과 배지(D183),
// 원격 head의 비교(D193)를 정한다. gh 버전(D198), PR 주소의 레포(I50), 실패 로그의 끝부분, 기본 머지 방식(D177),
// PR 패널의 화면 모양도 여기서 만든다. gh와 git은 부르지 않는다.
import type {
  PrAuthor,
  PrCheckRef,
  PrItem,
  PrItemsFile,
  PrItemKind,
  PrItemStatus,
} from '../shared/pr'
import type {
  BadgeKind,
  CheckBucket,
  CiState,
  PrCheckView,
  PrItemAction,
  PrItemView,
  PrView,
  RoundView,
  SyncKind,
} from '../shared/views'
import type { AppConfig } from '../shared/config'
import type { MergeMethod, WorkState } from '../shared/work'
import { knownTaskEngine } from './agent'
import { approvalMode } from './approval'
import { RESPOND } from './pipeline'
import {
  autoRespondView,
  isRespondPending,
  pendingRespond,
  rerunPlan,
  respondFailureView,
  respondStart,
  respondTasks,
} from './respond'
import { TASK_STATUS_LABEL, taskLabel } from './review'

const short = (commit: string) => commit.slice(0, 8)

const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {}

const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

const int = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v)
    ? v
    : typeof v === 'string' && /^\d+$/.test(v)
      ? Number(v)
      : null

// ---------- gh 버전 (D198) ----------

/** 앱이 쓰는 gh 명령이 모두 있는 최소 버전. `gh api --slurp`가 2.48.0에 생겼다 (docs/implementation.md 3절) */
export const MIN_GH_VERSION = '2.48.0'

/** gh --version의 첫 줄 `gh version <버전> (<빌드 날짜>)`에서 버전 (cli/cli pkg/cmd/version). 없으면 null */
export function ghVersionOf(output: string): string | null {
  const m = /^gh version (\S+)/m.exec(output)
  return m?.[1] ?? null
}

function parts(version: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** 버전 a가 b보다 낮은가. 둘 중 하나라도 숫자로 읽을 수 없으면 null */
function older(a: string, b: string): boolean | null {
  const v = parts(a)
  const w = parts(b)
  if (!v || !w) return null
  for (let i = 0; i < 3; i++) {
    if (v[i] !== w[i]) return (v[i] ?? 0) < (w[i] ?? 0)
  }
  return false
}

/**
 * gh가 최소 버전보다 낮은가 (D198). 버전을 모르거나 숫자로 읽을 수 없으면(개발 빌드 등) 낮다고 보지 않는다:
 * 그때는 읽기가 실패하면 gh의 오류를 보인다
 */
export function ghTooOld(version: string | null | undefined): boolean {
  return version ? older(version, MIN_GH_VERSION) === true : false
}

/** `gh auth status --active`가 생긴 버전 (cli/cli v2.57.0 pkg/cmd/auth/status) */
export const GH_AUTH_ACTIVE_VERSION = '2.57.0'

/**
 * gh auth status에 --active를 줄 수 있는가 (D67). 버전을 숫자로 읽을 수 없으면 주지 않는다: 모르는 옵션이면 gh가
 * 실패하므로, 비활성 계정까지 보는 쪽이 낫다
 */
export function ghAuthActive(version: string | null | undefined): boolean {
  return version ? older(version, GH_AUTH_ACTIVE_VERSION) === false : false
}

/** [PR 생성]을 끄는 이유 (D198) */
export function ghVersionReason(version: string): string {
  return `gh ${MIN_GH_VERSION} 이상이 필요함 (지금 ${version})`
}

// ---------- PR 주소 (I50) ----------

/** PR 주소에서 읽은 레포와 번호 */
export interface PrLocation {
  host: string
  owner: string
  repo: string
  number: number
}

/**
 * PR 주소 https://<host>/<owner>/<repo>/pull/<n>. gh pr create가 찍거나 gh pr list가 준 GitHub의 주소다(7-4).
 * 읽을 수 없으면 null
 */
export function prLocation(url: string): PrLocation | null {
  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const [owner, repo, pull, n] = u.pathname.split('/').filter(Boolean)
  const number = Number(n)
  if (!owner || !repo || pull !== 'pull' || !Number.isInteger(number) || number <= 0) return null
  return { host: u.host.toLowerCase(), owner, repo, number }
}

/** gh --repo에 줄 레포 HOST/OWNER/REPO (docs/implementation.md 3절 "gh의 레포 고르기") */
export function repoArg(l: PrLocation): string {
  return `${l.host}/${l.owner}/${l.repo}`
}

/** REST 경로의 앞부분 repos/<owner>/<repo>. 호스트는 gh api --hostname으로 준다 (3절) */
export function restRepo(l: PrLocation): string {
  return `repos/${l.owner}/${l.repo}`
}

// ---------- 체크 (D176, D196) ----------

/** 나눈 체크. key는 같은 체크를 가리는 이름이다 */
export interface CheckFact extends PrCheckView {
  key: string
  run: number | null
  job: number | null
  startedAt: string | null
}

/** 체크의 상태를 gh pr checks와 같게 나눈다 (cli/cli v2.101.0 pkg/cmd/pr/checks/aggregate.go) */
export function bucketOf(state: string): CheckBucket {
  switch (state) {
    case 'SUCCESS':
      return 'pass'
    case 'SKIPPED':
    case 'NEUTRAL':
      return 'skipping'
    case 'ERROR':
    case 'FAILURE':
    case 'TIMED_OUT':
    case 'ACTION_REQUIRED':
      return 'fail'
    case 'CANCELLED':
      return 'cancel'
    default:
      // EXPECTED, REQUESTED, WAITING, QUEUED, PENDING, IN_PROGRESS, STALE
      return 'pending'
  }
}

/** Actions 체크의 링크 …/actions/runs/<실행>/job/<작업>에서 실행과 작업 id (S7 관찰 2) */
export function actionsIds(url: string | null): { run: number | null; job: number | null } {
  const m = url ? /\/actions\/runs\/(\d+)\/job\/(\d+)/.exec(url) : null
  return m ? { run: Number(m[1]), job: Number(m[2]) } : { run: null, job: null }
}

const isStatusContext = (c: Record<string, unknown>) =>
  c['__typename'] === 'StatusContext' || text(c['context']) !== null

/**
 * statusCheckRollup의 CheckRun이 가리키는 Actions 실행 id (D201). main이 이 실행들의 이벤트를 읽어 checksOf에 준다.
 * 겹치지 않게 한 번씩이다
 */
export function rollupRuns(rollup: unknown): number[] {
  const runs = new Set<number>()
  for (const raw of Array.isArray(rollup) ? rollup : []) {
    const c = obj(raw)
    if (isStatusContext(c)) continue
    const { run } = actionsIds(text(c['detailsUrl']))
    if (run !== null) runs.add(run)
  }
  return [...runs]
}

/**
 * 체크의 이름: 워크플로 / 이름 (이벤트) (D201). GitHub의 PR 체크 목록처럼 이벤트를 붙인다. 이벤트를 읽지 못한 Actions
 * 체크는 실행 id를 붙인다
 */
export function checkLabel(c: {
  name: string
  workflow: string | null
  event?: string | null
  run?: number | null
}): string {
  const base = `${c.workflow ? `${c.workflow} / ` : ''}${c.name}`
  if (c.event) return `${base} (${c.event})`
  return c.run !== null && c.run !== undefined ? `${base} (실행 ${c.run})` : base
}

/**
 * gh pr view --json statusCheckRollup을 체크 목록으로 (3절). 상태는 StatusContext의 state, CheckRun은 끝났으면(COMPLETED)
 * conclusion, 아니면 status다. 같은 체크가 여럿이면 시작 시각이 가장 늦은 것만 남긴다(gh의 eliminateDuplicates, D201).
 * 같은 체크는 StatusContext면 context, CheckRun이면 워크플로·이름·이벤트가 같은 것이다. --json에는 이벤트가 없어
 * Actions 체크는 events(실행 id → 이벤트)로 채운다. 이벤트를 모르는 Actions 체크는 실행 id로 가려 다른 실행과 합치지
 * 않는다(I52). 비었거나 null이면 체크가 없다
 */
export function checksOf(
  rollup: unknown,
  events: ReadonlyMap<number, string> = new Map(),
): CheckFact[] {
  // 커밋 상태와 체크 실행은 이름이 같아도 다른 체크다(gh도 가른다). 같은 종류 안에서만 다시 실행을 합친다
  const all: { fact: CheckFact; status: boolean }[] = []
  for (const raw of Array.isArray(rollup) ? rollup : []) {
    const c = obj(raw)
    if (isStatusContext(c)) {
      const name = text(c['context']) ?? '(이름 없음)'
      const state = text(c['state']) ?? 'PENDING'
      const url = text(c['targetUrl'])
      all.push({
        status: true,
        fact: {
          key: name,
          name,
          workflow: null,
          event: null,
          label: name,
          state,
          bucket: bucketOf(state),
          url,
          ...actionsIds(url),
          startedAt: text(c['startedAt']),
        },
      })
      continue
    }
    const name = text(c['name']) ?? '(이름 없음)'
    const workflow = text(c['workflowName'])
    const status = text(c['status']) ?? ''
    const state = status === 'COMPLETED' ? (text(c['conclusion']) ?? '') : status
    const url = text(c['detailsUrl'])
    const ids = actionsIds(url)
    const event = ids.run !== null ? (events.get(ids.run) ?? null) : null
    const base = workflow ? `${workflow}/${name}` : name
    all.push({
      status: false,
      fact: {
        key: event ? `${base} (${event})` : ids.run !== null ? `${base} #${ids.run}` : base,
        name,
        workflow,
        event,
        label: checkLabel({ name, workflow, event, run: ids.run }),
        state,
        bucket: bucketOf(state),
        url,
        ...ids,
        startedAt: text(c['startedAt']),
      },
    })
  }
  const latest = new Map<string, CheckFact>()
  for (const { fact: c, status } of all) {
    const k = `${status ? 'status' : 'check'}:${c.key}`
    const prior = latest.get(k)
    if (!prior || (c.startedAt ?? '') > (prior.startedAt ?? '')) latest.set(k, c)
  }
  // 이름이 같은 체크 실행이 있으면 커밋 상태의 키와 이름에 "(상태)"를 붙인다: 항목 id(ciItemId)와 화면의 줄이 겹치지
  // 않게. 겹치지 않으면 그대로라 지금까지의 항목 id가 바뀌지 않는다
  for (const [k, c] of latest) {
    if (k.startsWith('status:') && latest.has(`check:${c.key}`)) {
      latest.set(k, { ...c, key: `${c.key} (상태)`, label: `${c.label} (상태)` })
    }
  }
  return [...latest.values()].sort((a, b) => a.key.localeCompare(b.key))
}

/** 새 head를 처음 읽은 뒤 체크가 없어도 통과로 보지 않는 시간 (D196, 기본값) */
export const CHECK_WAIT_MS = 60_000

/**
 * head 커밋의 CI (D176, D196). 실패가 있으면 fail, 취소된 것이 있으면 cancel, 도는 것이 있으면 pending이다.
 * 체크가 없으면 그 head를 처음 읽은 뒤 60초가 지났을 때(waited) none(통과로 봄), 아니면 waiting이다
 */
export function ciState(checks: readonly Pick<CheckFact, 'bucket'>[], waited: boolean): CiState {
  if (checks.length === 0) return waited ? 'none' : 'waiting'
  if (checks.some((c) => c.bucket === 'fail')) return 'fail'
  if (checks.some((c) => c.bucket === 'cancel')) return 'cancel'
  if (checks.some((c) => c.bucket === 'pending')) return 'pending'
  return 'pass'
}

// ---------- 코멘트 (D157, D160, D161, D197) ----------

/** 읽은 코멘트 하나. 리뷰 본문, 인라인 코멘트, 대화 코멘트다 */
export interface CommentFact {
  id: string
  kind: 'review' | 'inline' | 'convo'
  author: PrAuthor
  body: string
  url: string | null
  created_at: string | null
  updated_at: string | null
  path?: string
  line?: number | null
  reply_to?: number | null
  review_state?: string
}

/** 사람의 코멘트 가운데 받는 작성자 관계: 소유자, 조직 구성원, 협업자 (D160. 값의 뜻은 S7 관찰 3) */
const ACCEPTED_ASSOCIATIONS: readonly string[] = ['OWNER', 'MEMBER', 'COLLABORATOR']

/** 봇의 이름: login이나 설정에 적은 이름의 끝 `[bot]`을 뗀다 (D197) */
export function botName(login: string): string {
  return login.trim().replace(/\[bot\]$/, '')
}

/**
 * 코멘트를 대응할 거리로 받는가 (D160, D161, D197). 봇(REST user.type Bot)은 받을 봇 목록에 있을 때만, 사람은 작성자
 * 관계가 소유자·조직 구성원·협업자일 때만 받는다. 받지 않으면 까닭을 준다
 */
export function acceptance(
  author: PrAuthor,
  allowedBots: readonly string[],
): { ok: boolean; why: string | null } {
  if (author.bot) {
    const name = botName(author.login)
    return allowedBots.some((b) => botName(b) === name)
      ? { ok: true, why: null }
      : { ok: false, why: `봇 ${name}: 프로젝트 설정의 받을 봇에 없음 (D161)` }
  }
  return ACCEPTED_ASSOCIATIONS.includes(author.association)
    ? { ok: true, why: null }
    : {
        ok: false,
        why: `작성자 관계 ${author.association || '없음'}: 소유자·조직 구성원·협업자만 받음 (D160)`,
      }
}

function authorOf(raw: Record<string, unknown>): PrAuthor {
  const user = obj(raw['user'])
  return {
    login: text(user['login']) ?? '(알 수 없음)',
    bot: user['type'] === 'Bot',
    association: text(raw['author_association']) ?? 'NONE',
  }
}

/**
 * REST 목록 셋(리뷰, 인라인 코멘트, 대화 코멘트)을 코멘트로 (S7 관찰 3). 본문이 빈 리뷰는 항목이 아니다: 인라인
 * 스레드에 답글을 달면 본문이 빈 리뷰가 하나 더 생긴다. 제출하지 않은 리뷰(PENDING)도 뺀다. id는 목록마다 따로 받으므로
 * 종류를 앞에 붙인다
 */
export function commentFacts(lists: {
  reviews: readonly unknown[]
  inline: readonly unknown[]
  convo: readonly unknown[]
}): CommentFact[] {
  const out: CommentFact[] = []
  for (const raw of lists.reviews) {
    const r = obj(raw)
    const id = int(r['id'])
    const body = typeof r['body'] === 'string' ? r['body'] : ''
    const state = text(r['state']) ?? ''
    if (id === null || state === 'PENDING' || !body.trim()) continue
    const at = text(r['submitted_at'])
    out.push({
      id: `review:${id}`,
      kind: 'review',
      author: authorOf(r),
      body,
      url: text(r['html_url']),
      created_at: at,
      updated_at: at,
      review_state: state,
    })
  }
  for (const raw of lists.inline) {
    const c = obj(raw)
    const id = int(c['id'])
    if (id === null) continue
    out.push({
      id: `inline:${id}`,
      kind: 'inline',
      author: authorOf(c),
      body: typeof c['body'] === 'string' ? c['body'] : '',
      url: text(c['html_url']),
      created_at: text(c['created_at']),
      updated_at: text(c['updated_at']),
      path: text(c['path']) ?? '',
      line: int(c['line']) ?? int(c['original_line']),
      reply_to: int(c['in_reply_to_id']),
    })
  }
  for (const raw of lists.convo) {
    const c = obj(raw)
    const id = int(c['id'])
    if (id === null) continue
    out.push({
      id: `convo:${id}`,
      kind: 'convo',
      author: authorOf(c),
      body: typeof c['body'] === 'string' ? c['body'] : '',
      url: text(c['html_url']),
      created_at: text(c['created_at']),
      updated_at: text(c['updated_at']),
    })
  }
  return out
}

// ---------- 항목 (D189, D199) ----------

/** 한 번 읽은 결과 가운데 항목을 정하는 것 */
export interface ReadFacts {
  at: string
  /** 지금 원격 PR head */
  head: string
  comments: readonly CommentFact[]
  /** 지금 head에서 실패한 체크 (fail) */
  failing: readonly CheckFact[]
  /**
   * 충돌: 충돌이면 fetch한 기준 브랜치 커밋, 충돌이 없으면 null. GitHub가 계산하는 중이거나 기준 브랜치를 fetch하지
   * 못해 모르면 undefined다(항목을 바꾸지 않음)
   */
  conflict: string | null | undefined
  /** 원격과 갈라짐(D193): 항목을 만들 때 두 head, 아니면 null. 비교하지 못했으면 undefined */
  diverged: { remote: string; local: string } | null | undefined
  /** 이번에 읽은 CI 실패의 로그나 읽지 못한 까닭 (항목 id별) */
  logs?: ReadonlyMap<string, { log?: string; note?: string }>
}

/** 거르기 규칙 (D161, D197) */
export interface ItemRules {
  allowedBots: readonly string[]
}

export interface Gathered {
  items: PrItem[]
  /** 새로 받은 항목(새 항목이 된 것) */
  received: string[]
  /** 받지 않은 새 코멘트 */
  notAccepted: string[]
  /** 이번에 해소된 항목 (D199) */
  resolved: string[]
}

const COMMENT_KINDS: readonly PrItemKind[] = ['review', 'inline', 'convo']

/**
 * CI 실패 항목의 id: ci:<head>:<체크> (D189). 체크는 checksOf의 key다. Actions 체크는 <워크플로>/<이름> (<이벤트>)다
 * (D201)
 */
export function ciItemId(head: string, check: Pick<CheckFact, 'key'>): string {
  return `ci:${head}:${check.key}`
}

/** 실패한 스텝의 로그를 읽었는데 비었다 (실패한 스텝 표시 없이 실패한 작업 등). 다시 받아도 같으므로 읽은 것으로 본다 */
export const EMPTY_LOG_NOTE = '실패한 스텝의 로그가 비어 있음'

/** CI 실패 항목의 로그를 이 작업(job)에서 이미 읽었는가. 같은 체크가 다른 작업으로 다시 실패하면 새로 읽는다 */
export function ciLogRead(items: readonly PrItem[], id: string, job: number | null): boolean {
  return items.some(
    (i) =>
      i.id === id &&
      (i.log !== undefined || i.log_note === EMPTY_LOG_NOTE) &&
      (i.check?.job ?? null) === job,
  )
}

function checkRef(c: CheckFact): PrCheckRef {
  return {
    name: c.name,
    workflow: c.workflow,
    event: c.event,
    state: c.state,
    url: c.url,
    run: c.run,
    job: c.job,
  }
}

function commentFields(c: CommentFact): Partial<PrItem> {
  return {
    author: c.author,
    body: c.body,
    ...(c.url ? { url: c.url } : {}),
    ...(c.created_at ? { created_at: c.created_at } : {}),
    ...(c.updated_at ? { updated_at: c.updated_at } : {}),
    ...(c.path !== undefined ? { path: c.path } : {}),
    ...(c.line !== undefined ? { line: c.line } : {}),
    ...(c.reply_to !== undefined ? { reply_to: c.reply_to } : {}),
    ...(c.review_state !== undefined ? { review_state: c.review_state } : {}),
  }
}

/**
 * 읽은 결과로 항목을 모은다 (D189, D199).
 * - 코멘트: 새 id면 거르기 규칙으로 새 항목이나 받지 않음이다. 이미 있으면 본문을 새로 적는다(고친 코멘트는 id가 같다,
 *   S7). 사람이 정하지 않은 새 항목과 받지 않음은 규칙을 다시 적용한다(받을 봇을 바꾸면 따라 바뀜). GitHub에서 없어진
 *   코멘트는 새 항목과 받지 않음이면 해소됨이다.
 * - 조건 항목(CI 실패, 충돌, 원격과 갈라짐): 지금 조건의 id로 새 항목을 만들고, 해소됨이던 같은 id는 새 항목으로
 *   되돌린다. 지금 조건이 아닌 새 항목은 해소됨이다. 사람이 제외한 항목은 그대로 둔다. 모르는 조건(undefined)은
 *   바꾸지 않는다.
 */
export function gatherItems(prior: readonly PrItem[], read: ReadFacts, rules: ItemRules): Gathered {
  const items: PrItem[] = prior.map((i) => ({ ...i }))
  const index = new Map(items.map((i) => [i.id, i]))
  const received: string[] = []
  const notAccepted: string[] = []
  const resolved: string[] = []
  const add = (item: PrItem) => {
    items.push(item)
    index.set(item.id, item)
  }
  const resolve = (item: PrItem) => {
    if (item.status !== 'new') return
    item.status = 'resolved'
    item.resolved_at = read.at
    resolved.push(item.id)
  }
  const revive = (item: PrItem) => {
    if (item.status !== 'resolved') return
    item.status = 'new'
    delete item.resolved_at
    received.push(item.id)
  }

  // 코멘트
  const seen = new Set<string>()
  for (const c of read.comments) {
    seen.add(c.id)
    const rule = acceptance(c.author, rules.allowedBots)
    const item = index.get(c.id)
    if (!item) {
      add({
        id: c.id,
        kind: c.kind,
        status: rule.ok ? 'new' : 'not_accepted',
        first_seen_at: read.at,
        ...commentFields(c),
      })
      ;(rule.ok ? received : notAccepted).push(c.id)
      continue
    }
    Object.assign(item, commentFields(c))
    if (!item.by_human && (item.status === 'new' || item.status === 'not_accepted')) {
      const next: PrItemStatus = rule.ok ? 'new' : 'not_accepted'
      if (next !== item.status) {
        item.status = next
        if (next === 'new') received.push(item.id)
      }
    }
  }
  for (const item of items) {
    if (!COMMENT_KINDS.includes(item.kind) || seen.has(item.id) || item.gone) continue
    item.gone = true
    if (item.status === 'not_accepted') item.status = 'new'
    resolve(item)
  }

  // CI 실패
  const failing = new Set<string>()
  for (const c of read.failing) {
    const id = ciItemId(read.head, c)
    failing.add(id)
    const log = read.logs?.get(id)
    const logFields: Partial<PrItem> = log?.log
      ? { log: log.log }
      : log?.note
        ? { log_note: log.note }
        : {}
    const item = index.get(id)
    if (!item) {
      add({
        id,
        kind: 'ci',
        status: 'new',
        first_seen_at: read.at,
        head: read.head,
        check: checkRef(c),
        ...logFields,
      })
      received.push(id)
      continue
    }
    revive(item)
    // 같은 체크가 다른 작업으로 다시 실패했으면 옛 작업의 로그는 이번 실패가 아니다
    if (item.check?.job !== c.job) {
      delete item.log
      delete item.log_note
    }
    item.check = checkRef(c)
    if (log?.log) {
      item.log = log.log
      delete item.log_note
    } else if (log?.note && !item.log) {
      item.log_note = log.note
    }
  }
  for (const item of items) if (item.kind === 'ci' && !failing.has(item.id)) resolve(item)

  // 충돌과 원격과 갈라짐: 지금 조건 하나만 새 항목이다
  const condition = (
    kind: 'conflict' | 'diverged',
    id: string | null | undefined,
    fields: Partial<PrItem>,
  ) => {
    if (id === undefined) return
    if (id !== null) {
      const item = index.get(id)
      if (!item) {
        add({ id, kind, status: 'new', first_seen_at: read.at, ...fields })
        received.push(id)
      } else {
        revive(item)
      }
    }
    for (const item of items) if (item.kind === kind && item.id !== id) resolve(item)
  }
  condition(
    'conflict',
    read.conflict === undefined ? undefined : read.conflict ? `conflict:${read.conflict}` : null,
    read.conflict ? { base_commit: read.conflict } : {},
  )
  condition(
    'diverged',
    read.diverged === undefined
      ? undefined
      : read.diverged
        ? `diverged:${read.diverged.remote}`
        : null,
    read.diverged ? { remote_head: read.diverged.remote, local_head: read.diverged.local } : {},
  )
  return { items, received, notAccepted, resolved }
}

export type ItemActionResult = { ok: true; items: PrItem[] } | { ok: false; error: string }

/**
 * 사람의 조작 (D160, D161, D170, D189): [제외]는 새 항목을, [다시 넣기]는 제외한 항목을, [받기]는 받지 않은 코멘트를
 * 바꾼다. 사람이 정한 상태는 거르기 규칙으로 다시 바꾸지 않는다. GitHub에서 없어진 코멘트는 바꾸지 않는다
 */
export function applyItemAction(
  items: readonly PrItem[],
  id: string,
  action: PrItemAction,
): ItemActionResult {
  const item = items.find((i) => i.id === id)
  if (!item) return { ok: false, error: `항목이 없음: ${id}` }
  if (item.gone) return { ok: false, error: 'GitHub에서 없어진 코멘트임' }
  const from: Record<PrItemAction, PrItemStatus> = {
    exclude: 'new',
    include: 'excluded',
    accept: 'not_accepted',
  }
  if (item.status !== from[action]) {
    return {
      ok: false,
      error: `${ITEM_STATUS_LABEL[item.status]}인 항목에는 [${ACTION_LABEL[action]}]를 할 수 없음`,
    }
  }
  const next: PrItem = {
    ...item,
    status: action === 'exclude' ? 'excluded' : 'new',
    by_human: true,
  }
  return { ok: true, items: items.map((i) => (i.id === id ? next : i)) }
}

const ACTION_LABEL: Readonly<Record<PrItemAction, string>> = {
  exclude: '제외',
  include: '다시 넣기',
  accept: '받기',
}

/**
 * 거르기 규칙을 다시 적용한다 (D161, D185): 프로젝트 설정의 받을 봇을 바꾸면, 사람이 정하지 않은 새 항목과 받지
 * 않음인 코멘트를 적어 둔 작성자로 다시 정한다. 다음 읽기를 기다리지 않는다. 바뀐 항목의 id를 돌려준다
 */
export function reapplyRules(
  items: readonly PrItem[],
  rules: ItemRules,
): { items: PrItem[]; changed: string[] } {
  const changed: string[] = []
  const out = items.map((i) => {
    if (!COMMENT_KINDS.includes(i.kind) || i.by_human || i.gone || !i.author) return i
    if (i.status !== 'new' && i.status !== 'not_accepted') return i
    const next: PrItemStatus = acceptance(i.author, rules.allowedBots).ok ? 'new' : 'not_accepted'
    if (next === i.status) return i
    changed.push(i.id)
    return { ...i, status: next }
  })
  return { items: out, changed }
}

/** 머지와 배지가 세는 할 일: 제외하지 않고 받은 새 항목 (D176) */
function openItems(items: readonly PrItem[]): PrItem[] {
  return items.filter((i) => i.status === 'new' && !i.gone)
}

// ---------- 원격 PR 브랜치 맞추기 (D193) ----------

export interface SyncInput {
  /** 로컬 Work 브랜치의 커밋 */
  local: string
  /** 원격 PR head */
  remote: string
  /** 로컬이 원격의 조상이다(원격만 앞섬). 두 커밋이 같으면 쓰지 않는다 */
  localInRemote: boolean
  /** 원격이 로컬의 조상이다(로컬만 앞섬) */
  remoteInLocal: boolean
  /** worktree에 커밋 안 된 변경이 없다 */
  clean: boolean
  /** worktree가 Work 브랜치에 있다 (D138) */
  onBranch: boolean
}

/**
 * 원격 PR head와 로컬 Work 브랜치의 비교 (D193). 원격만 앞서고 worktree가 깨끗하고 Work 브랜치에 있으면 받는다(ff).
 * 원격만 앞섰는데 worktree가 깨끗하지 않으면 dirty, Work 브랜치에 있지 않으면 off_branch다(git을 건드리지 않음, D138).
 * 로컬만 앞서면 local_ahead, 둘 다 아니면 갈라짐이다
 */
export function syncKind(s: SyncInput): SyncKind {
  if (s.local === s.remote) return 'same'
  if (s.localInRemote) {
    if (!s.onBranch) return 'off_branch'
    return s.clean ? 'ff' : 'dirty'
  }
  if (s.remoteInLocal) return 'local_ahead'
  return 'diverged'
}

/** 원격과 갈라짐 항목을 만드는 비교 (D193): 갈라졌거나, 원격만 앞섰는데 worktree가 깨끗하지 않다 */
export function divergedFact(
  kind: SyncKind,
  remote: string,
  local: string,
): { remote: string; local: string } | null {
  return kind === 'diverged' || kind === 'dirty' ? { remote, local } : null
}

// ---------- 머지 조건 (D176) ----------

/** 마지막으로 읽은 PR (메모리. 앱을 켜면 다시 읽는다, D159) */
export interface PrReadState {
  at: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  head: string
  headRef: string
  baseRef: string
  isDraft: boolean
  mergeable: string | null
  mergeStateStatus: string | null
  reviewDecision: string | null
  checks: CheckFact[]
  ci: CiState
  /** 원격 head와 로컬 Work 브랜치의 비교. 비교하지 못했으면 null */
  sync: SyncKind | null
}

export interface Gate {
  enabled: boolean
  reasons: string[]
}

export interface GateInput {
  work: Pick<WorkState, 'status' | 'operation' | 'pr' | 'tasks'>
  read: PrReadState | null
  items: readonly PrItem[]
  /** 로컬 Work 브랜치의 커밋. 읽지 못했으면 null */
  localHead: string | null
}

const CI_REASON: Readonly<Record<CiState, string | null>> = {
  pass: null,
  none: null,
  waiting: '체크 기다림: 새 head의 체크가 아직 없음 (처음 읽은 뒤 60초, D196)',
  pending: '체크가 도는 중',
  fail: 'CI 실패',
  cancel: '취소된 체크가 있음',
}

const SYNC_REASON: Readonly<Record<SyncKind, string | null>> = {
  same: null,
  ff: null,
  local_ahead: '로컬 Work 브랜치에 push하지 않은 커밋이 있음',
  diverged: '원격 PR 브랜치와 로컬 Work 브랜치가 갈라짐',
  dirty: '원격이 앞섰지만 worktree에 커밋 안 된 변경이 있어 받지 않음',
  off_branch: 'worktree가 Work 브랜치에 있지 않아 원격 커밋을 받지 않음 (D138)',
}

/**
 * [머지]를 누를 수 있는가 (D176): head 커밋의 CI 통과(체크가 없으면 통과. 다만 새 head를 처음 읽은 뒤 60초는 기다림,
 * D196), 충돌 없음, 돌거나 기다리는 PR 대응 task 없음, 제외하지 않은 받은 항목이 모두 처리됨(새 항목과 대응 중이 없음,
 * D189), 원격 PR head와 로컬 Work 브랜치가 같음. 리뷰 승인과 브랜치 보호는 GitHub가 판정한다. 꺼져 있으면 어긴 조건을
 * 모두 준다
 */
export function mergeGate(g: GateInput): Gate {
  const { work, read } = g
  const pr = work.pr
  if (work.status !== 'pr' || !pr) return { enabled: false, reasons: ['PR 진행인 Work가 아님'] }
  const reasons: string[] = []
  if (work.operation) reasons.push('진행 중인 작업이 있음')
  if (pr.closed_at) reasons.push('PR이 닫혀 있음')
  if (pendingRespond(work)) reasons.push('돌거나 기다리는 PR 대응 task가 있음')
  if (!read) {
    reasons.push('아직 PR을 읽지 못함')
    return { enabled: false, reasons }
  }
  if (read.state !== 'OPEN') reasons.push(`PR이 열려 있지 않음 (${read.state})`)
  const ci = CI_REASON[read.ci]
  if (ci) {
    const names = read.checks
      .filter((c) =>
        read.ci === 'fail'
          ? c.bucket === 'fail'
          : read.ci === 'cancel'
            ? c.bucket === 'cancel'
            : c.bucket === 'pending',
      )
      .map((c) => c.label)
    reasons.push(names.length && read.ci !== 'waiting' ? `${ci}: ${names.join(', ')}` : ci)
  }
  if (read.mergeable === 'CONFLICTING') reasons.push('기준 브랜치와 충돌')
  else if (read.mergeable !== 'MERGEABLE') reasons.push('GitHub가 머지 가능 여부를 계산하는 중')
  const open = openItems(g.items).length
  if (open) reasons.push(`처리하지 않은 항목 ${open}개 ([제외]하면 머지를 막지 않음)`)
  const responding = g.items.filter((i) => i.status === 'responding').length
  if (responding) {
    reasons.push(`대응 중인 항목 ${responding}개 (그 라운드의 push와 답글 게시가 끝나면 처리됨)`)
  }
  if (!g.localHead) {
    reasons.push('로컬 Work 브랜치를 읽지 못함')
  } else if (g.localHead !== read.head) {
    const why = read.sync ? SYNC_REASON[read.sync] : null
    reasons.push(
      `원격 PR head(${short(read.head)})와 로컬 Work 브랜치(${short(g.localHead)})가 다름${why ? `: ${why}` : ''}`,
    )
  }
  return { enabled: reasons.length === 0, reasons }
}

// ---------- 배지 (D183) ----------

/**
 * PR 진행인 Work의 배지 (D183). 설계의 차례대로 자동 대응 멈춤(D171) > 대응 거리 있음(받은 새 항목) > PR 닫힘 > 머지 가능 >
 * 리뷰·CI 대기다. PR 대응 task가 끝나기 전에는 core/approval badge가 task 상태를 보인다. paused는 core/respond autoPlan이
 * 상한 때문에 시작하지 않는다고 본 것이다
 */
export function prBadgeKind(
  items: readonly PrItem[],
  closed: boolean,
  gate: Gate,
  paused = false,
): BadgeKind {
  if (paused) return 'auto_paused'
  if (openItems(items).length) return 'pr_items'
  if (closed) return 'pr_closed'
  if (gate.enabled) return 'mergeable'
  return 'pr_waiting'
}

// ---------- 실패 로그 (S7 관찰 2) ----------

/** 항목에 남기는 실패 로그의 줄 수 (기본값) */
const LOG_TAIL_LINES = 40

/** 색 제어 문자: gh는 제어 문자를 `^[` 글자로 바꿔 쓴다(asciisanitizer, 3절). 날것의 ESC도 뗀다 */
const ESC = String.fromCharCode(0x1b)
const COLOR = new RegExp(`(?:\\^\\[|${ESC})\\[[0-9;]*[A-Za-z]`, 'g')
/** Actions 로그 줄 앞의 시각 */
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z ?/

/**
 * gh run view --log-failed의 출력에서 실패한 스텝의 로그 끝부분 (S7 관찰 2). 줄 앞의 `<작업>\t<스텝>\t<시각> `과
 * 색 제어 문자를 뗀다. 스텝 이름이 UNKNOWN STEP이면(로그 zip에 스텝별 파일이 없어 작업 로그 전체가 옴, 3절)
 * "Post job cleanup." 앞에서 자른다. 끝의 빈 줄은 뺀다
 */
export function failedLogTail(output: string, lines = LOG_TAIL_LINES): string {
  const rows = output.split(/\r?\n/).map((l) => {
    const cells = l.split('\t')
    return cells.length >= 3
      ? { step: cells[1] ?? '', text: cells.slice(2).join('\t') }
      : { step: '', text: l }
  })
  let body = rows
  if (rows.some((r) => r.step === 'UNKNOWN STEP')) {
    const cut = rows.findIndex((r) => r.text.includes('Post job cleanup.'))
    if (cut >= 0) body = rows.slice(0, cut)
  }
  const cleaned = body.map((r) => r.text.replace(STAMP, '').replace(COLOR, '').trimEnd())
  while (cleaned.length && !cleaned[cleaned.length - 1]) cleaned.pop()
  return cleaned.slice(-lines).join('\n')
}

// ---------- 머지 방식 (D177) ----------

/** 머지 창의 차례이자 기본 선택의 차례 (D177, 화면 구성의 머지 창) */
const MERGE_METHODS: readonly MergeMethod[] = ['merge', 'squash', 'rebase']

/** gh repo view --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed에서 허용하는 방식 (S7 관찰 6) */
export function allowedMethods(view: unknown): MergeMethod[] {
  const v = obj(view)
  const allowed: Record<MergeMethod, unknown> = {
    merge: v['mergeCommitAllowed'],
    squash: v['squashMergeAllowed'],
    rebase: v['rebaseMergeAllowed'],
  }
  return MERGE_METHODS.filter((m) => allowed[m] === true)
}

/** 머지 창의 기본 선택 (D177): 프로젝트 설정이 허용되면 그것, 아니면 허용하는 첫 방식(merge, squash, rebase 차례) */
export function preferredMethod(
  allowed: readonly MergeMethod[],
  project: MergeMethod | null | undefined,
): MergeMethod | null {
  if (project && allowed.includes(project)) return project
  return allowed[0] ?? null
}

// ---------- 화면 (D183, PR 패널) ----------

const ITEM_KIND_LABEL: Readonly<Record<PrItemKind, string>> = {
  review: '리뷰',
  inline: '인라인 코멘트',
  convo: '대화 코멘트',
  ci: 'CI 실패',
  conflict: '충돌',
  diverged: '원격과 갈라짐',
}

const ITEM_STATUS_LABEL: Readonly<Record<PrItemStatus, string>> = {
  new: '새 항목',
  not_accepted: '받지 않음',
  excluded: '제외',
  responding: '대응 중',
  done: '처리됨',
  resolved: '해소됨',
}

const firstLine = (s: string) =>
  s
    .split(/\r?\n/)
    .find((l) => l.trim())
    ?.trim() ?? ''

/** 내용이 있는 줄이 둘 이상인 본문. 아니면 null */
const multiLine = (s: string | undefined): string | null =>
  s !== undefined && s.split(/\r?\n/).filter((l) => l.trim()).length > 1 ? s : null

/** 항목 하나의 화면 모양 */
export function prItemView(item: PrItem, rules: ItemRules): PrItemView {
  const who = item.author
    ? `${item.author.bot ? botName(item.author.login) : item.author.login}`
    : ''
  let title: string
  switch (item.kind) {
    case 'ci':
      title = `${item.check ? checkLabel(item.check) : ''}: ${item.check?.state ?? ''}, head ${short(item.head ?? '')}`
      break
    case 'conflict':
      title = `기준 브랜치 ${short(item.base_commit ?? '')}와 충돌`
      break
    case 'diverged':
      title = `원격 ${short(item.remote_head ?? '')}, 로컬 ${short(item.local_head ?? '')}`
      break
    default:
      title = `${who}${item.review_state ? ` (${item.review_state})` : ''}: ${firstLine(item.body ?? '') || '(본문 없음)'}`
  }
  const why =
    item.status === 'not_accepted' && item.author
      ? acceptance(item.author, rules.allowedBots).why
      : null
  const where =
    item.kind === 'inline'
      ? `${item.path ?? ''}${item.line ? `:${item.line}` : ''}${item.reply_to ? ` (스레드 inline:${item.reply_to}의 답글)` : ''}`
      : null
  return {
    id: item.id,
    kind: item.kind,
    kindLabel: ITEM_KIND_LABEL[item.kind],
    status: item.status,
    statusLabel: ITEM_STATUS_LABEL[item.status],
    title,
    // 한 줄짜리 본문은 제목에 이미 있다
    text: item.kind === 'ci' ? (item.log ?? null) : multiLine(item.body),
    note: item.kind === 'ci' && !item.log ? (item.log_note ?? '로그를 아직 읽지 않음') : null,
    url: item.url ?? item.check?.url ?? null,
    where,
    why,
    gone: item.gone === true,
  }
}

const STATE_LABEL: Readonly<Record<'OPEN' | 'CLOSED' | 'MERGED', string>> = {
  OPEN: '열림',
  CLOSED: '닫힘',
  MERGED: '머지됨',
}

const CI_LABEL: Readonly<Record<CiState, string>> = {
  pass: '통과',
  none: '체크 없음 (통과로 봄)',
  waiting: '체크 기다림 (새 head를 처음 읽은 뒤 60초, D196)',
  pending: '도는 중',
  fail: '실패',
  cancel: '취소된 체크가 있음',
}

const REVIEW_LABEL: Readonly<Record<string, string>> = {
  APPROVED: '승인됨',
  CHANGES_REQUESTED: '변경 요청',
  REVIEW_REQUIRED: '리뷰 필요',
}

const MERGEABLE_LABEL: Readonly<Record<string, string>> = {
  MERGEABLE: '없음',
  CONFLICTING: '기준 브랜치와 충돌',
  UNKNOWN: 'GitHub가 계산하는 중',
}

const SYNC_LABEL: Readonly<Record<SyncKind, string>> = {
  same: '원격 head와 같음',
  ff: '원격만 앞섬',
  local_ahead: '로컬 Work 브랜치만 앞섬 (push하지 않은 커밋)',
  diverged: '원격 PR 브랜치와 갈라짐',
  dirty: '원격만 앞섰지만 worktree에 커밋 안 된 변경이 있어 받지 않음',
  off_branch: 'worktree가 Work 브랜치에 있지 않아 받지 않음 (D138)',
}

/** 화면에 보이는 차례: 새 항목, 대응 중, 처리됨, 해소됨, 제외, 받지 않음 (화면 구성의 PR 패널) */
const STATUS_ORDER: readonly PrItemStatus[] = [
  'new',
  'responding',
  'done',
  'resolved',
  'excluded',
  'not_accepted',
]

export interface PrViewInput {
  work: Pick<WorkState, 'status' | 'operation' | 'pr' | 'tasks' | 'settings'>
  /** 앱 설정: 자동 대응의 상태 (D154, D169, D171) */
  config: Pick<AppConfig, 'respond_auto_start' | 'respond_auto_round_max' | 'auto_approve'> &
    Partial<Pick<AppConfig, 'agent_engine'>>
  read: PrReadState | null
  file: PrItemsFile
  rules: ItemRules
  localHead: string | null
  reading: boolean
  error: string | null
}

/** PR 패널 (시나리오 10, D183). 머지한 뒤에도 기록을 보인다 */
export function prView(input: PrViewInput): PrView | null {
  const pr = input.work.pr
  if (!pr) return null
  const { read } = input
  const activeResponse = pendingRespond(input.work)
  const responseEngine = activeResponse
    ? knownTaskEngine(activeResponse)
    : (input.config.agent_engine ?? 'claude')
  const gate = mergeGate({
    work: input.work,
    read,
    items: input.file.items,
    localHead: input.localHead,
  })
  const items = [...input.file.items]
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
    .map((i) => prItemView(i, input.rules))
  // 앱이 머지했으면 마지막으로 읽은 것(머지 전)보다 기록이 새것이다
  const state = pr.merged ? 'MERGED' : (read?.state ?? null)
  return {
    number: pr.number,
    url: pr.url,
    head: pr.head,
    state,
    isDraft: read?.isDraft ?? false,
    closed: pr.closed_at !== undefined,
    readAt: pr.read_at ?? null,
    reading: input.reading,
    error: input.error,
    ci: read?.ci ?? null,
    checks: (read?.checks ?? []).map((c) => ({
      name: c.name,
      workflow: c.workflow,
      event: c.event,
      label: c.label,
      state: c.state,
      bucket: c.bucket,
      url: c.url,
    })),
    reviewDecision: read?.reviewDecision ?? null,
    mergeable: read?.mergeable ?? null,
    sync: read?.sync ?? null,
    items,
    gate,
    synced: input.file.synced.map((s) => ({
      at: s.at,
      commits: s.commits,
      baseCommit: s.base_commit ?? null,
    })),
    merged: pr.merged
      ? {
          at: pr.merged.at,
          head: pr.merged.head,
          method: pr.merged.method,
          outside: pr.merged.outside,
        }
      : null,
    ended: pr.ended_at ?? null,
    offerClean:
      input.work.status === 'completed' &&
      pr.merged !== undefined &&
      pr.clean_offered_at === undefined,
    ghVersion: pr.gh_version,
    respond: respondStart(input.work, input.file.items),
    auto: autoRespondView(
      input.work,
      input.file.items,
      input.config,
      approvalMode(input.config, input.work.settings, RESPOND, responseEngine) === 'auto',
    ),
    rerun: rerunView(input),
    rounds: roundViews(input),
    labels: {
      state: state
        ? `${STATE_LABEL[state]}${read?.isDraft && state === 'OPEN' ? ' (draft)' : ''}`
        : null,
      ci: read ? CI_LABEL[read.ci] : null,
      review: read?.reviewDecision
        ? (REVIEW_LABEL[read.reviewDecision] ?? read.reviewDecision)
        : null,
      mergeable: read?.mergeable ? (MERGEABLE_LABEL[read.mergeable] ?? read.mergeable) : null,
      sync: read?.sync ? SYNC_LABEL[read.sync] : null,
    },
  }
}

/**
 * [실패한 체크 다시 실행] (D175, D203): 마지막으로 읽은 head에 실패한 Actions 체크가 있으면 보인다. 열린 PR이고 진행 중
 * 작업이 없을 때 누를 수 있다
 */
function rerunView(input: PrViewInput): PrView['rerun'] {
  const read = input.read
  const plan = rerunPlan(read)
  if (!plan.runs.length) return null
  const pr = input.work.pr
  const reason =
    input.work.status !== 'pr' || !pr
      ? 'PR 진행인 Work가 아님'
      : input.work.operation
        ? '진행 중인 작업이 있음'
        : pr.closed_at || read?.state !== 'OPEN'
          ? 'PR이 열려 있지 않음'
          : null
  return { enabled: reason === null, reason, ...plan }
}

const ROUND_STATE_LABEL: Readonly<Record<Exclude<RoundView['state'], 'running'>, string>> = {
  failed: 'push나 답글 게시가 실패함: 승인 화면에서 [다시 시도]',
  deferred:
    'push를 미룸: 원격 PR 브랜치에 새 커밋이 있음. 다음 라운드가 병합한 뒤 함께 push하고 답글을 게시함 (D193)',
  published: 'push와 답글 게시를 마침',
}

/** 대응 라운드 기록 (화면 구성의 PR 패널): work.json의 라운드와 pr-items.json의 push·답글 기록을 합친다 */
function roundViews(input: PrViewInput): RoundView[] {
  const { file } = input
  const items = new Map(file.items.map((i) => [i.id, i]))
  return respondTasks(input.work).map((t): RoundView => {
    const r = t.respond
    const rec = file.rounds.find((x) => x.task_id === t.id)
    const state: RoundView['state'] = isRespondPending(t)
      ? r.failure
        ? 'failed'
        : 'running'
      : r.published_at
        ? 'published'
        : r.deferred_at
          ? 'deferred'
          : 'published'
    return {
      round: r.round,
      taskId: t.id,
      label: taskLabel(t),
      state,
      stateLabel: state === 'running' ? TASK_STATUS_LABEL[t.status] : ROUND_STATE_LABEL[state],
      items: roundItemViews(r.items, items, input.rules),
      instruction: r.instruction,
      pushed: rec?.pushed ? { at: rec.pushed.at, commits: rec.pushed.commits } : null,
      pushedWith: rec?.pushed_with ?? null,
      replies: (rec?.replies ?? []).map((x) => ({
        item: x.item,
        url: x.url ?? null,
        skipped: x.skipped ?? null,
      })),
      publishedAt: r.published_at ?? null,
      failure: respondFailureView(r.failure),
    }
  })
}

/**
 * 대응 라운드의 항목. PR 패널의 라운드 기록과 승인 화면이 같이 쓴다. pr-items.json에 없는 항목은 id만 보인다
 */
export function roundItemViews(
  ids: readonly string[],
  items: ReadonlyMap<string, PrItem>,
  rules: ItemRules,
): RoundView['items'] {
  return ids.map((id) => {
    const item = items.get(id)
    return item
      ? { id, kindLabel: ITEM_KIND_LABEL[item.kind], title: prItemView(item, rules).title }
      : { id, kindLabel: '', title: id }
  })
}
