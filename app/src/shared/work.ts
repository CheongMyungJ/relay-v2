// work.json의 모양 (5.1). 상태의 기준이고, main이 전이마다 원자적으로 쓴다 (I11).
// core/machine만 이 값을 바꾼다. 파일에 쓰는 모양이라 키는 snake_case다.
import type { WorkSettings } from './config'
import type { HandoffStatus, NodeName, Size } from './contracts'

/**
 * Work 상태 (3.3): 진행 중(active), 멈춤(stopped), 완료(completed), 포기(abandoned).
 * 보관됨은 M5에서 더한다.
 */
export type WorkStatus = 'active' | 'stopped' | 'completed' | 'abandoned'

/**
 * Task 상태 (3.3)와 실행 중 표시(시나리오 3)를 한 값으로 둔다.
 * - queued(대기열): 세션 상한 때문에 시작을 기다린다 (D18)
 * - 실행 중: working(작업 중), asking(질문 대기), input_needed(입력 필요), idle(대기).
 *   working이면서 세션이 살아 있지 않으면 세션을 띄우는 중이다
 * - awaiting_approval(승인 대기), blocked(막힘): 세션이 끝나도 남는다 (3.3)
 * - session_ended: handoff 없이 세션이 끝났다. 3.3의 "중단됨"에 들지만 배지가 따로 있다 (D80)
 * - interrupted: 중단됨. [즉시 중단], 앱 종료, 재시작 조정(D75, D78), task를 띄우지 못했을 때
 * - approved: 승인됨
 * 폐기됨은 M4에서 더한다.
 */
export type TaskStatus =
  | 'queued'
  | 'working'
  | 'asking'
  | 'input_needed'
  | 'idle'
  | 'awaiting_approval'
  | 'blocked'
  | 'session_ended'
  | 'interrupted'
  | 'approved'

/**
 * task를 시작한 이유 (시나리오 2-5의 머리 띠): 기본 진행, 재개.
 * 재개는 handoff 없이 끝난 세션을 [이 단계 새 세션으로 다시] 한 새 task다 (D114).
 * 되감기와 건너뛰기는 M4에서 더한다.
 */
export type StartReason = 'default' | 'resume'

/** 형식 검사의 오류나 경고 하나 (5.2.1) */
export interface FormatIssue {
  /** task 디렉터리 안의 파일 이름 */
  file: string
  /** header: YAML 머리글, body: 본문, file: 파일 자체(예: 필수 산출물 없음). D90이 이 구분을 쓴다 */
  part: 'header' | 'body' | 'file'
  /** 머리글 필드 경로(예: decisions[0].by)나 본문 절 이름 */
  field?: string
  /** 필드와 어긴 규칙 (D87) */
  message: string
}

/** 형식 검사 결과 (5.2.1). 오류가 없고 handoff가 있으면 유효한 handoff다 */
export interface CheckSummary {
  handoff_present: boolean
  /** handoff 머리글에서 읽은 status. 다른 오류가 있어도 읽을 수 있으면 채운다 */
  status: HandoffStatus | null
  errors: FormatIssue[]
  /** 오류로 치지 않는 것: 정의되지 않은 필드(D85), 분량 기준 초과 */
  warnings: FormatIssue[]
}

/** task의 CLI 세션 (시나리오 2-5). task를 띄우면 main이 알린다 */
export interface TaskSession {
  /** --session-id로 준 uuid */
  id: string
  /** claude 프로세스 ID와 시작 시각 (D76, I20) */
  pid: number
  process_started_at?: string
  started_at: string
  alive: boolean
  ended_at?: string
  /** 마지막으로 --resume으로 다시 연 때 (시나리오 3-4). 다시 열면 pid와 시작 시각이 바뀐다 */
  resumed_at?: string
}

export interface TaskRecord {
  /** t-01. 순번은 Work 안에서 1부터 오른다 */
  id: string
  /** task 디렉터리 tasks/<nn>-<node>의 nn */
  seq: number
  node: NodeName
  status: TaskStatus
  reason: StartReason
  /** handoff를 검사할 형식 버전 (5.2.1) */
  format_version: number
  created_at: string
  /** task 시작 커밋 (시나리오 2-1). 되감기의 기준이다 (6.2) */
  start_commit?: string
  /** 배포한 스킬의 해시 (D103) */
  skill_hash?: string
  /** claude --version의 결과 (D105) */
  claude_version?: string
  /** 세션. 띄우기 전에는 null */
  session: TaskSession | null
  /** 대기열에 들어간 때 (D18) */
  queued_at?: string
  /** 첫 UserPromptSubmit의 permission_mode (D94) */
  permission_mode?: string
  /** 사람이 새 요청을 보낸 마지막 때 (시나리오 3, UserPromptSubmit) */
  last_prompt_at?: string
  /** 형식 오류 되돌림의 연속 횟수 (D21, D107) */
  bounce_count: number
  /** 마지막 형식 검사. 패널에 오류와 경고를 보인다 */
  check: CheckSummary | null
  /** 승인 기록 (D3) */
  approved_at?: string
  approved_by?: 'human'
  /** [오류 무시하고 승인]으로 넘긴 오류 (4.1, D112) */
  ignored_errors?: FormatIssue[]
  /** task를 띄우지 못한 이유 */
  error?: string
}

/** 승인된 intent (5.3). intent.md 머리글의 version, size와 같다 */
export interface ApprovedIntent {
  version: number
  size: Size
}

/** Work가 멈춘 이유 (3.3): 이전 단계 추천(D23), [이 단계 끝나면 멈춤] (시나리오 3-4) */
export type WorkStop =
  | {
      kind: 'recommended_back'
      /** 승인하고 멈춘 task */
      task_id: string
      /** 추천한 이전 단계와 이유 (handoff의 recommended_next) */
      node: NodeName
      reason: string
    }
  | {
      kind: 'after_step'
      /** 승인하고 멈춘 task */
      task_id: string
    }

export interface WorkState {
  schema_version: 1
  /** w-YYYYMMDD-NNN */
  work_id: string
  status: WorkStatus
  created_at: string
  completed_at?: string
  abandoned_at?: string
  /** 기준 브랜치와 기준 커밋 (시나리오 1, D97) */
  base_branch: string
  base_commit: string
  /** 승인된 intent. 의도 승인 전에는 null */
  intent: ApprovedIntent | null
  /** Work별 설정 (D72) */
  settings: WorkSettings
  /** status가 stopped일 때 멈춘 이유 */
  stop?: WorkStop
  /** [이 단계 끝나면 멈춤]: 지금 단계가 승인되면 다음 단계를 시작하지 않고 멈춘다 (시나리오 3-4) */
  stop_after_step?: boolean
  tasks: TaskRecord[]
}

/** events.jsonl의 이벤트 유형 (5.5) */
export type LifecycleEventType =
  | 'work.created'
  | 'work.completed'
  | 'work.abandoned'
  | 'work.cleaned'
  | 'task.started'
  | 'task.awaiting_approval'
  | 'task.approved'
  | 'task.interrupted'
  | 'task.resumed'
  | 'task.rewound'
  | 'task.skipped_to'
  | 'delivery.succeeded'
  | 'delivery.failed'

/** events.jsonl의 한 줄 (5.5). task_id는 task 이벤트에만 있다 */
export interface LifecycleEvent {
  ts: string
  work_id: string
  task_id?: string
  type: LifecycleEventType
  payload: Record<string, unknown>
}
