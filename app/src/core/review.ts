// 사람에게 보일 것: task 이름과 머리 띠(D109), 상태 이름, 승인 화면의 강조 영역과 [변경]의 범위(D83),
// Work 완료 화면의 판정표(시나리오 7-3). 화면은 main이 이 값으로 만든 스냅샷을 그리기만 한다 (I14).
import type { Handoff } from '../shared/contracts'
import type { Emphasis, Verdict } from '../shared/views'
import type {
  FormatIssue,
  StartReason,
  TaskRecord,
  TaskStatus,
  WorkState,
  WorkStatus,
} from '../shared/work'
import { badge, holdNeedsNotice, holdText } from './approval'
import { NODE_INFO, WORK_COMPLETE, defaultNext, isPipelineNode, isPrevious } from './pipeline'
import { normalizeText, parseFrontMatter, sectionText } from './validate'

const pad = (n: number) => String(n).padStart(2, '0')

/** 탭과 사이드바의 task 이름: "03 원인 분석" (D109) */
export function taskLabel(task: Pick<TaskRecord, 'seq' | 'node'>): string {
  return `${pad(task.seq)} ${NODE_INFO[task.node].title}`
}

/**
 * 머리 띠의 이유 문구 (시나리오 2-5): 기본 진행 / 되감기 / 건너뛰기 / 재개, PR 대응 task는 대응 시작이다 (자동 대응은
 * M11)
 */
export const REASON_LABEL: Readonly<Record<StartReason, string>> = {
  default: '기본 진행',
  rewind: '되감기',
  skip: '건너뛰기',
  resume: '재개',
  respond: '대응 시작',
}

/**
 * 탭 위 머리 띠: "04 원인 분석 · 새 세션 · 이유: 기본 진행" (시나리오 2-5, D109).
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

/** task 표시 이름 (3.3, 시나리오 3) */
export const TASK_STATUS_LABEL: Readonly<Record<TaskStatus, string>> = {
  queued: '대기열',
  working: '작업 중',
  asking: '질문 대기',
  input_needed: '입력 필요',
  idle: '대기',
  awaiting_approval: '승인 대기',
  blocked: '막힘',
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

/** Work가 멈춘 이유: 이전 단계 추천(D23), [이 단계 끝나면 멈춤](시나리오 3-4) */
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
 * 멈춘 Work에서 [재개]가 할 일 (3.3). 멈추게 한 task의 기본 다음 단계를 시작한다. 이전 단계 추천(D23)은
 * 따르지 않는다. 추천대로 되돌아가는 것은 [단계 선택]이다 (6.2). verify에서 멈췄으면 [재개] 대신
 * Work 완료 화면의 전달 버튼으로 Work를 완료한다 (D119).
 */
export function resumeHint(work: WorkState): string | null {
  const stop = work.stop
  if (work.status !== 'stopped' || !stop) return null
  const task = work.tasks.find((t) => t.id === stop.task_id)
  // 멈추는 것은 파이프라인 task의 승인뿐이다. PR 대응 task는 멈추지 않는다 (D188)
  const next =
    task && isPipelineNode(task.node) && work.intent
      ? defaultNext(task.node, work.intent.size)
      : null
  const back = '추천대로 되돌아가려면 [단계 선택]을 누르세요.'
  if (next === WORK_COMPLETE) {
    const done = 'Work 완료 화면에서 전달을 고르면 Work를 완료합니다'
    return stop.kind === 'recommended_back' ? `추천을 따르지 않고 ${done}. ${back}` : `${done}.`
  }
  const action =
    next === null ? '기본 다음 단계로 갑니다' : `다음 단계(${NODE_INFO[next].title})를 시작합니다`
  return stop.kind === 'recommended_back'
    ? `[재개]하면 추천을 따르지 않고 ${action}. ${back}`
    : `[재개]하면 ${action}.`
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
 * 작업 트리가 없어 정리하기 전 HEAD까지다(시나리오 8). 시작하지 않은 task는 null이다.
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
  return { from, to: null }
}

export interface EmphasisInput {
  node: TaskRecord['node']
  /** 스키마를 통과한 handoff 머리글. 읽지 못했으면 null */
  handoff: Handoff | null
  errors: readonly FormatIssue[]
  /** worktree의 커밋 안 된 변경 (git status) */
  uncommitted: readonly string[]
  /** PR 대응 task: 이번 라운드에 바뀌거나 지워진 기존 테스트 파일 (D180, D202) */
  tests?: readonly string[]
  /** PR 대응 task: 승인 뒤 실패한 push나 답글 게시 (시나리오 10-6) */
  failure?: { stage: string; error: string } | null
}

/**
 * 강조 영역 (시나리오 4-2, D83): intent_deviation, 열린 질문, 이전 단계 추천, 커밋 안 된 변경 경고, 형식 오류.
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
    out.push({ kind: 'open_questions', title: '열린 질문', lines: [...h.open_questions] })
  }
  const rec = h?.recommended_next
  if (rec && isPrevious(input.node, rec.node)) {
    out.push({
      kind: 'recommended_back',
      title: '이전 단계 추천',
      lines: [
        `${NODE_INFO[rec.node].title}(${rec.node})로 — ${rec.reason}`,
        '승인하면 다음 단계를 시작하지 않고 멈춥니다. 되돌아갈 단계는 멈춘 뒤 [단계 선택]으로 고릅니다.',
      ],
    })
  }
  if (input.tests?.length) {
    out.push({
      kind: 'existing_tests',
      title: '기존 테스트 변경',
      lines: [
        ...input.tests,
        '이번 라운드가 이미 있던 테스트 파일을 바꾸거나 지웠습니다. 대응 뒤에는 verify를 다시 돌리지 않습니다 (D180).',
      ],
    })
  }
  if (input.uncommitted.length > 0) {
    out.push({ kind: 'uncommitted', title: '커밋 안 된 변경', lines: [...input.uncommitted] })
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
 * verification.md의 `## 완료조건 판정` 표 (5.6.8). 머리 행과 구분 행은 뺀다.
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
    .filter((r) => !r.every((c) => /^:?-{3,}:?$/.test(c)))
    .map(([criterion = '', verdict = '', ...rest]) => ({
      criterion,
      verdict,
      basis: rest.join(' | '),
      warn: !verdict.replace(/[*_`]/g, '').trim().startsWith(PASS),
    }))
}
