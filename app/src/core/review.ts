// 사람에게 보일 것: task 이름과 머리 띠(D109), 상태 이름, 승인 화면의 강조 영역과 [변경]의 범위(D83),
// Work 완료 화면의 판정표(시나리오 7-3). 화면은 main이 이 값으로 만든 스냅샷을 그리기만 한다 (I14).
import type { Handoff, TaskNode } from '../shared/contracts'
import type { Completion, Emphasis, StageLead, Verdict } from '../shared/views'
import type {
  FormatIssue,
  StartReason,
  TaskRecord,
  TaskStatus,
  WorkState,
  WorkStatus,
  TypeTarget,
  WorkType,
} from '../shared/work'
import { badge, holdNeedsNotice, holdText } from './approval'
import {
  NODE_INFO,
  WORK_COMPLETE,
  customSections,
  finishesWork,
  nextStage,
  nodeTitle,
  stageOf,
  taskTitle,
} from './pipeline'
import {
  DESIGN_FILE,
  FIX_FILE,
  IMPLEMENT_FILE,
  REFACTOR_FILE,
  SPEC_FILE,
  EXECUTION_FILE,
  ALREADY_REVIEWED,
  HANDOFF_FILE,
  INTENT_DRAFT_FILE,
  VERIFICATION_FILE,
  intentDraftBody,
  normalizeText,
  parseFrontMatter,
  sectionText,
} from './validate'

const pad = (n: number) => String(n).padStart(2, '0')

/** 탭과 사이드바의 task 이름: "02 원인 분석과 수정" (D109) */
export function taskLabel(task: Pick<TaskRecord, 'seq' | 'node' | 'step' | 'step_title'>): string {
  return `${pad(task.seq)} ${nodeTitle(task)}`
}

/**
 * 머리 띠의 이유 문구 (시나리오 2-5): 기본 진행 / 재개, PR 대응 task는 대응 시작과 자동 대응이다. 되감기와 건너뛰기는
 * D418 전에 만든 task에만 있다 (D424)
 */
export const REASON_LABEL: Readonly<Record<StartReason, string>> = {
  default: '기본 진행',
  rewind: '되감기',
  skip: '건너뛰기',
  resume: '재개',
  respond: '대응 시작',
  auto_respond: '자동 대응',
}

/**
 * 탭 위 머리 띠: "02 원인 분석과 수정 · 새 세션 · 이유: 기본 진행" (시나리오 2-5, D109).
 * --resume으로 다시 연 세션은 "세션 재개"다 (시나리오 3-4).
 */
export function bandText(
  task: Pick<TaskRecord, 'seq' | 'node' | 'reason'> & Partial<Pick<TaskRecord, 'session'>>,
): string {
  const session = task.session?.resumed_at ? '세션 재개' : '새 세션'
  return `${taskLabel(task)} · ${session} · 이유: ${REASON_LABEL[task.reason]}`
}

const BYPASS_MODE = 'bypassPermissions'

/** 첫 UserPromptSubmit의 permission_mode가 권한 확인 끈 모드가 아니면 머리 띠에 보일 경고 (D94, 7절) */
export function permissionNotice(task: Pick<TaskRecord, 'permission_mode'>): string | null {
  const mode = task.permission_mode
  return mode === undefined || mode === BYPASS_MODE
    ? null
    : `권한 확인 끈 모드가 아님(${mode} 모드): 일부 동작이 막힐 수 있음`
}

/**
 * 형식 되돌림(D21) 뒤 에이전트가 고치는 동안의 안내 (D220). 터미널의 "Stop hook error"가 작업 결과와 관계없음을
 * 알린다. 작업 중이 아니면(고쳐서 승인 대기가 됐거나 상한까지 되돌려 대기면) 없다
 */
export function bounceNotice(
  task: Pick<TaskRecord, 'status' | 'bounce_count'>,
  max: number,
): string | null {
  return task.status === 'working' && task.bounce_count > 0
    ? `형식 확인으로 되돌림(${task.bounce_count}/${max}): 에이전트가 handoff와 산출물의 형식만 고칩니다. 결정과 판정은 바뀌지 않습니다.`
    : null
}

/**
 * 화면에 보일 형식 오류. 마무리 단계가 독립 리뷰를 요청한 뒤로는 리뷰하는 동안(D496), 다시 열기 전(대기열 D18, 끊김 I185),
 * 다시 연 세션의 턴 안(질문을 기다릴 때 포함)에서 handoff가 리뷰를 요청할 때 쓴 그대로라 "이미 받음" 오류(D494)를
 * 보이지 않는다: 에이전트가 마무리하며 고쳐 쓴다. 다시 연 세션의 턴이 끝나면(대기, 되돌림 D21) 그대로 보인다
 */
export function shownErrors(
  task: Pick<TaskRecord, 'status' | 'bounce_count' | 'review'>,
  status: string | null,
  errors: readonly FormatIssue[],
): FormatIssue[] {
  // 다시 연 세션의 턴 안: 작업 중, 질문(AskUserQuestion), 입력 필요
  const turn = ['working', 'asking', 'input_needed'].includes(task.status)
  // 리뷰가 끝났지만 아직 다시 열지 않음: 대기열(D18)이나 앱을 다시 켜 끊긴 것(I185)
  const unopened =
    (task.status === 'queued' || task.status === 'interrupted') &&
    task.review?.resumed_at === undefined
  const waiting = task.status === 'reviewing' || unopened || (turn && task.bounce_count === 0)
  const leftover = status === 'review_requested' && task.review !== undefined && waiting
  return leftover
    ? errors.filter((e) => !(e.file === HANDOFF_FILE && e.message === ALREADY_REVIEWED))
    : [...errors]
}

/** 진행 표시에서 도구 인자의 길이 (D216) */
const TOOL_ARG_MAX = 40

/** 도구 입력에서 인자로 보일 키. 앞의 것부터 본다. 경로 키는 작업 폴더 안이면 상대 경로로 보인다 */
const TOOL_ARG_KEYS = [
  'command',
  'cmd',
  'input',
  'file_path',
  'notebook_path',
  'pattern',
  'url',
  'query',
  'description',
  'path',
]
const PATH_KEYS = ['file_path', 'notebook_path', 'path']

/**
 * 진행 표시의 도구 이름과 짧은 인자 (D216). 예: "Bash(npm test)", "Edit(src/avg.js)". 인자는 도구 입력에서 하나만
 * 골라 첫 줄을 줄여 보인다. 인자가 없는 도구는 이름만 보인다
 */
export function toolLabel(name: string, input: unknown, cwd?: string): string {
  const fields =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const key = TOOL_ARG_KEYS.find((k) => typeof fields[k] === 'string' && fields[k].trim() !== '')
  if (key === undefined) return name
  const value = String(fields[key])
  return `${name}(${shorten(PATH_KEYS.includes(key) ? relativeTo(value, cwd) : value)})`
}

/** 작업 폴더 안의 경로는 작업 폴더 뒤만 남긴다. 구분자는 /와 \ 둘 다 본다 */
function relativeTo(file: string, cwd?: string): string {
  if (!cwd) return file
  const base = cwd.replace(/[\\/]+$/, '')
  const rest = file.slice(base.length)
  return file.startsWith(base) && /^[\\/]./.test(rest) ? rest.slice(1) : file
}

/** 첫 줄을 공백을 줄여 보이고, 뒤에 더 있거나 길면 …를 붙인다 */
function shorten(value: string): string {
  const lines = value.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim())
  const first = lines.find((l) => l !== '') ?? ''
  const more = lines.filter((l) => l !== '').length > 1
  if (first.length > TOOL_ARG_MAX) return `${first.slice(0, TOOL_ARG_MAX - 1)}…`
  return more ? `${first} …` : first
}

/**
 * Work 완료 화면의 독립 리뷰 표시 (D495, D497). 마무리 단계가 아니면(옛 Work의 verify) null이다. 리뷰를 요청하지 않았거나 끝나지
 * 않았으면 none이다(형식 오류를 무시하고 승인할 수 있게 된 때 등)
 */
export function completionReview(
  work: Pick<WorkState, 'type' | 'custom_type' | 'pipeline'>,
  task: Pick<TaskRecord, 'node' | 'step' | 'review'>,
): Completion['review'] {
  if (!finishesWork(work, task)) return null
  const r = task.review
  if (!r?.finished_at) return { state: 'none' }
  if (r.error) return { state: 'failed', error: r.error }
  return { state: r.code_review ? 'ok' : 'off' }
}

/**
 * task의 독립 리뷰 표시 (D495, D496): 도는 중(running)이거나, 끝났지만 결과로 세션을 아직 다시 열지 않았다(ready). 아니면 null
 */
export function reviewState(
  task: Pick<TaskRecord, 'review'>,
): { state: 'running' | 'ready'; codeReview: boolean } | null {
  const r = task.review
  if (!r || r.resumed_at !== undefined) return null
  return { state: r.finished_at === undefined ? 'running' : 'ready', codeReview: r.code_review }
}

/** task 표시 이름 (3.3, 시나리오 3) */
export const TASK_STATUS_LABEL: Readonly<Record<TaskStatus, string>> = {
  queued: '대기열',
  working: '작업 중',
  asking: '질문 대기',
  input_needed: '입력 필요',
  idle: '대기',
  awaiting_approval: '승인 대기',
  blocked: '막힘',
  reviewing: '독립 리뷰 중',
  session_ended: '세션 종료',
  interrupted: '중단됨',
  approved: '승인됨',
  discarded: '폐기됨',
}

/** Work 표시 이름 (3.3) */
export const WORK_STATUS_LABEL: Readonly<Record<WorkStatus, string>> = {
  active: '진행 중',
  stopped: '멈춤',
  pr: 'PR 진행',
  completed: '완료',
  abandoned: '포기',
  archived: '보관됨',
}

/** Work가 멈춘 이유: [이 단계 끝나면 멈춤](시나리오 3-4). 이전 단계 추천(D23)으로 멈춘 것은 D418 전 기록이다 (D424) */
export function stopNotice(work: WorkState): string | null {
  const stop = work.stop
  if (work.status !== 'stopped' || !stop) return null
  if (stop.kind === 'recommended_back') {
    return `이전 단계 추천으로 멈춤: ${NODE_INFO[stop.node].title}(${stop.node})로 — ${stop.reason}`
  }
  const task = work.tasks.find((t) => t.id === stop.task_id)
  return `이 단계 끝나면 멈춤: ${task ? taskLabel(task) : stop.task_id} 승인 뒤 멈춤`
}

/**
 * 멈춘 Work에서 [재개]가 할 일 (3.3). 멈추게 한 task의 기본 다음 단계를 시작한다. 파이프라인은 앞으로만 간다 (D418).
 * verify에서 멈췄으면 [재개] 대신 Work 완료 화면의 전달 버튼으로 Work를 완료한다 (D119).
 */
export function resumeHint(work: WorkState): string | null {
  const stop = work.stop
  if (work.status !== 'stopped' || !stop) return null
  const task = work.tasks.find((t) => t.id === stop.task_id)
  // 멈추는 것은 파이프라인 task의 승인뿐이다. PR 대응 task는 멈추지 않는다 (D188)
  const stage = task ? stageOf(task) : null
  const next = stage ? nextStage(work, stage) : null
  if (next === WORK_COMPLETE) return 'Work 완료 화면에서 전달을 고르면 Work를 완료합니다.'
  const action =
    next === null ? '기본 다음 단계로 갑니다' : `다음 단계(${taskTitle(work, next)})를 시작합니다`
  return `[재개]하면 ${action}.`
}

/**
 * 알릴 문구 (D81). 보고 있는 Work인지는 main이 가린다.
 * - 자동 승인 카운트다운을 시작했다 (D81). 사람은 [취소]로 멈출 수 있다
 * - 사람이 누르지 않았는데 자동 승인하지 않게 됐다: 조건을 어겨 카운트다운하지 않거나, 카운트다운 중에 세션이 끝나거나
 *   조건을 어겨 멈췄다 (D130). 사람이 누른 [취소]·[즉시 중단]·[단계 선택], 앱 종료, 설정 변경, 재시작 조정은
 *   알리지 않는다 (D145)
 * - 배지(D80)가 사람이 필요한 상태로 바뀌었다: 질문 대기·입력 필요, 승인 대기, 막힘, 멈춤, handoff 없이 세션 종료
 */
export function humanNotice(before: WorkState, after: WorkState): string | null {
  const task = after.tasks[after.tasks.length - 1]
  const prior = task ? before.tasks.find((t) => t.id === task.id) : undefined
  const c = task?.countdown
  if (task && c && c.started_at !== prior?.countdown?.started_at) {
    return `${taskLabel(task)}: ${c.seconds}초 뒤 자동 승인 (멈추려면 [취소])`
  }
  const hold = task?.auto_hold
  if (task && hold && hold.at !== prior?.auto_hold?.at && holdNeedsNotice(hold.reasons)) {
    return `${taskLabel(task)}: 승인 대기 — 자동 승인하지 않음(${holdText(hold.reasons)})`
  }
  const b = badge(after)
  if (!b.hot || badge(before).kind === b.kind) return null
  if (b.kind === 'stopped') return stopNotice(after)
  // 끊긴 작업은 되감기가 코드를 바꾼 뒤 실패했을 때도 생긴다 (D136). 재시작 조정은 알리지 않는다
  if (b.kind === 'recovery') return '끊긴 작업이 있습니다: [다시 시도]나 [무시]를 누르세요'
  if (!task) return null
  return b.kind === 'session_ended'
    ? `${taskLabel(task)}: handoff 없이 세션 종료`
    : `${taskLabel(task)}: ${b.label}`
}

// ---------- 승인 화면 (D83) ----------

export type { Emphasis, Verdict }

/** 승인 화면의 [변경]이 보일 코드 범위. to가 null이면 작업 트리(커밋 안 된 변경 포함)까지다 */
export interface ChangeRange {
  from: string
  to: string | null
}

/**
 * [변경] 탭(D83: 이 task의 diff)의 범위. task의 시작 커밋부터 코드가 다음에 바뀐 때까지다.
 * 다음에 시작한 task가 있으면 그 시작 커밋까지다. 코드를 되돌린 되감기가 먼저 오면 되돌리기 전의 코드,
 * 곧 백업 커밋(커밋 안 된 변경 포함, D116)까지다. 백업이 없었으면 되돌리기 전 HEAD다.
 * 뒤에 코드를 바꾼 task가 없으면 지금 코드의 마지막 task라 작업 트리까지다. 정리한 Work(보관됨)는
 * 작업 트리가 없어 정리하기 전 HEAD까지다(시나리오 8). 정리 중인 Work도 지우는 worktree를 읽지 않게 정리를 시작할 때의
 * HEAD까지다. 시작하지 않은 task는 null이다.
 */
export function changeRange(work: WorkState, taskId: string): ChangeRange | null {
  const i = work.tasks.findIndex((t) => t.id === taskId)
  const from = work.tasks[i]?.start_commit
  if (!from) return null
  for (const next of work.tasks.slice(i + 1)) {
    const reset = next.selection?.reset
    if (reset) return { from, to: reset.backup_commit ?? reset.from }
    if (next.start_commit) return { from, to: next.start_commit }
  }
  if (work.status === 'archived') return { from, to: work.cleaned?.head ?? from }
  // 정리 중에는 worktree를 지우고 있어 작업 트리 대신 정리를 시작할 때의 HEAD까지 본다
  if (work.operation?.kind === 'clean') return { from, to: work.operation.head ?? from }
  return { from, to: null }
}

/**
 * 묶음 Work의 서브모듈 하나에서 [변경] 탭의 범위 (D475). changeRange와 같은 규칙을 그 레포의 시작 커밋(repo_starts)으로
 * 한다. 그 레포의 worktree가 없던 때 시작한 task(나중에 [레포 추가]로 더함)는 null이다. 되감기(D418 전)는 묶음 Work에
 * 없다
 */
export function repoChangeRange(
  work: WorkState,
  taskId: string,
  repoPath: string,
): ChangeRange | null {
  const i = work.tasks.findIndex((t) => t.id === taskId)
  const from = work.tasks[i]?.repo_starts?.[repoPath]
  if (!from) return null
  for (const next of work.tasks.slice(i + 1)) {
    const to = next.repo_starts?.[repoPath]
    if (to) return { from, to }
  }
  return repoEndRange(work, repoPath, from)
}

/**
 * 묶음 Work의 서브모듈 하나에서 from부터 지금 코드까지의 범위: 보관된 Work는 정리하기 전 HEAD, 정리 중이면 정리를 시작할
 * 때의 HEAD, 아니면 작업 트리(null)다 (changeRange와 같음)
 */
export function repoEndRange(work: WorkState, repoPath: string, from: string): ChangeRange {
  if (work.status === 'archived') return { from, to: work.cleaned?.repos?.[repoPath]?.head ?? from }
  const op = work.operation
  if (op?.kind === 'clean') {
    return { from, to: op.repos?.find((r) => r.path === repoPath)?.head ?? from }
  }
  return { from, to: null }
}

export interface EmphasisInput {
  node: TaskRecord['node']
  /** Work의 업무 유형. 이전 단계는 유형의 파이프라인으로 가른다 (3.2) */
  type: WorkType
  /** 스키마를 통과한 handoff 머리글. 읽지 못했으면 null */
  handoff: Handoff | null
  errors: readonly FormatIssue[]
  /** worktree의 커밋 안 된 변경 (git status) */
  uncommitted: readonly string[]
  /** 안에 커밋 안 된 변경이 있는 서브모듈 (D384). 없으면 없다 */
  submodules?: readonly string[]
  /** 서브모듈 Work의 메인 통합 검증 worktree (D414, D415). 없으면 없다 */
  integration?: IntegrationFacts
  /** 묶음 Work의 레포들 (D471, D475). 없으면 없다 */
  bundle?: BundleFacts
  /** PR 대응 task: 이번 라운드에 바뀌거나 지워진 기존 테스트 파일 (D180, D202) */
  tests?: readonly string[]
  /** PR 대응 task: 승인 뒤 실패한 push나 답글 게시 (시나리오 10-6) */
  failure?: { stage: string; error: string } | null
  /** 세션이 살아 있다. 아니면 열린 질문의 안내가 [세션 재개]를 먼저 누르라고 한다 (D222). 없으면 살아 있다 */
  live?: boolean
}

/** 승인 화면이 보는 메인 통합 검증 worktree의 사실 (D414, D415). main이 git에서 읽는다 */
export interface IntegrationFacts {
  /** 메인 worktree의 커밋 안 된 변경 가운데 메인 쪽 변경(서브모듈 자리 제외). 전달되지 않는다 */
  mainChanges: readonly string[]
  /** 서브모듈 worktree의 지금 브랜치. 분리된 HEAD면 null */
  branch: string | null
  /** 서브모듈 worktree가 있어야 할 작업 브랜치 (relay/<work-id>) */
  workBranch: string
  /** 앱이 서브모듈 저장소의 core.worktree를 되돌린 적이 있다 */
  repaired: boolean
}

/** 승인 화면이 보는 묶음 Work의 사실 (D471, D475). main이 git에서 읽는다 */
export interface BundleFacts {
  /** 메인을 고르지 않은 묶음 Work의 메인 쪽 변경(고른 서브모듈 자리 제외). 전달되지 않는다. 메인을 고쳤으면 빈 목록이다 */
  mainChanges: readonly string[]
  /** 작업 브랜치에 있지 않은 서브모듈 worktree와 그 지금 브랜치(분리된 HEAD면 null) */
  offBranch: readonly { path: string; branch: string | null }[]
  /** 레포마다 있어야 할 작업 브랜치 */
  workBranch: string
  /** 앱이 서브모듈 저장소의 core.worktree를 되돌린 적이 있다 */
  repaired: boolean
}

/**
 * 강조 영역 (시나리오 4-2, D83): intent_deviation, 열린 질문, 이전 단계 추천, 커밋 안 된 변경 경고, 서브모듈 안의
 * 변경(D384), 형식 오류.
 * PR 대응 task는 승인 뒤 실패한 push나 게시를 맨 앞에, 기존 테스트 변경(D180, D202)을 함께 둔다.
 * 막힘이면 blocked_reason을 맨 앞에 둔다 (4.4). 없으면 빈 목록이다.
 */
export function emphasis(input: EmphasisInput): Emphasis[] {
  const out: Emphasis[] = []
  const f = input.failure
  if (f) {
    out.push({
      kind: 'respond_failed',
      title: `${f.stage} 실패`,
      lines: [
        f.error,
        '[다시 시도]를 누르면 이어서 합니다: 이미 원격에 있는 커밋은 다시 보내지 않고, 게시한 답글은 건너뜁니다.',
      ],
    })
  }
  const h = input.handoff
  if (h?.status === 'blocked' && h.blocked_reason) {
    out.push({ kind: 'blocked', title: '막힘', lines: [h.blocked_reason] })
  }
  if (h?.intent_deviation) {
    const d = h.intent_deviation
    out.push({
      kind: 'intent_deviation',
      title: '의도와 어긋남',
      lines: [d.summary, `근거: ${d.evidence}`],
    })
  }
  if (h && h.open_questions.length > 0) {
    out.push({
      kind: 'open_questions',
      title: '열린 질문',
      lines: [...h.open_questions],
      hint: input.live === false ? OPEN_QUESTIONS_HINT_NO_SESSION : OPEN_QUESTIONS_HINT,
    })
  }
  if (input.tests?.length) {
    out.push({
      kind: 'existing_tests',
      title: '기존 테스트 변경',
      lines: [
        ...input.tests,
        '이번 라운드가 이미 있던 테스트 파일을 바꾸거나 지웠습니다. 대응 뒤에는 독립 리뷰와 완료조건 판정을 다시 하지 않습니다 (D180).',
      ],
    })
  }
  if (input.uncommitted.length > 0) {
    out.push({ kind: 'uncommitted', title: '커밋 안 된 변경', lines: [...input.uncommitted] })
  }
  if (input.submodules?.length) {
    out.push({
      kind: 'submodule_changes',
      title: '서브모듈 안의 변경',
      lines: [...input.submodules],
      hint: '서브모듈 안에서 커밋하지 않은 변경입니다. relay는 이 변경을 커밋하거나 전달하지 않고, [Work 정리] 때 지웁니다. 필요하면 서브모듈 레포에서 따로 다룹니다.',
    })
  }
  const g = input.integration
  if (g && (g.branch !== g.workBranch || g.repaired)) {
    out.push({
      kind: 'submodule_guard',
      title: '서브모듈 worktree',
      lines: [
        ...(g.branch !== g.workBranch
          ? [
              `서브모듈 worktree가 작업 브랜치 ${g.workBranch}에 있지 않습니다 (지금: ${g.branch ?? '분리된 HEAD'}). 전달은 작업 브랜치만 보냅니다. 터미널에서 git switch ${g.workBranch}로 돌아가거나 에이전트에게 맡기세요.`,
            ]
          : []),
        ...(g.repaired
          ? [
              '메인 worktree에서 한 git submodule update가 서브모듈 저장소의 설정(core.worktree)을 바꿔 앱이 되돌렸습니다. 그동안 메인 체크아웃의 서브모듈 폴더에서 git이 실패했을 수 있습니다.',
            ]
          : []),
      ],
    })
  }
  if (g?.mainChanges.length) {
    out.push({
      kind: 'main_changes',
      title: '메인 레포 변경 (전달 안 됨)',
      lines: [...g.mainChanges],
      hint: '통합 검증용 메인 worktree의 변경입니다. 이 Work는 서브모듈 레포만 전달하고 이 변경은 [Work 정리] 때 지웁니다. 메인 레포도 고쳐야 하면 메인 프로젝트에서 따로 Work를 만듭니다.',
    })
  }
  const b = input.bundle
  if (b && (b.offBranch.length > 0 || b.repaired)) {
    out.push({
      kind: 'submodule_guard',
      title: '서브모듈 worktree',
      lines: [
        ...b.offBranch.map(
          (r) =>
            `${r.path}: 작업 브랜치 ${b.workBranch}에 있지 않습니다 (지금: ${r.branch ?? '분리된 HEAD'}). 전달은 작업 브랜치만 보냅니다. 터미널에서 git -C ${r.path} switch ${b.workBranch}로 돌아가거나 에이전트에게 맡기세요.`,
        ),
        ...(b.repaired
          ? [
              '메인 worktree에서 한 git submodule update가 서브모듈 저장소의 설정(core.worktree)을 바꿔 앱이 되돌렸습니다. 그동안 메인 체크아웃의 서브모듈 폴더에서 git이 실패했을 수 있습니다.',
            ]
          : []),
      ],
    })
  }
  if (b?.mainChanges.length) {
    out.push({
      kind: 'main_changes',
      title: '메인 레포 변경 (전달 안 됨)',
      lines: [...b.mainChanges],
      hint: '이 Work는 메인 레포를 고르지 않아 메인 worktree를 기준 커밋에 고정했습니다. 이 변경은 전달하지 않고 [Work 정리] 때 지웁니다. 메인 레포도 고쳐야 하면 새 Work에서 메인 레포를 함께 고르세요.',
    })
  }
  if (input.errors.length > 0) {
    out.push({
      kind: 'format_errors',
      title: '형식 오류',
      lines: input.errors.map((e) => `${e.file}: ${e.message}`),
    })
  }
  return out
}

/** handoff 본문의 `## 요약` 절. 머리글을 읽지 못해도 본문에서 찾는다 */
export function handoffSummary(text: string): string | null {
  const fm = parseFrontMatter(text)
  return sectionText(fm.body, '요약')
}

/** 열린 질문에 답하는 곳 (D222). 선택지 질문이 아니라 handoff에 남은 질문이라 따로 알린다 */
export const OPEN_QUESTIONS_HINT =
  '답은 가운데 터미널에 쓰세요. 답하면 에이전트가 산출물을 고쳐 다시 승인 대기가 됩니다.'

/** 세션이 없을 때(앱이 꺼져 끝난 세션 등) 열린 질문에 답하는 곳. 터미널은 [세션 재개] 전에는 읽기 전용이다 */
const OPEN_QUESTIONS_HINT_NO_SESSION =
  '세션이 끝나 있습니다. [세션 재개]를 누른 뒤 가운데 터미널에 답을 쓰세요. 답하면 에이전트가 산출물을 고쳐 다시 승인 대기가 됩니다.'

/**
 * PTY 출력에 보이는 글자가 있는가 (D217). 제어 문자와 이스케이프 시퀀스(CSI, OSC 등)만 있으면 없다. Windows에서는
 * CLI의 첫 화면보다 ConPTY의 제어 문자가 먼저 오므로, 첫 출력의 시각은 보이는 글자로 잰다
 */
/* eslint-disable no-control-regex -- 터미널의 제어 문자와 이스케이프 시퀀스를 찾는 식이다 */
export function hasVisibleText(data: string): boolean {
  const text = data
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[ -/]*[0-~]/g, '')
  return /[^\s\x00-\x1f\x7f]/.test(text)
}
/* eslint-enable no-control-regex */

/**
 * [요약] 탭 맨 위에 둘 단계의 핵심 (D223): 읽을 파일, 제목, 모을 절. intent 초안은 습관처럼 쓴 머리글이 있으면 떼고
 * 본문에서 찾는다(I58). 여기 없는 단계는 핵심이 없다
 */
const LEAD: Partial<
  Record<TaskNode, { file: string; title: string; sections: string[]; draft?: true }>
> = {
  intake: {
    file: INTENT_DRAFT_FILE,
    title: '의도 초안',
    sections: ['목표', '비목표', '완료조건'],
    draft: true,
  },
  fix: { file: FIX_FILE, title: '원인', sections: ['원인'] },
  design: { file: DESIGN_FILE, title: '설계', sections: ['유저 시나리오', '요구사항'] },
  implement: { file: IMPLEMENT_FILE, title: '구현', sections: ['계획과 달라진 점'] },
  refactor: {
    file: REFACTOR_FILE,
    title: '리팩터링',
    sections: ['계획', '찾은 버그와 받아들인 차이'],
  },
  spec: { file: SPEC_FILE, title: '설계 문답', sections: ['주제 목록'] },
  execute: { file: EXECUTION_FILE, title: '실행', sections: ['계획', '완료조건별 자체 확인'] },
  verify: { file: VERIFICATION_FILE, title: '리뷰 지적', sections: ['리뷰 지적', '반영'] },
}

/**
 * [요약] 탭 맨 위에 둘 이 단계의 핵심 (D223). 의도 정리는 intent 초안의 목표·비목표·완료조건을, 원인 분석과 수정은
 * fix.md의 `## 원인`을, 설계와 계획은 design.md의 `## 유저 시나리오`와 `## 요구사항`을, 구현은 implement.md의
 * `## 계획과 달라진 점`을, 계획과 리팩터링은 refactor.md의 `## 계획`과 `## 찾은 버그와 받아들인 차이`를(D278),
 * 설계 문답은 spec.md의 `## 주제 목록`을(D374), 실행은 execution.md의 `## 계획`과 `## 완료조건별 자체 확인`을(D318), 리뷰와
 * 검증은 verification.md의 `## 리뷰 지적`과 `## 반영`을 보인다(D229, D256). 없는
 * 절은 빼고, 파일이 없거나 보일 절이 하나도 없으면 null이다. 다른 단계도 null이다
 */
export function stageLead(
  node: TaskNode,
  files: Readonly<Record<string, string>>,
  step?: { id: string; title: string; sections: readonly string[]; lead?: readonly string[] },
  finishing = false,
): StageLead | null {
  // 커스텀 단계는 산출물 <단계 id>.md의 정의한 절이다 (D453). 정의가 [요약]에 보일 절을 정했으면 그 절만이다 (D511)
  const lead =
    node === 'custom' && step
      ? {
          file: `${step.id}.md`,
          title: step.title,
          sections: step.lead?.length ? [...step.lead] : [...customSections(step)],
        }
      : LEAD[node]
  const text = lead ? files[lead.file] : undefined
  const own =
    lead && text !== undefined
      ? leadSections(lead.draft ? intentDraftBody(text).body : normalizeText(text), lead.sections)
      : []
  // 마무리 단계는 그 뒤에 verification.md의 리뷰 지적과 반영을 붙인다: 사람이 고른 것을 Work 완료 화면에서 본다 (D499)
  const review = LEAD.verify
  const verification = finishing && review ? files[review.file] : undefined
  const reviewed =
    review && verification !== undefined
      ? leadSections(normalizeText(verification), review.sections)
      : []
  const sections = [...own, ...reviewed]
  if (!sections.length) return null
  return { title: own.length && lead ? lead.title : (review?.title ?? ''), sections }
}

/** body에서 names 절을 차례로 모은다. 없는 절은 뺀다 */
function leadSections(body: string, names: readonly string[]): StageLead['sections'] {
  return names.flatMap((name) => {
    const text = sectionText(body, name)
    return text ? [{ title: name, text }] : []
  })
}

// ---------- Work 완료 화면 (시나리오 7-3) ----------

const VERDICT_SECTION = '완료조건 판정'
const PASS = '통과'

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'))
}

/**
 * verification.md의 `## 완료조건 판정` 표 (5.6.6). 머리 행과 구분 행은 뺀다.
 * 판정이 통과가 아니면(실패, 판정 불가 등) 경고한다 (D59).
 */
export function verdicts(verification: string): Verdict[] {
  const section = sectionText(normalizeText(verification), VERDICT_SECTION)
  if (!section) return []
  const rows = section
    .split('\n')
    .filter((l) => l.trim().startsWith('|'))
    .map(cells)
  return rows
    .slice(1)
    .filter((r) => !r.every((c) => /^:?-+:?$/.test(c)))
    .map(([criterion = '', verdict = '', ...rest]) => ({
      criterion,
      verdict,
      basis: rest.join(' | '),
      warn: !verdict.replace(/[*_`]/g, '').trim().startsWith(PASS),
    }))
}

const REVISIT_SECTION = '다시 볼 결정'
/** "없음"으로 시작하는 줄: 목록 표시, 따옴표, 괄호는 가리지 않고 뒤의 설명("없음 — …")은 받는다 (PR #36 리뷰) */
const NONE = /^[-*\s]*[("“]?없음(?![가-힣])/
/** 템플릿의 안내 줄: `(없으면 "없음")` 꼴. 에이전트가 지우지 않고 남겨도 결정으로 보지 않는다 */
const HINT = /^\(.*없으면.*\)$/

/**
 * Work 완료 화면의 다시 볼 결정 (시나리오 7-3, D362, I106): 문서를 다루는 유형(설계, D510)의 verification.md `## 다시 볼
 * 결정` 본문. 템플릿 안내 줄은 빼고 본다. 코드 유형이거나, 절이 없거나, 남은 줄이 없거나 모두 "없음"이면 null이다
 */
export function revisitDecisions(target: TypeTarget, verification: string): string | null {
  if (target !== 'document') return null
  const lines = (sectionText(verification, REVISIT_SECTION) ?? '')
    .split('\n')
    .filter((l) => l.trim() && !HINT.test(l.trim()))
  return lines.length && !lines.every((l) => NONE.test(l.trim())) ? lines.join('\n') : null
}
