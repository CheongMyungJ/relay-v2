// relay MCP (D516~D526): 바깥 에이전트(호출자)가 부르는 도구의 정의와, 앱의 Work 스냅샷을 호출자가 읽을 모양으로 줄이는 일.
// 도구를 부르는 일은 main/mcp가 하고, 여기는 순수 함수다. 모양은 호출자(모델)가 읽으므로 키는 snake_case로 둔다
import tools from '../shared/mcp-tools.json'
import type { PendingQuestionView } from '../shared/questions'
import type { ReviewView, TaskView, WorkView } from '../shared/views'

/** MCP 도구 하나 (MCP tools/list의 항목) */
export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/** 앱 안의 세션도 부를 수 있는 도구 (D520): 조회만이다 */
export const READ_TOOLS: readonly string[] = [
  'list_projects',
  'list_types',
  'list_works',
  'get_work',
  'wait',
]

/** 앱 안의 세션이 진행 도구를 부를 때 (D520) */
export const IN_APP_REFUSED =
  'relay 앱 안의 세션에서는 relay MCP로 Work를 만들거나 진행하지 않습니다(조회만 됩니다). 새 Work는 Work 초안을 쓰면 사람이 [새 Work로 만들기]로 만듭니다'

/** wait의 제한 시간 (D525) */
export const WAIT_DEFAULT_SEC = 120
export const WAIT_MAX_SEC = 600

/** 세션을 띄운 뒤 첫 턴이 이만큼 늦으면 확인 창을 짐작해 알린다 (D526) */
export const FIRST_TURN_HINT_MS = 60_000

/** 바뀐 diff를 돌려줄 때의 상한 (글자 수) */
export const DIFF_MAX_CHARS = 100_000

/**
 * 도구 목록 (D518). 정의는 src/shared/mcp-tools.json 하나다: 앱이 꺼져 있어도 브리지가 tools/list에 답하도록 브리지도 같은
 * 파일을 읽는다(설치본은 resources/relay-mcp-tools.json). 설명은 호출자가 무엇을 언제 부를지 알게 쓴다
 */
export const MCP_TOOLS: readonly McpTool[] = tools

/** get_work의 지금 단계 */
export interface McpTask {
  id: string
  step: string
  status: string
  status_label: string
  live: boolean
}

/** get_work의 결과 (D526) */
export interface McpWork {
  work: string
  project: string
  title: string
  type: string
  custom_type: string | null
  driver: WorkView['driver']
  status: WorkView['status']
  state: string
  state_key: string
  branch: string
  base_branch: string
  target_branch: string
  task: McpTask | null
  question: PendingQuestionView | null
  review: McpReview | null
  completion: McpCompletion | null
  pr: McpPr | null
  /** 앱에서 사람이 할 일이나 짐작한 막힘 */
  hint: string | null
  next: string[]
  problems: string[]
}

export interface McpReview {
  summary: string | null
  lead: { title: string; text: string }[]
  decisions: { what: string; why: string; by: string }[]
  assumptions: string[]
  risks: string[]
  emphasis: { title: string; lines: string[]; hint: string | null }[]
  errors: string[]
  can_approve: boolean
  can_force: boolean
  artifacts: string[]
  changed_files: string[]
  auto_approve: { on: boolean; hold: string | null; countdown_ends_at: string | null }
  diff?: string
}

export interface McpCompletion {
  verdicts: { criterion: string; verdict: string; basis: string; warn: boolean }[]
  buttons: Record<'complete' | 'push' | 'pr', { enabled: boolean; reason: string | null }>
  review: string | null
  delivery: { choice: string; status: string; error: string | null; pr_url: string | null } | null
}

export interface McpPr {
  url: string
  state: string | null
  ci: string | null
  review: string | null
  mergeable: string | null
  items: { id: string; kind: string; status: string; title: string; url: string | null }[]
  respond: { enabled: boolean; reason: string | null; items: string[] }
  merged: boolean
  ended: boolean
}

/** 끝난 Work (D518의 list_works 기본에서 뺀다) */
export function finished(view: Pick<WorkView, 'status'>): boolean {
  return view.status === 'completed' || view.status === 'abandoned' || view.status === 'archived'
}

/** 지금 task (WorkView.current) */
export function currentTaskView(view: WorkView): TaskView | null {
  return view.tasks.find((t) => t.id === view.current) ?? null
}

/** 턴이 끝난 task 상태: 고칠 점(D524)을 받는다 */
const TURN_ENDED = ['awaiting_approval', 'idle', 'blocked', 'session_ended', 'interrupted']

/**
 * Work 상태와 지금 task 상태를 합친 값 (D526). Work가 진행 중이면 task 상태이고, 질문이 있으면 question이다. 끊긴 작업이
 * 있으면 operation이다(앱에서 사람이 [다시 시도]·[무시]를 고른다)
 */
export function workState(view: WorkView): string {
  if (view.operation) return 'operation'
  if (view.status !== 'active' && view.status !== 'pr') return view.status
  const task = currentTaskView(view)
  if (task?.question) return 'question'
  if (view.status === 'pr' && (!task || task.node !== 'respond' || task.status === 'approved'))
    return 'pr'
  if (!task) return 'working'
  return task.status === 'approved' ? 'working' : task.status
}

/** 지금 부를 수 있는 도구 (D526). 사람이 진행하는 Work는 조회만이다 */
export function nextTools(view: WorkView, review: ReviewView | null): string[] {
  const state = workState(view)
  if (finished(view)) return []
  if (view.driver !== 'caller') return ['wait']
  const task = currentTaskView(view)
  const out: string[] = []
  if (state === 'question') out.push('answer')
  if (state === 'awaiting_approval') {
    if (review?.gate.approve || review?.gate.force) out.push('approve')
    if (review?.completion?.mode === 'deliver') out.push('deliver')
  }
  if (state === 'stopped' || ((state === 'interrupted' || state === 'session_ended') && task))
    out.push('resume')
  if (state === 'blocked' && task && !task.live && task.hasSession) out.push('resume')
  if (TURN_ENDED.includes(state) && task?.hasSession) out.push('revise')
  if (state === 'pr' && view.pr?.respond.enabled) out.push('pr_respond')
  if (['working', 'queued', 'reviewing', 'asking', 'input_needed', 'pr'].includes(state))
    out.push('wait')
  if (view.actions.abandon) out.push('abandon')
  return out
}

/** 앱에서 사람이 할 일이나 짐작한 막힘 (D526) */
export function workHint(view: WorkView, nowMs: number): string | null {
  if (view.operation)
    return `끊긴 작업: ${view.operation.title}. relay 앱에서 사람이 [다시 시도]나 [무시]를 고릅니다`
  if (view.driver === 'human' && !finished(view))
    return '사람이 진행하는 Work입니다. 질문 답과 승인은 relay 앱에서 사람이 합니다'
  const task = currentTaskView(view)
  if (!task) return null
  if (task.error) return `세션을 띄우지 못함: ${task.error}`
  if (task.status === 'input_needed')
    return 'Claude Code가 터미널에서 입력을 기다립니다. relay 앱에서 그 Work의 터미널을 보세요'
  if (task.status === 'asking' && !task.question)
    return '에이전트가 터미널에서 묻고 있습니다. relay 앱에서 그 Work의 터미널을 보세요'
  if (
    task.live &&
    task.activity &&
    !task.activity.turn &&
    nowMs - task.activity.since > FIRST_TURN_HINT_MS
  )
    return '세션을 띄운 지 오래되었는데 첫 턴이 시작하지 않았습니다. 터미널에 Claude Code의 확인 창(권한 확인 끈 모드, 폴더 신뢰)이 떠 있을 수 있습니다. relay 앱에서 그 Work의 터미널을 보고 사람이 수락하세요'
  if (task.notice) return task.notice
  return null
}

/** diff에서 바뀐 파일 경로 (diff --git a/x b/x) */
export function changedFiles(diff: string): string[] {
  const out: string[] = []
  for (const m of diff.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)) {
    const file = m[2] ?? m[1]
    if (file && !out.includes(file)) out.push(file)
  }
  return out
}

/** 승인 화면을 호출자의 모양으로 (D526). 산출물은 task 디렉터리의 경로로 준다 */
export function reviewSummary(
  review: ReviewView,
  task: TaskView | null,
  taskDir: string | null,
  includeDiff: boolean,
): McpReview {
  const sep = taskDir && /\\/.test(taskDir) && !taskDir.includes('/') ? '\\' : '/'
  return {
    summary: review.summary,
    lead: review.lead?.sections ?? [],
    decisions: review.decisions.map((d) => ({ what: d.what, why: d.why, by: d.by })),
    assumptions: review.assumptions,
    risks: review.risks,
    emphasis: review.emphasis.map((e) => ({
      title: e.title,
      lines: e.lines,
      hint: e.hint ?? null,
    })),
    errors: review.errors.map((e) => `${e.file}${e.field ? ` ${e.field}` : ''}: ${e.message}`),
    can_approve: review.gate.approve,
    can_force: !review.gate.approve && review.gate.force,
    artifacts: review.artifacts.map((a) => (taskDir ? `${taskDir}${sep}${a.name}` : a.name)),
    changed_files: changedFiles(review.diff),
    auto_approve: {
      on: review.autoApprove.on,
      hold: review.autoApprove.hold,
      countdown_ends_at: task?.countdown ? new Date(task.countdown.endsAt).toISOString() : null,
    },
    ...(includeDiff
      ? {
          diff:
            review.diff.length > DIFF_MAX_CHARS
              ? `${review.diff.slice(0, DIFF_MAX_CHARS)}\n… (${review.diff.length - DIFF_MAX_CHARS}자 자름)`
              : review.diff,
        }
      : {}),
  }
}

function completionSummary(review: ReviewView): McpCompletion | null {
  const c = review.completion
  if (!c) return null
  const r = c.review
  return {
    verdicts: c.verdicts.map((v) => ({ ...v })),
    buttons: {
      complete: { ...c.buttons.none },
      push: { ...c.buttons.push },
      pr: { ...c.buttons.pr },
    },
    review: r ? (r.state === 'failed' ? `failed: ${r.error ?? ''}` : r.state) : null,
    delivery: c.delivery
      ? {
          choice: c.delivery.choice,
          status: c.delivery.status,
          error: c.delivery.error,
          pr_url: c.delivery.prUrl,
        }
      : null,
  }
}

function prSummary(view: WorkView): McpPr | null {
  const pr = view.pr
  if (!pr) return null
  return {
    url: pr.url,
    state: pr.labels.state,
    ci: pr.labels.ci,
    review: pr.labels.review,
    mergeable: pr.labels.mergeable,
    items: pr.items.map((i) => ({
      id: i.id,
      kind: i.kindLabel,
      status: i.statusLabel,
      title: i.title,
      url: i.url,
    })),
    respond: { ...pr.respond, items: [...pr.respond.items] },
    merged: pr.merged !== null,
    ended: pr.ended !== null,
  }
}

/**
 * wait가 견주는 값 (D525): 호출자가 움직일 일이 바뀌었는가. 진행 표시(도구)와 revision은 넣지 않는다: 일하는 동안 자주
 * 바뀐다
 */
export function stateKey(view: WorkView): string {
  const task = currentTaskView(view)
  return JSON.stringify([
    view.driver,
    view.status,
    workState(view),
    task?.id ?? null,
    task?.status ?? null,
    task?.live ?? null,
    task?.question?.id ?? null,
    task?.countdown?.endsAt ?? null,
    task?.errorCount ?? null,
    view.delivery?.status ?? null,
    view.pr
      ? [view.pr.state, view.pr.ci, view.pr.respond.items.length, view.pr.items.length]
      : null,
    view.operation?.kind ?? null,
  ])
}

/** Work 스냅샷과 승인 화면을 호출자의 모양으로 (D526) */
export function workSummary(o: {
  view: WorkView
  review: ReviewView | null
  taskDir: string | null
  includeDiff?: boolean
  nowMs: number
}): McpWork {
  const { view, review } = o
  const task = currentTaskView(view)
  const reviewable = review?.reviewable === true && task?.status !== 'approved'
  return {
    work: view.key,
    project: view.projectId,
    title: view.title,
    type: view.type,
    custom_type: view.customType?.id ?? null,
    driver: view.driver,
    status: view.status,
    state: workState(view),
    state_key: stateKey(view),
    branch: view.branch,
    base_branch: view.baseBranch,
    target_branch: view.targetBranch,
    task: task
      ? {
          id: task.id,
          step: task.label,
          status: task.status,
          status_label: task.statusLabel,
          live: task.live,
        }
      : null,
    question: task?.question ?? null,
    review:
      review && reviewable ? reviewSummary(review, task, o.taskDir, o.includeDiff === true) : null,
    completion: review && reviewable ? completionSummary(review) : null,
    pr: prSummary(view),
    hint: workHint(view, o.nowMs),
    next: nextTools(view, reviewable ? review : null),
    problems: view.problems.slice(-5),
  }
}
