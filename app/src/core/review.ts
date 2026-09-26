// 사람에게 보일 것: task 이름과 머리 띠(D109), 상태 이름, 승인 화면의 강조 영역(D83),
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
import { NODE_INFO, isPrevious } from './pipeline'
import { normalizeText, parseFrontMatter, sectionText } from './validate'

const pad = (n: number) => String(n).padStart(2, '0')

/** 탭과 사이드바의 task 이름: "03 원인 분석" (D109) */
export function taskLabel(task: Pick<TaskRecord, 'seq' | 'node'>): string {
  return `${pad(task.seq)} ${NODE_INFO[task.node].title}`
}

/** 머리 띠의 이유 문구 (시나리오 2-5). 되감기, 건너뛰기, 재개는 M3와 M4에서 더한다 */
const REASON_LABEL: Record<StartReason, string> = { default: '기본 진행' }

/** 탭 위 머리 띠: "04 원인 분석 · 새 세션 · 이유: 기본 진행" (시나리오 2-5, D109) */
export function bandText(task: Pick<TaskRecord, 'seq' | 'node' | 'reason'>): string {
  return `${taskLabel(task)} · 새 세션 · 이유: ${REASON_LABEL[task.reason]}`
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
  working: '작업 중',
  asking: '질문 대기',
  input_needed: '입력 필요',
  idle: '대기',
  awaiting_approval: '승인 대기',
  blocked: '막힘',
  session_ended: '세션 종료',
  interrupted: '중단됨',
  approved: '승인됨',
}

/** Work 표시 이름 (3.3) */
export const WORK_STATUS_LABEL: Readonly<Record<WorkStatus, string>> = {
  active: '진행 중',
  stopped: '멈춤',
  completed: '완료',
}

/** Work가 멈춘 이유 (D23). M2는 알리기만 하고 단계 선택은 M4에서 넣는다 */
export function stopNotice(work: WorkState): string | null {
  const stop = work.stop
  if (work.status !== 'stopped' || !stop) return null
  return `이전 단계 추천으로 멈춤: ${NODE_INFO[stop.node].title}(${stop.node})로 — ${stop.reason}`
}

// ---------- 승인 화면 (D83) ----------

export type { Emphasis, Verdict }

export interface EmphasisInput {
  node: TaskRecord['node']
  /** 스키마를 통과한 handoff 머리글. 읽지 못했으면 null */
  handoff: Handoff | null
  errors: readonly FormatIssue[]
  /** worktree의 커밋 안 된 변경 (git status) */
  uncommitted: readonly string[]
}

/**
 * 강조 영역 (시나리오 4-2, D83): intent_deviation, 열린 질문, 이전 단계 추천, 커밋 안 된 변경 경고, 형식 오류.
 * 막힘이면 blocked_reason을 맨 앞에 둔다 (4.4). 없으면 빈 목록이다.
 */
export function emphasis(input: EmphasisInput): Emphasis[] {
  const out: Emphasis[] = []
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
        '승인하면 다음 단계를 시작하지 않고 멈춥니다.',
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
