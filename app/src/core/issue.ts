// 이슈 기록 (설계 3.7, D336~D349). 팀원이 PR을 리뷰할 때 맥락을 볼 수 있게, 앱이 Work의 기록을 GitHub 이슈 하나에
// 덧붙인다. 여기는 순수 로직이다: 전이가 남긴 이벤트로 게시할 항목을 정하고(I97), 이슈 제목·본문과 코멘트의 글을 만들고,
// 원격에서 앱이 올린 글을 표시로 찾는다(D349). gh를 부르고 파일을 읽는 것은 main/work다(I98).
import type { Decision } from '../shared/contracts'
import type {
  IssueCloseReason,
  IssueEntry,
  IssueRecord,
  LifecycleEvent,
  TaskRecord,
  WorkState,
  WorkType,
} from '../shared/work'
import { WORK_TYPE_LABEL } from '../shared/work'
import { nodeTitle } from './pipeline'
import { workBranch } from './records'
import { normalizeText, parseFrontMatter, sectionText } from './validate'

/** 새 이슈에 붙이는 라벨 (D348). 레포에 없으면 앱이 만든다 */
export const ISSUE_LABEL = 'relay'
export const ISSUE_LABEL_COLOR = '5319e7'
export const ISSUE_LABEL_DESCRIPTION = 'relay가 남기는 Work 기록'

/** GitHub 이슈 본문과 코멘트의 상한 (D349) */
export const ISSUE_TEXT_LIMIT = 65_536
/** GitHub 이슈 제목의 상한 (D349) */
export const ISSUE_TITLE_LIMIT = 256
/** 잘린 산출물 끝에 붙이는 말 (D349) */
export const CUT_NOTE = '(잘림. 전문은 relay의 산출물)'

/**
 * 항목의 키 (D349): 새 이슈는 body, task는 task id, 끝은 end, 닫기는 close. 단계 선택의 rewind-<새 task id>는 D418 전에
 * 대기열에 남은 것뿐이다 (D424)
 */
export function issueKey(entry: IssueEntry): string {
  switch (entry.kind) {
    case 'issue':
      return 'body'
    case 'task':
      return entry.task_id
    case 'step':
      return `rewind-${entry.task_id}`
    case 'end':
      return 'end'
    case 'close':
      return 'close'
  }
}

/**
 * 본문과 코멘트 끝에 붙이는 보이지 않는 표시 (D349). 게시 결과를 모를 때 원격에서 이것으로 찾는다. mark는 Work를 만들 때
 * 정한 표시 id(issueMarkId)다: work-id는 앱 하나 안에서만 겹치지 않으므로 팀원의 Work와 가리려고 임의의 글자를 붙인다
 */
export function issueMarker(mark: string, key: string): string {
  return `<!-- relay:${mark}/issue/${key} -->`
}

/** 표시 id (D349): <work-id>-<임의의 16진수>. nonce는 main이 만든다 */
export function issueMarkId(workId: string, nonce: string): string {
  return `${workId}-${nonce}`
}

/** 원격의 글(이슈나 코멘트) 가운데 표시가 있는 것. 없으면 null */
export function findMarked<T extends { body: string }>(
  items: readonly T[],
  marker: string,
): T | null {
  return items.find((i) => i.body.includes(marker)) ?? null
}

/** 이슈 주소 https://<host>/<owner>/<repo>/issues/<n>[#…]의 번호. 읽을 수 없으면 null */
export function issueNumberOf(url: string): number | null {
  const m = /\/issues\/(\d+)(?:[/?#]|$)/.exec(url.trim())
  const n = m ? Number(m[1]) : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}

/** 코멘트 주소 …/issues/<n>#issuecomment-<id>의 id. 읽을 수 없으면 null */
export function commentIdOf(url: string): number | null {
  const m = /#issuecomment-(\d+)\s*$/.exec(url.trim())
  return m ? Number(m[1]) : null
}

/** 코멘트 주소에서 이슈 주소(# 앞) */
export function issueUrlOf(commentUrl: string): string {
  return commentUrl.trim().split('#')[0] ?? commentUrl
}

/** [PR 생성]의 본문 끝에 붙이는 줄 (D346) */
export function withCloses(body: string, issue: number): string {
  return `${body.trimEnd()}\n\nCloses #${issue}\n`
}

// ---------- 대기열 (I97) ----------

/** 다시 한 Work가 이어 쓸 원래 Work의 이슈 (D421) */
export interface InheritedIssue {
  work_id: string
  linked: boolean
  number: number
  url: string | null
}

/**
 * 새 Work의 이슈 기록 (I96). linked는 새 Work 대화상자에 적은 기존 이슈 번호(D338), mark는 표시 id(issueMarkId)다.
 * from이 있으면 다시 한 Work가 원래 Work의 이슈를 이어 쓴다 (D421): 번호와 방식(linked)을 이어받는다
 */
export function newIssueRecord(
  linked: number | null,
  mark: string,
  from?: InheritedIssue,
): IssueRecord {
  if (from) {
    return {
      linked: from.linked,
      number: from.number,
      url: from.url,
      mark,
      pending: [],
      posted: [],
      from_work: from.work_id,
    }
  }
  return { linked: linked !== null, number: linked, url: null, mark, pending: [], posted: [] }
}

/** 이미 있는 이슈에 쓰는가: 새 Work 대화상자에 적은 기존 이슈(D338)거나 원래 Work에서 이어 쓰는 이슈(D421)다 */
function existing(issue: Pick<IssueRecord, 'linked' | 'from_work'>): boolean {
  return issue.linked || issue.from_work !== undefined
}

/**
 * intake 코멘트에 intent를 펼치는가 (D339): 기존 이슈거나 이어 쓰는 이슈(D421)거나 v2부터. 새 이슈의 v1은 본문과 같아 뺀다
 */
export function commentShowsIntent(
  issue: Pick<IssueRecord, 'linked' | 'from_work'>,
  version: number,
): boolean {
  return existing(issue) || version > 1
}

/** 이슈 기록이 시작됐는가: 새 이슈는 만들기가 대기열이나 게시에 있고, 기존 이슈는 무엇이든 올렸거나 올릴 것이 있다 */
function started(issue: IssueRecord): boolean {
  if (existing(issue)) return issue.posted.length > 0 || issue.pending.length > 0
  return issue.posted.some((p) => p.key === 'body') || issue.pending.some((e) => e.kind === 'issue')
}

/**
 * 끝 문구와 닫는 까닭 (D346, D347). work.completed의 payload와 끝낸 뒤의 Work로 정한다. 다시 하려고 포기했으면(D421) 새 Work를
 * 적고, 새 Work가 이슈를 이어 쓰면(issue_kept) 닫지 않는다(redo)
 */
export function endOf(
  work: WorkState,
  event: LifecycleEvent,
): { text: string; reason: IssueCloseReason; redo?: true } | null {
  if (event.type === 'work.abandoned') {
    const by = event.payload['redo_by']
    if (typeof by !== 'string') return { text: 'Work 포기', reason: 'not_planned' }
    const text = `Work 포기: ${by}로 다시 시작`
    return event.payload['issue_kept'] === true
      ? { text, reason: 'not_planned', redo: true }
      : { text, reason: 'not_planned' }
  }
  if (event.type !== 'work.completed') return null
  const delivery = event.payload['delivery']
  const pr = work.pr ? `PR #${work.pr.number}` : 'PR'
  if (delivery === 'pr') {
    return event.payload['merged'] === true
      ? { text: `Work 완료: ${pr} 머지`, reason: 'completed' }
      : { text: `Work 완료(머지 없이 끝냄): ${pr}`, reason: 'not_planned' }
  }
  if (delivery === 'push') {
    return {
      text: `Work 완료(push): 브랜치 \`${workBranch(work)}\``,
      reason: 'completed',
    }
  }
  return { text: 'Work 완료', reason: 'completed' }
}

/**
 * 전이가 남긴 이벤트로 게시할 항목을 정한다 (I97, D336~D347). 이슈 기록이 없는 Work나 더할 것이 없으면 빈 목록이다.
 * - 의도 승인: 새 이슈면 만들기를 먼저(한 번만), 그 뒤 intake 코멘트 (D336, D338)
 * - task 승인: 코멘트. PR 대응은 올리지 않는다 (D340)
 * - Work 끝: 끝 코멘트와, 새 이슈면 닫기 (D346, D347). 이슈 기록이 시작되기 전(의도 승인 전)에는 없다
 */
export function issueEntries(after: WorkState, events: readonly LifecycleEvent[]): IssueEntry[] {
  const issue = after.issue
  if (!issue) return []
  const out: IssueEntry[] = []
  const queued = () => [...issue.pending, ...out]
  const isStarted = () => started({ ...issue, pending: queued() })
  for (const ev of events) {
    if (ev.type === 'task.approved') {
      const task = after.tasks.find((t) => t.id === ev.task_id)
      if (!task || task.node === 'respond') continue
      if (task.node === 'intake') {
        const version = after.intent?.version ?? 1
        if (!existing(issue) && !isStarted()) out.push({ kind: 'issue', intent_version: version })
        out.push({ kind: 'task', task_id: task.id, intent_version: version })
        continue
      }
      if (isStarted()) out.push({ kind: 'task', task_id: task.id })
      continue
    }
    const end = endOf(after, ev)
    if (end && isStarted()) {
      out.push({ kind: 'end', text: end.text })
      if (!issue.linked && !end.redo) out.push({ kind: 'close', reason: end.reason })
    }
  }
  return out
}

// ---------- 글 (D339, D341, D347, D348) ----------

/** intent에서 머리글을 뺀 본문 */
export function intentBody(intent: string): string {
  const fm = parseFrontMatter(intent)
  return (fm.ok ? fm.body : normalizeText(intent)).trim()
}

/** 이슈 제목 (D348): intent `## 목표`의 첫 줄. 256자에서 자른다(D349). 없으면 Work id */
export function issueTitle(intent: string, workId: string): string {
  const goal = sectionText(intentBody(intent), '목표') ?? ''
  const first = goal
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '').trim())
    .find(Boolean)
  const title = first ?? `relay Work ${workId}`
  return title.length > ISSUE_TITLE_LIMIT ? `${title.slice(0, ISSUE_TITLE_LIMIT - 1)}…` : title
}

/** 이슈 본문 (D336): 안내 한 줄, intent(머리글 뺌), 표시 */
export function issueBody(o: {
  workId: string
  mark: string
  type: WorkType
  /** 유형의 화면 이름. 커스텀 유형은 그 이름이다 (D460). 없으면 기본 유형 이름이다 */
  typeName?: string
  intent: string
}): string {
  return limited(
    [
      `> relay Work \`${o.workId}\`(${o.typeName ?? WORK_TYPE_LABEL[o.type]})의 기록이다. 단계가 승인될 때마다 코멘트를 덧붙인다.`,
      intentBody(o.intent),
    ],
    [],
    issueMarker(o.mark, 'body'),
  )
}

const BY_LABEL: Readonly<Record<string, string>> = { human: '사람', ai: 'AI' }

function decisionLines(decisions: unknown): string[] {
  if (!Array.isArray(decisions)) return []
  return decisions.flatMap((d: unknown) => {
    if (!d || typeof d !== 'object') return []
    const x = d as Partial<Record<keyof Decision, unknown>>
    const what = typeof x.what === 'string' ? x.what.trim() : ''
    if (!what) return []
    const why = typeof x.why === 'string' && x.why.trim() ? ` — ${x.why.trim()}` : ''
    const by = typeof x.by === 'string' && BY_LABEL[x.by] ? ` (${BY_LABEL[x.by]})` : ''
    return [`- ${what}${why}${by}`]
  })
}

/** 산출물 하나 */
export interface IssueArtifact {
  name: string
  text: string
}

/**
 * task 코멘트 (D339, D342): 머리 줄 `### <task id> <화면 이름> · 승인(사람/자동)`, intake면 intent, handoff의 `## 요약`과
 * decisions, 접은 산출물, 표시. intake는 산출물(intent 초안) 대신 intent를 펼친다. 새 이슈의 v1은 본문과 같아 뺀다
 */
export function taskComment(o: {
  /** 표시 id (issueMarkId) */
  mark: string
  task: Pick<TaskRecord, 'id' | 'node' | 'approved_by'>
  /** handoff.md. 없으면 null */
  handoff: string | null
  artifacts: readonly IssueArtifact[]
  /** intake에서 펼칠 intent. 빼면 없다 */
  intent?: { version: number; text: string } | null
}): string {
  const by =
    o.task.approved_by === 'auto' ? '자동' : o.task.approved_by === 'caller' ? '호출자' : '사람'
  const head = [`### ${o.task.id} ${nodeTitle(o.task)} · 승인(${by})`]
  if (o.intent) head.push(`**intent v${o.intent.version}**\n\n${intentBody(o.intent.text)}`)
  const fm = o.handoff === null ? null : parseFrontMatter(o.handoff)
  const summary = fm ? sectionText(fm.body, '요약') : null
  head.push(`**요약**\n\n${summary || '(handoff에서 요약을 읽지 못함)'}`)
  const decisions = fm?.ok ? decisionLines(fm.data['decisions']) : []
  if (decisions.length) head.push(`**결정**\n\n${decisions.join('\n')}`)
  const artifacts = o.task.node === 'intake' ? [] : o.artifacts
  return limited(head, artifacts, issueMarker(o.mark, o.task.id))
}

/** D418 전의 단계 선택 코멘트 (D341). 그 앱이 대기열에 남긴 것만 게시한다 (D424) */
export function stepComment(o: {
  /** 표시 id (issueMarkId) */
  mark: string
  task: Pick<TaskRecord, 'id' | 'node' | 'reason' | 'selection'>
  /** 폐기한 task의 이름 ("t-02 원인 분석과 수정") */
  discarded: readonly string[]
}): string {
  const kind = o.task.reason === 'skip' ? '건너뛰기' : '되감기'
  const lines = [
    `### ${kind}: ${o.discarded.join(', ')} 폐기`,
    `앞에 단 이 task들의 코멘트는 더는 유효하지 않다. ${o.task.id} ${nodeTitle(o.task)}부터 다시 한다.`,
  ]
  const instruction = o.task.selection?.instruction?.trim()
  if (instruction) lines.push(`**추가 지시**\n\n${instruction}`)
  return limited(lines, [], issueMarker(o.mark, `rewind-${o.task.id}`))
}

/** 끝 코멘트 (D347): 한 줄과 표시 */
export function endComment(mark: string, text: string): string {
  return `${text}\n\n${issueMarker(mark, 'end')}\n`
}

/** 코드 펜스(``` 또는 ~~~)를 여는 줄의 표시. 닫히지 않았으면 그 표시, 모두 닫혔으면 null */
export function openFence(text: string): string | null {
  let open: string | null = null
  for (const line of normalizeText(text).split('\n')) {
    const m = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (!m?.[1]) continue
    const fence = m[1]
    if (open === null) open = fence
    else if (fence[0] === open[0] && fence.length >= open.length && line.trim() === fence)
      open = null
  }
  return open
}

/** 잘린 글: 닫히지 않은 코드 펜스를 닫고 잘린 말을 붙인다. 잘린 말과 그 뒤가 코드로 보이지 않게 한다 (D349) */
function cut(text: string): string {
  const fence = openFence(text)
  return `${text}${fence ? `\n${fence}` : ''}\n\n${CUT_NOTE}`
}

/**
 * 글을 모은다. 상한(D349)을 넘으면 접은 산출물을 앞부터 남은 만큼만 넣고 잘린 말을 붙인다. 펼친 부분만으로도 넘으면 그
 * 끝을 자른다. 표시는 늘 끝에 있다
 */
function limited(
  parts: readonly string[],
  artifacts: readonly IssueArtifact[],
  marker: string,
): string {
  const tail = `\n\n${marker}\n`
  const room = ISSUE_TEXT_LIMIT - tail.length
  let text = parts.filter(Boolean).join('\n\n')
  // 잘린 말과 닫는 펜스가 들어갈 자리
  const spare = CUT_NOTE.length + 20
  if (text.length > room) return `${cut(text.slice(0, room - spare))}${tail}`
  for (const a of artifacts) {
    const open = `\n\n<details><summary>${a.name}</summary>\n\n`
    const close = '\n\n</details>'
    const body = a.text.trim()
    const left = room - text.length - open.length - close.length
    if (body.length <= left) {
      text += `${open}${body}${close}`
      continue
    }
    const keep = left - spare
    if (keep > 0) text += `${open}${cut(body.slice(0, keep))}${close}`
    else if (room - text.length > CUT_NOTE.length + 2) text += `\n\n${CUT_NOTE}`
    break
  }
  return `${text}${tail}`
}
