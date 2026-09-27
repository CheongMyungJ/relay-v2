// work.json의 모양 (5.1). 상태의 기준이고, main이 전이마다 원자적으로 쓴다 (I11).
// core/machine만 이 값을 바꾼다. 파일에 쓰는 모양이라 키는 snake_case다.
import type { WorkSettings } from './config'
import type { HandoffStatus, NodeName, Size } from './contracts'

/**
 * Work 상태 (3.3): 진행 중(active), 멈춤(stopped), 완료(completed), 포기(abandoned),
 * 보관됨(archived: 완료나 포기 뒤 [Work 정리]를 마침, 시나리오 8).
 */
export type WorkStatus = 'active' | 'stopped' | 'completed' | 'abandoned' | 'archived'

/**
 * Task 상태 (3.3)와 실행 중 표시(시나리오 3)를 한 값으로 둔다.
 * - queued(대기열): 세션 상한 때문에 시작을 기다린다 (D18)
 * - 실행 중: working(작업 중), asking(질문 대기), input_needed(입력 필요), idle(대기).
 *   working이면서 세션이 살아 있지 않으면 세션을 띄우는 중이다
 * - awaiting_approval(승인 대기), blocked(막힘): 세션이 끝나도 남는다 (3.3)
 * - session_ended: handoff 없이 세션이 끝났다. 3.3의 "중단됨"에 들지만 배지가 따로 있다 (D80)
 * - interrupted: 중단됨. [즉시 중단], 앱 종료, 재시작 조정(D75, D78), task를 띄우지 못했을 때
 * - approved: 승인됨
 * - discarded: 폐기됨. 되감기나 건너뛰기로 이후 입력에서 빠졌다 (6.2). 파일과 기록은 남는다
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
  | 'discarded'

/**
 * task를 시작한 이유 (시나리오 2-5의 머리 띠): 기본 진행, 되감기, 건너뛰기, 재개.
 * 재개는 handoff 없이 끝난 세션을 [이 단계 새 세션으로 다시] 한 새 task다 (D114).
 * 되감기와 건너뛰기는 단계 선택(6.2)으로 들어온 task다. 단계 선택에서 기본 다음 단계를 골라
 * 건너뛴 단계도 폐기한 task도 없으면 기본 진행이다.
 */
export type StartReason = 'default' | 'rewind' | 'skip' | 'resume'

/** 단계 선택(6.2)으로 들어온 task의 입력과 코드. context.md의 맨 위에 넣는다 (시나리오 2-4) */
export interface StepSelection {
  /** 단계를 고른 때의 지금 task (6.2의 k) */
  from_task: string
  /** 사람 추가 지시. 없으면 null */
  instruction: string | null
  /** 이번에 폐기한 task. 되감기면 그 시도를 요약해 넣는다 */
  discarded: string[]
  /** 건너뛴 단계 */
  skipped: NodeName[]
  /** fix로 되감으며 [현재 코드 위에서 이어서]를 골랐다 */
  keep_code: boolean
  /**
   * 되돌린 코드 (D116, D117). from은 되돌리기 전 HEAD, to는 되돌린 커밋이다. backup_commit은 백업 브랜치를
   * 만들 때 가리킨 커밋이다(커밋 안 된 변경이 있었으면 from 위의 커밋 하나, 없었으면 from).
   * 백업할 것이 없었으면 backup_branch와 backup_commit은 null이다. 코드를 되돌리지 않았으면 reset이 null이다
   */
  reset: {
    from: string
    to: string
    backup_branch: string | null
    backup_commit: string | null
  } | null
}

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
  /** 단계 선택(6.2)으로 들어온 task */
  selection?: StepSelection
  /** 폐기한 때와, 폐기를 부른 단계 선택이 만든 task (6.2) */
  discarded_at?: string
  discarded_by?: string
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

/**
 * 코드를 되돌리는 되감기의 진행 중 작업 기록 (6.2, D77). 세션을 끝낸 뒤 백업 브랜치를 만들고(backup),
 * 코드를 되돌리고(reset), task를 폐기하고 새 task를 만든다. 마지막은 work.json 한 번 쓰기라 기록을 지우는 것과
 * 같이 한다. 재시작 때 남은 기록을 알리는 것은 M6에서 넣는다.
 */
export interface RewindOperation {
  kind: 'rewind'
  /** 지금 하는 단계: backup(백업 브랜치 만들기), reset(코드 되돌리기) */
  stage: 'backup' | 'reset'
  started_at: string
  /** 고른 단계 */
  node: NodeName
  /** 단계를 고른 때의 지금 task */
  from_task: string
  instruction: string | null
  /** 폐기할 task */
  discard: string[]
  /** 되돌릴 커밋 (D117) */
  reset_to: string
  /**
   * 백업 브랜치 (D115). backup 단계에서는 만들 이름이고, reset 단계에서는 만든 이름이다.
   * 되돌릴 커밋도 커밋 안 된 변경도 없어 만들지 않았으면 null이다
   */
  backup_branch: string | null
  /** reset 단계에서 만든 백업 브랜치가 가리키는 커밋. backup 단계와 만들지 않았으면 null이다 */
  backup_commit: string | null
}

/** 전달 (시나리오 7-3): [push] 또는 [PR 생성]. [완료만]은 전달이 없다 */
export type DeliveryChoice = 'push' | 'pr'

/** 전달의 단계 (D77): 커밋 안 된 변경 처리(prepare), push, PR 만들기(pr) */
export type DeliveryStage = 'prepare' | 'push' | 'pr'

/** 커밋 안 된 변경의 처리 (7-5): [변경 버리고 진행](git stash -u), [커밋하고 진행] */
export type UncommittedAction = 'discard' | 'commit'

/**
 * 전달의 진행 중 작업 기록 (7-6, D77). 전달을 시작할 때 적고, 단계마다 stage를 옮기고, 끝나면(성공이든
 * 실패든) 결과를 남기는 work.json 한 번 쓰기에서 지운다. 재시작 때 남은 기록을 알리는 것은 M6에서 넣는다.
 */
export interface DeliverOperation {
  kind: 'deliver'
  stage: DeliveryStage
  started_at: string
  choice: DeliveryChoice
  /** 전달하는 verify task */
  task_id: string
  /** 커밋 안 된 변경을 어떻게 하는가. 없었으면 null */
  uncommitted: UncommittedAction | null
  /** push할 브랜치(relay/<work-id>)와 PR 대상 브랜치(기준 브랜치) */
  branch: string
  base: string
  /** 커밋 안 된 변경을 처리하며 만든 stash나 커밋 (7-5). prepare 단계를 마치고 push로 옮길 때 적는다 */
  stash?: string
  commit?: string
}

/** 정리의 단계 (D77): worktree 지우기, 브랜치 지우기 */
export type CleanStage = 'worktree' | 'branches'

/**
 * 정리의 진행 중 작업 기록 (시나리오 8, D77). 정리를 시작할 때 적고, worktree를 지우면 stage를 옮기고,
 * 끝나면 보관됨으로 바꾸는 work.json 한 번 쓰기에서 지운다.
 */
export interface CleanOperation {
  kind: 'clean'
  stage: CleanStage
  started_at: string
  /** git worktree remove --force: 커밋 안 된 변경이나 잠금 파일을 사람이 확인했다 */
  force: boolean
  /** 지울 브랜치: 작업 브랜치(push됐거나 머지됐고 사람이 골랐을 때)와 되감기 백업 브랜치 */
  delete_branches: string[]
  /** 정리를 시작할 때 worktree의 HEAD. worktree 폴더가 없었으면 작업 브랜치의 커밋, 그것도 없으면 null */
  head: string | null
}

/** 진행 중인 여러 단계 작업 (D77): 되감기, 전달, 정리 */
export type WorkOperation = RewindOperation | DeliverOperation | CleanOperation

/**
 * 전달 결과 (시나리오 7-4, 7-6). 마지막 [push]·[PR 생성]의 결과이고 실패해도 남는다 (D120).
 * Work가 완료되면 전달은 status가 succeeded인 이 기록이고, 없거나 실패면 [완료만]이다.
 */
export interface DeliveryRecord {
  choice: DeliveryChoice
  status: 'succeeded' | 'failed'
  at: string
  /** 실패한 단계와 오류 */
  stage?: DeliveryStage
  error?: string
  /** push한 브랜치. origin에 같은 이름으로 push한다 */
  branch?: string
  /** push 뒤 브라우저에서 PR을 만드는 비교 URL. origin 주소로 만들 수 없으면 null (7-4) */
  compare_url?: string | null
  /** PR 주소. 같은 브랜치의 PR이 이미 열려 있었으면 그 링크만 기록한다 (pr_existing, 7-4) */
  pr_url?: string
  pr_existing?: boolean
  /** draft PR로 만들었다 (D71) */
  draft?: boolean
  /**
   * 이 Work의 전달이 커밋 안 된 변경을 처리하며 만든 stash 커밋과 앱이 만든 커밋 (7-5). 실패한 시도의 것도
   * 남기고, [다시 시도]나 [전달 없이 완료] 뒤에도 앞 시도의 것을 이어 둔다. 없으면 없다
   */
  stashes?: string[]
  commits?: string[]
}

/** 정리 결과 (시나리오 8) */
export interface CleanedRecord {
  at: string
  /** 정리하기 전 worktree의 HEAD. 보관된 Work의 [변경]은 작업 트리 대신 이 커밋까지 본다 */
  head: string | null
  /** git worktree remove --force로 지웠다 */
  forced: boolean
  /** 지운 브랜치 */
  deleted_branches: string[]
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
  /** 진행 중인 여러 단계 작업 (D77). 시작 전에 적고 끝나면 지운다 */
  operation?: WorkOperation
  /** 마지막 전달 결과 (시나리오 7). [push]·[PR 생성]을 한 적이 없으면 없다 */
  delivery?: DeliveryRecord
  /** [Work 정리]의 결과 (시나리오 8). 보관됨이면 있다 */
  cleaned?: CleanedRecord
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
