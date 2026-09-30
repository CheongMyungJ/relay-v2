// PR 대응 (시나리오 10-3~10-8, D168~D210)의 판정. [대응 시작]을 받는지(D170, D179, D182), 라운드와 항목의 상태(D189),
// 게시할 답글의 본문과 보이지 않는 표시(D173, D194, D207), 게시하지 않고 건너뛸 답글(D205), 기존 테스트 변경(D202),
// 다시 실행할 Actions 실행(D203), 머지 창의 판정표 경고(D206), 자동 대응의 시작과 라운드 상한(D154, D159, D171, D210)을
// 정한다. gh와 git은 부르지 않는다: push와 게시는 main이 하고, 읽은 PR의 판정은 core/pr이 한다.
import type { AppConfig, WorkSettings } from '../shared/config'
import type { PrItem, PrItemKind, PrItemsFile, PrReply, PrRound } from '../shared/pr'
import type { AutoRespondView } from '../shared/views'
import type { RespondRound, RespondStage, TaskRecord, WorkState } from '../shared/work'
import type { PrReadState } from './pr'
import { RESPOND } from './pipeline'
import { replySections } from './validate'

// ---------- 대응 task와 라운드 ----------

/** PR 대응의 push와 답글 게시의 단계 이름 (시나리오 10-6, D77): 끊긴 곳과 실패한 곳을 보인다 */
export const RESPOND_STAGE_LABEL: Readonly<Record<RespondStage, string>> = {
  push: 'push',
  reply: '답글 게시',
}

/** 끝나지 않은 PR 대응 task인가: 승인되지 않았고(게시했든 미뤘든 승인이면 끝남) 폐기되지 않았다 (D176, D183) */
export function isRespondPending(task: Pick<TaskRecord, 'node' | 'status'>): boolean {
  return task.node === RESPOND && task.status !== 'approved' && task.status !== 'discarded'
}

/**
 * 돌거나 기다리는 PR 대응 task (D176, D183): 지금 task가 끝나지 않은 대응 task면 그 task, 아니면 null. 대응 task는 한
 * 번에 하나이고 늘 마지막 task다 (D170)
 */
export function pendingRespond(work: Pick<WorkState, 'tasks'>): TaskRecord | null {
  const task = work.tasks[work.tasks.length - 1]
  return task && isRespondPending(task) ? task : null
}

/** 라운드 기록이 있는 PR 대응 task. 차례대로다 */
export function respondTasks(
  work: Pick<WorkState, 'tasks'>,
): (TaskRecord & { respond: RespondRound })[] {
  return work.tasks.filter(
    (t): t is TaskRecord & { respond: RespondRound } => t.node === RESPOND && !!t.respond,
  )
}

/**
 * push를 미룬 라운드 (D193): 승인했지만 원격 PR 브랜치의 새 커밋 때문에 push와 답글 게시를 미룬 대응 task. 다음 라운드가
 * 원격을 병합한 뒤 함께 push하고 답글도 게시한다
 */
export function deferredRounds(work: Pick<WorkState, 'tasks'>): TaskRecord[] {
  return respondTasks(work).filter(
    (t) => t.status === 'approved' && t.respond.deferred_at && !t.respond.published_at,
  )
}

/**
 * 다음 라운드 번호: 이 Work에서 [대응 시작]을 누른 차례(1부터). 답글의 보이지 않는 표시에 넣는다 (D194). 한 번도
 * 시작하지 않은 대응 task도 센다: 번호가 겹치지 않는다
 */
export function nextRound(work: Pick<WorkState, 'tasks'>): number {
  return Math.max(0, ...respondTasks(work).map((t) => t.respond.round)) + 1
}

// ---------- 항목 ----------

/** 답글을 다는 항목의 종류: 리뷰 본문, 인라인 코멘트, 대화 코멘트 (D190). CI 실패, 충돌, 원격과 갈라짐은 답글이 없다 */
export const REPLY_KINDS: readonly PrItemKind[] = ['review', 'inline', 'convo']

const COMMENT_ID = /^(review|inline|convo):(\d+)$/

/** 코멘트 항목의 id인가. 항목 id는 종류를 앞에 붙인다 (review:, inline:, convo:, docs/implementation.md M9) */
export function isCommentId(id: string): boolean {
  return COMMENT_ID.test(id)
}

/** 라운드의 코멘트 항목 id: replies.md에 절이 하나씩 있어야 한다 (D190) */
export function replyItemIds(ids: readonly string[]): string[] {
  return ids.filter(isCommentId)
}

/** [대응 시작]에 넣는 항목: 제외하지 않고 받은 새 항목이다 (D170). GitHub에서 없어진 코멘트는 넣지 않는다 */
export function newItemIds(items: readonly PrItem[]): string[] {
  return items.filter((i) => i.status === 'new' && !i.gone).map((i) => i.id)
}

/** [대응 시작]의 상태: 누를 수 있는지와 까닭, 누르면 넣을 새 항목 */
export interface RespondStart {
  enabled: boolean
  reason: string | null
  items: string[]
}

/**
 * 닫힌 PR에는 대응하지 않는다 (D179): [대응 시작]과 대응 task의 [승인]([다시 시도] 포함)을 받지 않는다. 다시 열린 것을
 * 읽으면 이어서 할 수 있다
 */
export const PR_CLOSED =
  'PR이 닫혀 있음 ([새로 고침]으로 다시 열린 것을 읽으면 대응할 수 있음, D179)'

/** 대응 라운드의 마지막 실패 (push나 답글 게시). PR 패널의 라운드 기록과 승인 화면이 같이 쓴다 */
export function respondFailureView(
  failure: RespondRound['failure'],
): { stage: string; error: string } | null {
  return failure ? { stage: RESPOND_STAGE_LABEL[failure.stage], error: failure.error } : null
}

/**
 * [대응 시작]을 받지 않는 까닭 (시나리오 10-3, D170, D179, D182): PR 진행이 아님, 진행 중 작업이 있음, PR이 닫힘, 끝나지
 * 않은 대응 task가 있음(한 번에 하나). 받으면 null. machine과 PR 패널의 버튼이 같이 쓴다
 */
export function respondBlocked(
  work: Pick<WorkState, 'status' | 'pr' | 'operation' | 'tasks'>,
): string | null {
  if (work.status !== 'pr' || !work.pr) return 'PR 진행인 Work가 아님'
  if (work.operation) return '진행 중인 작업이 있음'
  if (work.pr.closed_at) return PR_CLOSED
  if (pendingRespond(work))
    return '끝나지 않은 PR 대응 task가 있음 (대응 task는 한 번에 하나, D170)'
  return null
}

/**
 * [대응 시작]을 누를 수 있는가와 누르면 넣을 새 항목 (시나리오 10-3, D170). 항목이 없어도 사람 지시만으로 시작할 수
 * 있다 (D182)
 */
export function respondStart(
  work: Pick<WorkState, 'status' | 'pr' | 'operation' | 'tasks'>,
  items: readonly PrItem[],
): RespondStart {
  const reason = respondBlocked(work)
  return { enabled: reason === null, reason, items: newItemIds(items) }
}

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n')

/**
 * [대응 시작]의 입력 검사 (D170, D182). 사람이 본 새 항목(expect)이 지금 새 항목과 같아야 한다: 그사이 읽기가 들여온
 * 항목을 사람이 모른 채 넣지 않는다. 항목이 없으면 지시가 있어야 한다. 받으면 null
 */
export function respondInputError(
  start: RespondStart,
  expect: readonly string[],
  instruction: string,
): string | null {
  if (!start.enabled) return start.reason
  if (!sameIds(expect, start.items)) {
    return '패널을 본 뒤 새 항목이 바뀌었음. 항목을 다시 확인하고 누르세요'
  }
  if (!start.items.length && !instruction.trim()) {
    return '대응할 새 항목이 없음. 지시를 적으면 지시만으로 시작함 (D182)'
  }
  return null
}

/**
 * 대응 task의 기록으로 항목의 상태를 맞춘다 (D189). 라운드의 항목은 그 라운드를 게시했으면 처리됨, 아니면 대응 중이다.
 * 상태의 기준은 work.json이고 pr-items.json은 뒤따라 쓴다: 둘 사이에 앱이 꺼졌으면 켤 때 이것으로 맞춘다. 사람이 정한
 * 상태(받지 않음, 제외)와 해소됨은 라운드에 들 수 없어 건드리지 않는다. 바뀐 항목의 id를 돌려준다
 */
export function reconcileItems(
  items: readonly PrItem[],
  work: Pick<WorkState, 'tasks'>,
): { items: PrItem[]; changed: string[] } {
  const want = new Map<string, 'responding' | 'done'>()
  for (const t of respondTasks(work)) {
    if (t.status === 'discarded') continue
    for (const id of t.respond.items) want.set(id, t.respond.published_at ? 'done' : 'responding')
  }
  const changed: string[] = []
  const out = items.map((i) => {
    const status = want.get(i.id)
    if (!status || i.status === status) return i
    if (i.status !== 'new' && i.status !== 'responding' && i.status !== 'done') return i
    changed.push(i.id)
    return { ...i, status }
  })
  return { items: out, changed }
}

// ---------- 답글 (D172, D173, D190, D194, D205, D207) ----------

/** 답글의 보이지 않는 표시 (D194). 웹 화면에 보이지 않는 HTML 주석이다 */
export function replyMarker(workId: string, itemId: string, round: number): string {
  return `<!-- relay:${workId}/${itemId}/${round} -->`
}

const MARKER = /<!-- relay:([^\s/]+)\/(\S+)\/(\d+) -->/

/** 본문의 보이지 않는 표시. 없으면 null */
export function markerOf(body: string): { workId: string; itemId: string; round: number } | null {
  const m = MARKER.exec(body)
  return m?.[1] && m[2] && m[3] ? { workId: m[1], itemId: m[2], round: Number(m[3]) } : null
}

/** 게시한 답글의 코멘트를 읽은 코멘트의 id 모양으로: 스레드에 단 답글은 inline:<id>, 아니면 convo:<id> (D207) */
export function postedCommentId(reply: Pick<PrReply, 'thread' | 'comment_id'>): string | null {
  if (reply.comment_id === undefined) return null
  return `${reply.thread === null ? 'convo' : 'inline'}:${reply.comment_id}`
}

/**
 * 앱이 게시한 답글인가 (D194): 적어 둔 코멘트 id이거나 본문에 이 Work의 보이지 않는 표시가 있다. 읽을 때 이 코멘트는
 * 항목으로 보지 않는다
 */
export function isAppReply(
  comment: { id: string; body: string },
  workId: string,
  file: Pick<PrItemsFile, 'rounds'>,
): boolean {
  if (markerOf(comment.body)?.workId === workId) return true
  return file.rounds.some((r) => r.replies.some((x) => postedCommentId(x) === comment.id))
}

const kindOfId = (id: string): PrItemKind => {
  const kind = COMMENT_ID.exec(id)?.[1]
  return kind === 'review' || kind === 'inline' || kind === 'convo' ? kind : 'convo'
}

/**
 * 인라인 코멘트의 답글을 달 스레드: 스레드 첫 코멘트의 id다. REST는 스레드 첫 코멘트에만 답글을 받으므로 스레드의
 * 답글이면 in_reply_to_id다 (docs/implementation.md 3절). 리뷰 본문과 대화 코멘트는 스레드가 없어 null이다 (D207)
 */
export function replyThread(item: Pick<PrItem, 'id' | 'kind' | 'reply_to'>): number | null {
  if (item.kind !== 'inline') return null
  if (item.reply_to) return item.reply_to
  const n = Number(COMMENT_ID.exec(item.id)?.[2])
  return Number.isInteger(n) && n > 0 ? n : null
}

const LINK_KIND: Partial<Record<PrItemKind, string>> = { review: '리뷰', convo: '대화 코멘트' }

/**
 * 스레드 없는 답글의 첫 줄 (D207): `> @<작성자>의 <리뷰 | 대화 코멘트>에 대한 답글: <주소>`. 봇은 이름 끝의 [bot]을
 * 뗀다(D197)
 */
export function replyLink(item: Pick<PrItem, 'kind' | 'author' | 'url'>): string {
  const who = item.author ? `@${item.author.login.trim().replace(/\[bot\]$/, '')}` : '(작성자 모름)'
  return `> ${who}의 ${LINK_KIND[item.kind] ?? '코멘트'}에 대한 답글: ${item.url ?? '(주소 없음)'}`
}

/**
 * 게시할 본문 (D173, D194, D207): 스레드 없는 답글의 원래 코멘트 링크, 초안, 빈 줄, 표시 문구, 보이지 않는 표시 차례다
 */
export function replyBody(p: {
  link: string | null
  draft: string
  signature: string
  marker: string
}): string {
  return [...(p.link ? [p.link, ''] : []), p.draft.trim(), '', p.signature.trim(), p.marker].join(
    '\n',
  )
}

/** 보이지 않는 표시를 뺀 본문: 승인 화면이 보이는 게시될 모양이다 (D207) */
export function visibleBody(reply: Pick<PrReply, 'body' | 'marker'>): string {
  return reply.body.replace(reply.marker, '').trimEnd()
}

export interface PlanRoundInput {
  workId: string
  task: Pick<TaskRecord, 'id'> & { respond: Pick<RespondRound, 'round' | 'items'> }
  /** pr-items.json의 항목 */
  items: readonly PrItem[]
  /** replies.md의 내용. 형식 검사를 지난 것이다 (D190, D204) */
  replies: string | undefined
  /** 표시 문구 (D173) */
  signature: string
  /** 이 라운드의 앞 기록 (앞 승인이 실패했거나 끊겼음) */
  prior: PrRound | undefined
}

/**
 * 승인할 때 이 라운드에 게시할 답글을 정한다 (D172, D190, D194, D207). 코멘트 항목마다 replies.md의 초안으로 게시할
 * 본문을 만든다. 이미 게시했거나 건너뛴 답글은 그대로 둔다. 게시를 시도했지만 결과를 모르는 답글은 시도한 때를 남긴다:
 * 보이지 않는 표시는 라운드와 항목으로 정해 늘 같으므로 [다시 시도]가 원격에서 찾는다. push한 기록도 그대로 둔다
 */
export function planRound(i: PlanRoundInput): PrRound {
  const drafts = new Map(replySections(i.replies ?? '').map((s) => [s.id, s.body]))
  const index = new Map(i.items.map((x) => [x.id, x]))
  const { round } = i.task.respond
  const replies = replyItemIds(i.task.respond.items).map((id): PrReply => {
    const prev = i.prior?.replies.find((r) => r.item === id)
    if (prev && (prev.comment_id !== undefined || prev.skipped !== undefined)) return prev
    const item = index.get(id) ?? { id, kind: kindOfId(id) }
    const thread = replyThread(item)
    const marker = replyMarker(i.workId, id, round)
    return {
      item: id,
      thread,
      body: replyBody({
        link: thread === null ? replyLink(item) : null,
        draft: drafts.get(id) ?? '',
        signature: i.signature,
        marker,
      }),
      marker,
      ...(prev?.attempted_at ? { attempted_at: prev.attempted_at } : {}),
    }
  })
  const prior = i.prior
  return {
    task_id: i.task.id,
    round,
    ...(prior?.pushed ? { pushed: prior.pushed } : {}),
    ...(prior?.pushed_with ? { pushed_with: prior.pushed_with } : {}),
    replies,
  }
}

/** 아직 게시하지 않은 답글: 코멘트 id가 없고 건너뛰지 않았다 (D194의 [다시 시도]) */
export function unpostedReplies(round: Pick<PrRound, 'replies'>): PrReply[] {
  return round.replies.filter((r) => r.comment_id === undefined && r.skipped === undefined)
}

/** GitHub에서 없어진 코멘트의 답글을 건너뛴 까닭 (D205) */
export const GONE_SKIP = '코멘트가 없어져 게시하지 않음'

// ---------- 기존 테스트 변경 (D180, D202) ----------

/** 테스트 폴더 이름 (D202, 기본값). 대소문자는 가리지 않는다 */
const TEST_DIRS: readonly string[] = ['test', 'tests', '__tests__', 'spec']

/**
 * 테스트 파일 모양인가 (D202, 기본값): 경로에 test, tests, __tests__, spec 폴더가 있거나 이름이 *.test.*, *.spec.*,
 * *_test.*, test_*.*다
 */
export function isTestPath(file: string): boolean {
  const parts = file.replace(/\\/g, '/').split('/').filter(Boolean)
  const name = parts.pop() ?? ''
  if (parts.some((d) => TEST_DIRS.includes(d.toLowerCase()))) return true
  return (
    /\.(test|spec)\.[^.]+/i.test(name) ||
    /_test\.[^.]+$/i.test(name) ||
    /^test_.+\.[^.]+$/i.test(name)
  )
}

/** 라운드 시작 커밋과 지금 작업 트리의 차이 한 줄: 상태(M, D, A, T 등)와 경로 (git diff --name-status --no-renames) */
export interface NameStatus {
  status: string
  path: string
}

/**
 * 이번 라운드에 바뀌거나 지워진 기존 테스트 파일 (D202): 라운드 시작 커밋에 있던 파일(새로 만든 A가 아님) 가운데 테스트
 * 파일 모양인 것이다. 에이전트의 보고(risks)에 기대지 않는다
 */
export function existingTestChanges(changes: readonly NameStatus[]): string[] {
  return changes.filter((c) => !c.status.startsWith('A') && isTestPath(c.path)).map((c) => c.path)
}

// ---------- 다시 실행 (D175, D203) ----------

export interface RerunPlan {
  /** 다시 실행할 Actions 실행. 겹치지 않게 한 번씩이다 */
  runs: number[]
  /** 그 실행들의 실패한 체크 이름 */
  checks: string[]
  /** Actions 밖의 실패한 체크: 사람이 GitHub에서 다시 실행한다 */
  others: string[]
}

/**
 * [실패한 체크 다시 실행]이 다시 돌릴 것 (D175, D203): 마지막으로 읽은 head에서 실패한 체크 가운데 링크가 Actions 실행인
 * 것의 실행이다. 대응 task의 결론과 관계없다. 실패한 Actions 체크가 없으면 runs가 비어 버튼을 보이지 않는다
 */
export function rerunPlan(read: Pick<PrReadState, 'checks'> | null): RerunPlan {
  const failing = (read?.checks ?? []).filter((c) => c.bucket === 'fail')
  const actions = failing.filter((c) => c.run !== null)
  return {
    runs: [...new Set(actions.map((c) => c.run as number))],
    checks: actions.map((c) => c.label),
    others: failing.filter((c) => c.run === null).map((c) => c.label),
  }
}

// ---------- 판정표 경고 (D180, D206) ----------

/**
 * 머지 창의 "판정표는 대응 전 코드 기준" 경고 (D180, D206): 커밋을 push한 대응 라운드 수와 fast-forward로 받은 원격 커밋
 * 수. 둘 다 없으면 null이다(머지할 head가 verify가 본 코드다)
 */
export function staleVerdicts(
  file: Pick<PrItemsFile, 'rounds' | 'synced'>,
): { rounds: number; synced: number } | null {
  const rounds = file.rounds.filter((r) => (r.pushed?.commits.length ?? 0) > 0).length
  const synced = file.synced.reduce((n, s) => n + s.commits.length, 0)
  return rounds || synced ? { rounds, synced } : null
}

// ---------- 자동 대응 (D154, D159, D169, D171, D183, D184, D210) ----------

/** 대응 자동 시작이 켜져 있는가: Work 설정, 앱 설정 차례로 본다 (D72, D154) */
export function autoStartOn(
  config: Pick<AppConfig, 'respond_auto_start'>,
  settings: Pick<WorkSettings, 'respond_auto_start'>,
): boolean {
  return settings.respond_auto_start ?? config.respond_auto_start
}

/** PR 대응의 자동 승인이 켜져 있는가: Work 설정, 앱 설정 차례로 본다 (D72, D169) */
export function autoApproveOn(
  config: Pick<AppConfig, 'auto_approve'>,
  settings: Pick<WorkSettings, 'auto_approve'>,
): boolean {
  return settings.auto_approve?.respond ?? config.auto_approve.respond
}

/** 사람 손 없이 이어진 대응 라운드 수 (D171, D191). 기록이 없으면 0이다 */
export function autoRounds(work: Pick<WorkState, 'pr'>): number {
  return work.pr?.auto_rounds ?? 0
}

/** 자동 시작이 상한 때문에 거절된 까닭 (D171) */
export const AUTO_LIMIT =
  '사람 손 없이 이어진 대응 라운드가 상한에 닿음: [대응 시작]을 누르면 다시 셈 (D171)'

/**
 * 읽은 결과로 자동 시작을 바랄 것인가 (D159, D210): 앱을 켤 때 읽은 것(quiet)이 아니고, 받은 새 항목이 있고, 그때 대응
 * 자동 시작이 켜져 있다. 자동 시작을 켤 때와 사람의 [받기]·[다시 넣기]는 읽기가 아니라 바라지 않는다. 바람은 시작하거나
 * 멈추거나 새 항목이 없어질 때까지 남아, 도는 대응 task가 끝나면 바로 시작한다
 */
export function wantsAutoStart(p: { quiet: boolean; received: number; on: boolean }): boolean {
  return !p.quiet && p.received > 0 && p.on
}

/**
 * 자동 시작의 판정 (D154, D170, D171, D210).
 * - off: 대응 자동 시작이 꺼져 있다. 바람을 버린다
 * - none: PR 진행이 아니거나 넣을 새 항목이 없다. 바람을 버린다
 * - wait: 끝나지 않은 대응 task, 진행 중 작업, 닫힌 PR이 있다. 풀리면 다시 본다 (D170)
 * - paused: 사람 손 없이 이어진 라운드가 상한에 닿아 다음 라운드가 상한을 넘는다. 시작하지 않고 멈추고 알린다 (D171)
 * - start: 제외하지 않은 새 항목 전부로 다음 라운드를 시작한다 (D170)
 */
export type AutoPlan =
  | { kind: 'off' }
  | { kind: 'none' }
  | { kind: 'wait'; reason: string }
  | { kind: 'paused'; items: string[]; rounds: number; max: number }
  | { kind: 'start'; items: string[]; round: number }

export function autoPlan(
  work: Pick<WorkState, 'status' | 'pr' | 'operation' | 'tasks' | 'settings'>,
  items: readonly PrItem[],
  config: Pick<AppConfig, 'respond_auto_start' | 'respond_auto_round_max'>,
): AutoPlan {
  if (!autoStartOn(config, work.settings)) return { kind: 'off' }
  if (work.status !== 'pr' || !work.pr) return { kind: 'none' }
  const blocked = respondBlocked(work)
  if (blocked) return { kind: 'wait', reason: blocked }
  const ids = newItemIds(items)
  if (!ids.length) return { kind: 'none' }
  const rounds = autoRounds(work)
  const max = config.respond_auto_round_max
  if (rounds >= max) return { kind: 'paused', items: ids, rounds, max }
  return { kind: 'start', items: ids, round: nextRound(work) }
}

/**
 * 읽기가 받은 새 항목을 "대응 거리가 들어옴"으로 알릴 것인가 (D184, D211). 자동 시작이 꺼져 있으면 알린다. 켜져 있으면
 * 자동 대응이 시작하거나 상한에서 멈추며 그것을 알리고, 도는 라운드(끝나지 않은 대응 task)를 기다리면 그 라운드가
 * 끝날 때 이어서 시작하므로 알리지 않는다. 그 라운드가 사람을 기다리면 그 상태로 알린다(D81). 중단된 대응 task와 닫힌
 * PR은 사람이 손대야 풀린다: 알리지 않으면 새 항목이 조용히 쌓인다. 진행 중 작업이 있으면 읽기를 반영하지 않아
 * 여기 오지 않는다
 */
export function receivedNeedsNotice(
  work: Pick<WorkState, 'status' | 'pr' | 'operation' | 'tasks' | 'settings'>,
  items: readonly PrItem[],
  config: Pick<AppConfig, 'respond_auto_start' | 'respond_auto_round_max'>,
): boolean {
  const plan = autoPlan(work, items, config)
  if (plan.kind === 'start' || plan.kind === 'paused') return false
  if (plan.kind !== 'wait') return true
  if (work.pr?.closed_at) return true
  return pendingRespond(work)?.status === 'interrupted'
}

/** 자동 대응을 시작했다는 알림 (D184) */
export function autoStartNotice(pr: number, round: number, items: number): string {
  return `PR #${pr}: 자동 대응 시작 — 라운드 ${round}, 새 항목 ${items}개`
}

/** 상한에 닿아 자동 시작을 멈췄다는 알림 (D171, D184) */
export function autoPausedNotice(pr: number, max: number, items: number): string {
  return `PR #${pr}: 자동 대응 멈춤 — 사람 손 없이 이어진 라운드가 상한(${max})에 닿음. 새 항목 ${items}개는 [대응 시작]으로 대응하세요 (누르면 다시 셈)`
}

/**
 * PR 패널의 자동 대응 (D154, D169, D171, D183): 설정과 어디서 정했는지, 사람 손 없이 이어진 라운드와 상한, 멈춤. 멈춤은
 * 자동 시작이 켜져 있고 받은 새 항목이 있는데 상한 때문에 시작하지 않는 것이다(배지 "자동 대응 멈춤")
 */
export function autoRespondView(
  work: Pick<WorkState, 'status' | 'pr' | 'operation' | 'tasks' | 'settings'>,
  items: readonly PrItem[],
  config: Pick<AppConfig, 'respond_auto_start' | 'respond_auto_round_max' | 'auto_approve'>,
): AutoRespondView {
  const settings = work.settings
  const start = autoStartOn(config, settings)
  const approve = autoApproveOn(config, settings)
  const startFromWork = settings.respond_auto_start !== undefined
  const approveFromWork = settings.auto_approve?.respond !== undefined
  const rounds = autoRounds(work)
  const max = config.respond_auto_round_max
  const paused = autoPlan(work, items, config).kind === 'paused'
  const from = (w: boolean) => (w ? '이 Work' : '앱 설정')
  const text = paused
    ? `자동 대응 멈춤: 사람 손 없이 이어진 라운드가 상한(${max})에 닿아 새 항목으로 자동 시작하지 않습니다. [대응 시작]을 누르면 다시 셉니다 (D171)`
    : start
      ? `대응 자동 시작 켜짐(${from(startFromWork)}) · 자동 승인 ${approve ? '켜짐' : '꺼짐'}(${from(approveFromWork)}) · 사람 손 없이 이어진 라운드 ${rounds}/${max}`
      : `대응 자동 시작 꺼짐(${from(startFromWork)}): 새 항목은 [대응 시작]으로 대응합니다 · 자동 승인 ${approve ? '켜짐' : '꺼짐'}(${from(approveFromWork)})`
  return { start, startFromWork, approve, approveFromWork, rounds, max, paused, text }
}
