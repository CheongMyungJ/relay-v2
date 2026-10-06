// Work와 Task의 상태 전이 (3.3, 시나리오 2~6, 9). (상태, 이벤트) → (새 상태, 할 일)인 순수 함수다 (I10).
// 훅 신호, 사람 버튼, 프로세스 종료, 재시작을 main이 이벤트로 바꿔 넣고, 돌려받은 할 일을 차례로 실행한다.
// 상태는 work.json이고 main이 전이마다 쓴다 (I11). 설정은 판정하는 때의 값을 받는다 (D73).
// 기본 흐름, [오류 무시하고 승인](D112), 사람 조작(중단, 재개, 멈춤, 포기), 대기열(D18), 재시작 조정(D75, D78),
// 단계 선택(되감기와 건너뛰기, 6.2), 전달(시나리오 7, D119, D120)과 정리(시나리오 8), 끊긴 작업의 [다시 시도]와
// [무시](D121~D123), 앱 소유 파일의 해시(D124)와 정리 세션의 프로세스(D126) 기록, 자동 승인 카운트다운(4.3,
// D127~D131), PR 진행(시나리오 10: 읽은 결과, 머지, 밖에서 머지·닫힘, [머지 없이 끝내기], D152~D200)과 PR 대응(대응 task,
// 승인 뒤 push와 답글 게시, 미룬 라운드, 다시 실행, D168~D207)과 자동 대응(자동 시작과 라운드 상한, 대응 task의 자동 승인,
// D154, D169, D171, D208~D210)을 담는다.
// PR의 항목(pr-items.json)과 머지 조건의 판정은 core/pr이 하고, 여기는 work.json의 기록만 바꾼다. 세션 상한은 main이 세고, 자리가 없으면 task.queued를 넣는다. 카운트다운의 타이머는 main이
// 돌고, 끝나면 autoApprove를 넣는다. 단계 선택의 계산은 core/rewind, 전달의 판정은 core/delivery, 정리의 판정은
// core/cleanup, 끊긴 작업의 알림과 재개 판정은 core/recovery, 자동 승인의 조건은 core/approval이 한다.
import type { AppConfig, WorkSettingsPatch } from '../shared/config'
import { resolveAgent, type AgentEngine, type ResolvedAgent } from '../shared/agent'
import { agentLabel, knownTaskEngine, sessionUnknown, taskEngine } from './agent'
import { selectionKind } from './context'
import type { Decision, NodeName, TaskNode } from '../shared/contracts'
import type { StepExpect, WorkActions } from '../shared/views'
import type {
  ApprovalBy,
  AutoHoldReason,
  CheckSummary,
  CleanOperation,
  CleanStage,
  DeliverOperation,
  DeliveryChoice,
  DeliveryRecord,
  DeliveryStage,
  FormatIssue,
  IssueCloseReason,
  IssueRecord,
  LifecycleEvent,
  MergeMethod,
  MergeOperation,
  OwnedFile,
  OwnedFileHashes,
  PrMerged,
  RespondOperation,
  RespondRound,
  RewindOperation,
  StartReason,
  StepSelection,
  TaskRecord,
  TaskStatus,
  UncommittedAction,
  WorkState,
  WorkType,
} from '../shared/work'
import {
  REVIEWABLE,
  approvalGate,
  approvalMode,
  autoApproveHolds,
  type AutoApproveInput,
} from './approval'
import { canClean } from './cleanup'
import { mergeWorkSettings } from './config'
import { commitMessage, deliveryStart, stashMessage, stoppedVerify } from './delivery'
import {
  NODE_INFO,
  RESPOND,
  WORK_COMPLETE,
  defaultNext,
  isPipelineNode,
  stopsForRecommendation,
  workType,
} from './pipeline'
import { workBranch } from './records'
import { CUT_ERROR, OPERATION_BLOCKS, OWNED_FILES, cutOperation } from './recovery'
import {
  AUTO_LIMIT,
  PR_CLOSED,
  autoRounds,
  autoStartOn,
  deferredRounds,
  isRespondPending,
  nextRound,
  respondBlocked,
} from './respond'
import { backupMessage, canSelectStep, planStep, type StepKind } from './rewind'
import { issueEntries, issueKey, issueUrlOf, newIssueRecord } from './issue'
import { FORMAT_VERSION, bounceMessage, isValid, summarize, type TaskCheck } from './validate'

// ---------- 이벤트와 할 일 ----------

interface TaskEvent {
  taskId: string
  /** 일어난 때 (ISO 8601). 기록에 그대로 쓴다 */
  at: string
}

/**
 * main이 task를 띄운 직후 알린다 (시나리오 2). 첫 훅보다 먼저 와야 한다.
 * 띄우기 전에 정한 값(시작 커밋, 스킬 해시, claude 버전)과 띄운 프로세스를 담는다.
 */
export interface SessionStarted extends TaskEvent {
  type: 'session.started'
  sessionId: string
  pid: number
  processStartedAt?: string
  startCommit: string
  skillHash: string
  engineVersion?: string
  /** 이전 호출자와의 호환. 새 실행 경로는 engineVersion을 쓴다. */
  claudeVersion?: string
}

/**
 * main이 끝난 세션을 --resume으로 다시 띄운 직후 알린다 (시나리오 3-4, 3-5).
 * check는 다시 띄운 때의 형식 검사다. 유효한 handoff가 있으면 승인 대기나 막힘이다 (3.3).
 */
export interface SessionResumed extends TaskEvent {
  type: 'session.resumed'
  pid: number
  processStartedAt?: string
  engineVersion?: string
  claudeVersion?: string
  check: CheckSummary
}

/**
 * task를 띄우지 못했다 (새 세션이든 재개든). check는 그때의 형식 검사다. 유효한 handoff가 있으면
 * 세션이 없어도 승인 대기나 막힘으로 남는다 (3.3). 없으면 중단됨이다.
 */
export interface SessionFailed extends TaskEvent {
  type: 'session.failed'
  error: string
  check?: CheckSummary
}

/**
 * 세션을 띄운 뒤 처음 받은 PTY 출력과 훅 (D217). main이 세션마다 한 번씩 알린다. 검은 화면이 어디서 생기는지 보려고
 * events.jsonl에만 남기고 상태는 바꾸지 않는다
 */
export interface SessionTiming extends TaskEvent {
  type: 'session.timing'
  /** 띄운 프로세스. 앞 세션의 늦은 알림을 가려낸다 */
  pid: number
  /** 처음 받은 것: PTY 출력이나 훅 */
  first: 'output' | 'hook'
  /** 첫 훅의 이벤트 이름 (first가 hook일 때) */
  hook?: string
  /** 세션을 띄운 뒤 걸린 ms */
  ms: number
}

/** 세션 상한 때문에 띄우지 못해 대기열에 넣었다 (D18). main이 넣는다 */
export interface TaskQueued extends TaskEvent {
  type: 'task.queued'
}

/** 훅 신호 (시나리오 3). type은 Claude Code의 훅 이벤트 이름이다 */
interface HookSignal extends TaskEvent {
  /** 본문의 session_id. /clear, 대화형 /resume, /branch로 CLI가 다른 대화로 옮기면 바뀐다 (D110) */
  sessionId?: string
  /** 본문의 agent_id. 서브에이전트 안에서 난 훅에만 있다 (Claude Code 문서 hooks) */
  agentId?: string
}

export interface UserPromptSubmitted extends HookSignal {
  type: 'UserPromptSubmit'
  /** 본문의 permission_mode (D94) */
  permissionMode?: string
}

export interface ToolUse extends HookSignal {
  type: 'PreToolUse' | 'PostToolUse'
  toolName: string
}

export interface NotificationSent extends HookSignal {
  type: 'Notification'
  notificationType?: string
}

export interface Stopped extends HookSignal {
  type: 'Stop'
  /** 본문의 stop_hook_active. 되돌림에 이어진 Stop이면 true다 (S2, D107) */
  stopHookActive: boolean
  /** 이번 턴에 handoff.md(intake는 intent 초안도)가 바뀌었는가. main이 턴 시작 때와 비교해 정한다 */
  handoffChanged: boolean
  /** Stop을 받고 main이 다시 한 형식 검사 (I15). 자동 승인 조건은 머리글(handoffHeader)에서 읽는다 (4.3) */
  check: AutoApproveInput['check']
  /**
   * 본문의 background_tasks나 session_crons가 비어 있지 않다: 세션이 백그라운드 작업이나 예약된 깨우기를 기다리며
   * 쉬는 중이다 (core/approval pendingBackground, D129). 없으면 false다
   */
  background?: boolean
}

/** SessionEnd 훅 */
export interface SessionEndHook extends HookSignal {
  type: 'SessionEnd'
  /** 본문의 reason: clear | resume | logout | prompt_input_exit | other (Claude Code 문서 hooks) */
  reason?: string
  /** 세션이 끝날 때 main이 다시 한 형식 검사 (3.3, D146). 읽지 못했으면 없다 */
  check?: CheckSummary
}

/** PTY 종료 */
export interface PtyExited extends TaskEvent {
  type: 'pty.exit'
  /** 끝난 프로세스. 다시 연 세션이 있으면 앞 프로세스의 늦은 종료를 가려낸다 */
  pid?: number
  /** 세션이 끝날 때 main이 다시 한 형식 검사 (3.3, D146). 읽지 못했으면 없다 */
  check?: CheckSummary
}

export type SessionEnded = SessionEndHook | PtyExited

/** main에서 벤더 훅을 번역해 전달하는 공통 신호. 이전 Claude 호출자도 계속 읽는다. */
export type RuntimeSignal =
  | (HookSignal & { type: 'session.identified' })
  | (Omit<UserPromptSubmitted, 'type'> & { type: 'turn.started' })
  | (HookSignal & { type: 'question.started' | 'question.finished' | 'input.required' })
  | (Omit<Stopped, 'type' | 'background'> & {
      type: 'turn.completed'
      pending: 'none' | 'pending' | 'unknown'
    })
  | (HookSignal & { type: 'turn.interrupted'; check: CheckSummary })
  | (Omit<SessionEndHook, 'type'> & { type: 'session.ended' })

/**
 * 감시(I15)가 파일 변경을 보고 다시 한 형식 검사. 패널 표시만 바꾼다. 카운트다운 중에 자동 승인 조건을 어기면
 * 카운트다운을 멈춘다 (D130)
 */
export interface CheckUpdated extends TaskEvent {
  type: 'check.updated'
  check: AutoApproveInput['check']
}

/**
 * 자동 승인 카운트다운이 끝났다 (4.3, D128). main의 타이머가 넣는다. check는 끝난 때 다시 읽은 형식 검사이고,
 * 읽지 못했으면 null이다. startedAt은 끝난 카운트다운의 시작 시각이다: 그 사이 멈췄거나 새로 시작한 카운트다운이면
 * 늦게 온 타이머라 무시한다
 */
export interface AutoApprove extends TaskEvent {
  type: 'autoApprove'
  startedAt: string
  check: TaskCheck | null
}

/** 승인 화면의 [취소] (4.3): 카운트다운을 멈추고 사람의 승인을 기다린다 */
export interface CancelCountdown extends TaskEvent {
  type: 'countdown.cancel'
}

/**
 * 사람이 [승인]을 눌렀다 (시나리오 4-3). intake에서는 [의도 승인], verify에서는 Work 완료 화면의 [완료만]이다.
 * check는 누른 때 main이 다시 한 검사다. 기록할 결정과 이전 단계 추천을 여기서 읽는다.
 */
export interface Approve extends TaskEvent {
  type: 'approve'
  check: TaskCheck
  /** [오류 무시하고 승인] (4.1, D90, D112). 확인 창을 거친 뒤에 보낸다 */
  force?: boolean
}

/** 세션을 끝내는 이유. events.jsonl의 task.interrupted에 남긴다 */
export type InterruptReason = 'human' | 'app_quit'

/**
 * [즉시 중단] (시나리오 3-4)과 앱 종료 확인 (시나리오 3-6). check는 누른 때의 형식 검사다.
 * 대기열에서 뺀 task는 유효한 handoff가 있으면 승인 대기나 막힘으로 남는다 (3.3).
 */
export interface Interrupt extends TaskEvent {
  type: 'interrupt'
  reason: InterruptReason
  check?: CheckSummary
}

/** [재개], [세션 재개] (시나리오 3-4, 3-5, 4.4) */
export interface Resume extends TaskEvent {
  type: 'resume'
}

/** [이 단계 새 세션으로 다시] (시나리오 3-5, D114) */
export interface Retry extends TaskEvent {
  type: 'retry'
}

interface WorkEvent {
  at: string
}

/** [이 단계 끝나면 멈춤]을 켜거나 끈다 (시나리오 3-4) */
export interface StopAfterStep extends WorkEvent {
  type: 'stopAfter'
  on: boolean
}

/** 보관된 Work를 사이드바의 공통 아카이브로 옮긴다. 기록과 산출물은 그대로 둔다 */
export interface ShelveWork extends WorkEvent {
  type: 'shelve'
}

/** 멈춘 Work의 [재개]: 기본 다음 단계를 시작한다 (3.3, 시나리오 3-4) */
export interface ResumeWork extends WorkEvent {
  type: 'resumeWork'
}

/** [Work 포기] (3.3) */
export interface Abandon extends WorkEvent {
  type: 'abandon'
}

/**
 * Work별 설정 (D72). main이 검사한 값을 넣는다. 준 키만 바꾸고, 빈 값이면 그 키를 지워 앱 설정을 따른다
 * (core/config mergeWorkSettings). 질문 방식은 다음에 시작하는 task부터 쓰고(D73), 카운트다운 중에 그 단계의 자동
 * 승인을 끄면 바로 멈춘다 (D128). PR 진행 중에도 받는다 (D209)
 */
export interface UpdateSettings extends WorkEvent {
  type: 'settings.update'
  settings: WorkSettingsPatch
}

/** 앱 설정을 바꿨다 (D70). 카운트다운 중에 그 단계의 자동 승인을 껐으면 바로 멈춘다 (D128) */
export interface ConfigUpdated extends WorkEvent {
  type: 'config.updated'
}

/**
 * 앱을 다시 켰다 (시나리오 9, D75, D78). check는 지금 task의 형식 검사다.
 * 재시작 뒤 이 앱에서 살아 있는 세션은 없다. killed는 main이 재시작 때 끝낸 고아 프로세스의 task다 (D76).
 */
export interface AppRestarted extends WorkEvent {
  type: 'app.restarted'
  check: CheckSummary | null
  killed?: readonly { taskId: string; pid: number }[]
}

/**
 * [단계 선택]의 [확인] (6.2, D82). expect는 미리 본 때의 지금 task다. 그 뒤 바뀌었으면 받지 않는다.
 * backups는 이 Work의 백업 브랜치(git)이고 새 백업 브랜치의 번호를 정한다 (D115).
 */
export interface SelectStep extends WorkEvent {
  type: 'selectStep'
  node: NodeName
  /** [현재 코드 위에서 이어서] (6.2, D254) */
  keepCode: boolean
  /** 의도 승인 전 [intake 다시]에서 고른 유형 (D237). 없거나 지금 유형과 같으면 바꾸지 않는다 */
  workType?: WorkType
  /** 사람 추가 지시. 비어 있으면 없는 것이다 */
  instruction: string
  expect: StepExpect
  backups: readonly string[]
}

/**
 * 되감기(D77의 backup 단계)가 끝났다. branch는 만든 백업 브랜치, commit은 그 브랜치가 가리키는 커밋이다.
 * 백업할 것이 없어 만들지 않았으면 둘 다 null이다. head는 되돌리기 전 HEAD다 (끊긴 되감기를 다시 할 때 본다, D123)
 */
export interface RewindBackedUp extends WorkEvent {
  type: 'rewind.backedUp'
  branch: string | null
  commit: string | null
  head?: string
}

/**
 * 되감기가 코드를 되돌렸다. head는 되돌리기 전 HEAD다. extraBackup은 끊긴 되감기를 다시 하며 덤으로 남긴 백업
 * 브랜치다: 끊긴 되감기가 만든 백업과 지금 코드가 달라(재시작 뒤 사람이 고침) 한 번 더 백업했다 (D123)
 */
export interface RewindApplied extends WorkEvent {
  type: 'rewind.applied'
  head: string
  extraBackup?: string
}

/**
 * 되감기의 git 작업이 실패했다. 기록을 지우고 Work는 그대로 둔다. 오류는 main이 알린다.
 * cut이면 실패하기 전에 코드가 이미 바뀌었다(reset 뒤 clean 실패 등). 끊긴 되감기로 남긴다 (D136)
 */
export interface RewindFailed extends WorkEvent {
  type: 'rewind.failed'
  error: string
  cut?: boolean
}

/**
 * Work 완료 화면의 [push]·[PR 생성] (시나리오 7-4~7-6, D119, D120). check는 누른 때의 verify 형식 검사다.
 * uncommitted는 커밋 안 된 변경의 처리다(7-5). session은 [AI 세션 열기]로, verify 세션을 끝내고 정리 세션을
 * 연다. 전달은 정리 세션이 끝난 뒤 다시 이 명령으로 한다. main은 커밋 안 된 변경을 먼저 확인한다.
 */
export interface Deliver extends WorkEvent {
  type: 'deliver'
  choice: DeliveryChoice
  uncommitted: UncommittedAction | 'session' | null
  check: TaskCheck | null
}

/**
 * 전달이 다음 단계(push, PR 만들기)로 넘어갔다 (D77). 커밋 안 된 변경을 처리했으면(prepare) 만든 stash나
 * 커밋을 함께 알린다. 진행 중 작업 기록에 적고, 전달 결과에 남긴다 (7-5)
 */
export interface DeliveryStaged extends WorkEvent {
  type: 'delivery.stage'
  stage: DeliveryStage
  stash?: string
  commit?: string
}

/** 전달이 끝났다. main이 git과 gh에서 얻은 것과, 승인을 기록할 때 다시 한 verify 검사다 (D120) */
export interface DeliverySucceeded extends WorkEvent {
  type: 'delivery.succeeded'
  compareUrl: string | null
  prUrl?: string
  prExisting?: boolean
  draft?: boolean
  /**
   * [PR 생성]이 만들거나 찾은 PR (D152, D156, D191). 있으면 Work는 완료 대신 PR 진행이 된다: 번호는 PR 주소에서
   * 읽고(I50), head는 push한 커밋, ghVersion은 그때의 gh --version이다 (D198)
   */
  pr?: { number: number; head: string; ghVersion: string | null }
  check: TaskCheck | null
}

/** 전달이 실패했다. Work는 완료하지 않는다 (7-6) */
export interface DeliveryFailed extends WorkEvent {
  type: 'delivery.failed'
  error: string
}

/**
 * [Work 정리]의 [정리] (시나리오 8-2). core/cleanup이 사람의 확인과 선택으로 정한 것이다.
 * head는 정리를 시작할 때 worktree의 HEAD다. worktree 폴더가 없으면 작업 브랜치의 커밋이고, 그것도 없으면 null이다.
 */
export interface Clean extends WorkEvent {
  type: 'clean'
  force: boolean
  deleteBranches: string[]
  /** 지울 origin의 브랜치. 머지로 완료한 Work에서 사람이 골랐을 때만 있다 (D178) */
  deleteRemote?: string
  head: string | null
}

/** 정리가 worktree를 지웠다 (D77) */
export interface CleanRemoved extends WorkEvent {
  type: 'clean.removed'
}

/** 정리가 로컬 브랜치를 지웠다. origin의 브랜치를 지울 것이 있으면 그 단계로 옮긴다 (D77, D178) */
export interface CleanBranchesDeleted extends WorkEvent {
  type: 'clean.branchesDeleted'
}

/** 정리가 끝났다. Work를 보관됨으로 바꾼다 */
export interface CleanDone extends WorkEvent {
  type: 'clean.done'
}

/** 정리의 git 작업이 실패했다. 기록을 지우고 Work는 그대로 둔다. 오류는 main이 알린다 */
export interface CleanFailed extends WorkEvent {
  type: 'clean.failed'
  error: string
}

/**
 * 끊긴 전달이 만들었지만 기록하지 못한 stash와 커밋 (D123). main이 메시지로 찾는다 (core/recovery lostStashes,
 * lostCommit). 전달 결과에 남긴다
 */
export interface DeliveryFound {
  stashes: readonly string[]
  commits: readonly string[]
}

/**
 * 끊긴 작업의 [다시 시도] (시나리오 9-4, D123). 되감기와 정리는 끊긴 곳부터 main에 맡긴다. 전달은 끊긴 시도를
 * 실패로 남기고 기록을 지운다: main이 이어서 같은 전달을 처음부터 한다(deliver).
 */
export interface OperationRetry extends WorkEvent {
  type: 'operationRetry'
  found?: DeliveryFound
}

/** 끊긴 작업의 [무시] (D123). 기록만 지운다. 전달은 끊긴 시도를 실패로 남긴다 */
export interface OperationIgnore extends WorkEvent {
  type: 'operationIgnore'
  found?: DeliveryFound
}

/** 정리 세션을 띄웠다 (D126). 살아 있는 동안 프로세스를 적어 재시작 때 확인한다 */
export interface CleanupStarted extends WorkEvent {
  type: 'cleanup.started'
  pid: number
  processStartedAt?: string
}

/** 정리 세션이 끝났다 (D126) */
export interface CleanupEnded extends WorkEvent {
  type: 'cleanup.ended'
}

/**
 * 앱 소유 파일의 해시를 적는다 (D124): 앱이 파일을 쓴 뒤, M6 전에 만든 Work를 처음 읽을 때, 사람이 바뀐 파일을
 * [확인]했을 때. null은 파일이 없다는 것이다
 */
export interface FilesRecorded extends WorkEvent {
  type: 'files.recorded'
  hashes: Partial<Record<OwnedFile, string | null>>
}

/**
 * PR을 읽었다 (시나리오 10-2, D158). main이 gh와 git으로 읽고 core/pr로 항목을 모은 뒤 넣는다. state가 MERGED면
 * 밖에서 머지된 것이다(D179). received, notAccepted는 이번에 새로 받은 항목과 받지 않은 새 코멘트(D189),
 * synced는 fast-forward로 받은 커밋과 옮긴 기준 커밋이다(D193, D181)
 */
export interface PrRead extends WorkEvent {
  type: 'pr.read'
  number: number
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  /** 읽은 원격 PR head */
  head: string
  received: readonly string[]
  notAccepted: readonly string[]
  synced?: { commits: readonly string[]; baseCommit?: string }
}

/**
 * 머지 창의 [머지] (D176, D177). head는 머지 창에 보인 커밋이고, gate는 main이 core/pr mergeGate로 판정한 머지
 * 조건이다. 진행 중 작업을 기록하고(D77) 머지를 main에 맡긴다
 */
export interface PrMerge extends WorkEvent {
  type: 'pr.merge'
  method: MergeMethod
  head: string
  gate: { enabled: boolean; reasons: readonly string[] }
}

/** 머지가 끝났다 (D178): main이 gh pr merge의 종료 코드와 다시 읽은 state(MERGED)로 판정했다 */
export interface PrMergeSucceeded extends WorkEvent {
  type: 'pr.merged'
}

/** 머지가 실패했다. 기록을 지우고 PR 진행에 남는다. 오류는 main이 알린다 (D176: GitHub의 오류를 보임) */
export interface PrMergeFailed extends WorkEvent {
  type: 'pr.mergeFailed'
  error: string
  /** 머지 요청은 성공했지만 결과를 읽지 못했다 (D330): 기록을 지우지 않고 끊긴 작업으로 남긴다 */
  unconfirmed?: boolean
}

/** [머지 없이 끝내기] (D179). GitHub의 PR은 건드리지 않는다 */
export interface PrEnd extends WorkEvent {
  type: 'pr.end'
}

/** 머지 뒤 [Work 정리] 창을 열었다 (D178, D200). 다시 열지 않는다 */
export interface PrCleanOffered extends WorkEvent {
  type: 'pr.cleanOffered'
}

/**
 * PR 패널의 [대응 시작] (시나리오 10-3, D170, D182)과 자동 대응 (D154, D210). items는 사람이 본 새 항목(자동이면 받은 새
 * 항목 전부)이고 main이 지금 새 항목과 같은지 보았다(core/respond respondInputError, autoPlan). 시작하기 전에 main이 기준
 * 브랜치와 PR 브랜치를 fetch하고 원격만 앞섰으면 받았다 (D181, D193): synced는 받은 원격 head와 커밋, 옮긴 기준 커밋이다.
 * auto는 앱이 자동으로 시작한 것이다: 사람 손 없이 이어진 라운드를 하나 더 센다. 사람의 [대응 시작]은 다시 센다 (D171)
 */
export interface PrRespond extends WorkEvent {
  type: 'pr.respond'
  items: readonly string[]
  /** 사람 지시. 비어 있으면 없는 것이다 */
  instruction: string
  synced?: { head: string; commits: readonly string[]; baseCommit?: string }
  auto?: boolean
}

/**
 * 자동 대응이 상한에 닿아 시작하지 않았다 (D171, D184): main이 받은 새 항목으로 자동 시작하려 했는데 사람 손 없이 이어진
 * 라운드가 상한에 닿았다. events.jsonl에 pr.auto_paused를 남긴다. 알림은 main이 한다
 */
export interface PrAutoPaused extends WorkEvent {
  type: 'pr.autoPaused'
  items: readonly string[]
}

/** PR 대응의 push가 끝났다 (D77): 기록을 답글 게시 단계로 옮긴다. commits는 이번에 원격에 올라간 커밋이다 */
export interface RespondPushed extends WorkEvent {
  type: 'respond.pushed'
  head: string
  commits: readonly string[]
}

/**
 * PR 대응의 push와 답글 게시가 끝났다 (시나리오 10-6). check는 main이 다시 한 대응 task의 형식 검사다(승인을 기록할 때
 * 결정을 읽음, D120과 같음). replies는 게시했거나 건너뛴 답글이고(D194, D205), baseCommit은 기준 브랜치를 병합한 라운드의
 * 옮길 기준 커밋이다 (D181)
 */
export interface RespondPublished extends WorkEvent {
  type: 'respond.published'
  check: TaskCheck | null
  replies: readonly { item: string; commentId?: number; skipped?: string }[]
  baseCommit?: string
}

/** push가 원격 PR 브랜치의 새 커밋 때문에 거절됐다 (D193): 라운드를 승인된 채 미룬다. check는 respond.published와 같다 */
export interface RespondDeferred extends WorkEvent {
  type: 'respond.deferred'
  check: TaskCheck | null
}

/** push나 답글 게시가 실패했다 (D120과 같은 방식): 대응 task는 승인 대기로 남아 오류와 [다시 시도]를 보인다 */
export interface RespondFailed extends WorkEvent {
  type: 'respond.failed'
  error: string
}

/** [실패한 체크 다시 실행] (D175, D203): main이 다시 실행한 Actions 실행과 그 체크. events.jsonl에 남긴다 */
export interface PrChecksRerun extends WorkEvent {
  type: 'pr.checksRerun'
  runs: readonly number[]
  checks: readonly string[]
}

// ---------- 이슈 기록 (설계 3.7, I97, I98) ----------

/** 대기열 맨 앞(key)을 게시하려 한다 (D349). 결과를 모를 수 있어 다음 시도는 원격에서 표시를 먼저 찾는다 */
export interface IssueAttempted extends WorkEvent {
  type: 'issue.attempted'
  key: string
}

/** 새 이슈를 만들었다 (D336). 원격에서 표시로 찾았으면 found다 */
export interface IssueCreated extends WorkEvent {
  type: 'issue.created'
  number: number
  url: string
  /** 라벨을 붙였다 (D348) */
  labeled: boolean
  found?: boolean
}

/** 대기열 맨 앞(key)의 코멘트를 게시했다 (D339, D341, D347). 원격에서 표시로 찾았으면 found다 */
export interface IssuePosted extends WorkEvent {
  type: 'issue.posted'
  key: string
  commentId: number | null
  url: string
  found?: boolean
}

/** 이슈를 닫았다 (D346). 까닭은 대기열 항목에 적힌 것이다 */
export interface IssueClosed extends WorkEvent {
  type: 'issue.closed'
}

/** 대기열 맨 앞(key)의 게시가 실패했다 (D344). 흐름은 막지 않고 다음 게시 때 앞부터 다시 한다 */
export interface IssueFailed extends WorkEvent {
  type: 'issue.failed'
  key: string
  error: string
}

export type MachineEvent =
  | RuntimeSignal
  | SessionStarted
  | SessionResumed
  | SessionFailed
  | SessionTiming
  | TaskQueued
  | UserPromptSubmitted
  | ToolUse
  | NotificationSent
  | Stopped
  | SessionEnded
  | CheckUpdated
  | AutoApprove
  | CancelCountdown
  | Approve
  | Interrupt
  | Resume
  | Retry
  | StopAfterStep
  | ShelveWork
  | ResumeWork
  | Abandon
  | UpdateSettings
  | ConfigUpdated
  | AppRestarted
  | SelectStep
  | RewindBackedUp
  | RewindApplied
  | RewindFailed
  | Deliver
  | DeliveryStaged
  | DeliverySucceeded
  | DeliveryFailed
  | Clean
  | CleanRemoved
  | CleanBranchesDeleted
  | CleanDone
  | CleanFailed
  | OperationRetry
  | OperationIgnore
  | CleanupStarted
  | CleanupEnded
  | FilesRecorded
  | PrRead
  | PrMerge
  | PrMergeSucceeded
  | PrMergeFailed
  | PrEnd
  | PrCleanOffered
  | PrRespond
  | PrAutoPaused
  | RespondPushed
  | RespondPublished
  | RespondDeferred
  | RespondFailed
  | PrChecksRerun
  | IssueAttempted
  | IssueCreated
  | IssuePosted
  | IssueClosed
  | IssueFailed

export type Effect =
  /**
   * task를 새 세션으로 시작한다 (시나리오 2): task 디렉터리와 시작 커밋, 스킬 배포, 설정 파일, context.md, PTY.
   * 세션 상한을 넘으면 main이 대기열에 넣는다 (D18)
   */
  | { type: 'startTask'; taskId: string; node: TaskNode; reason: StartReason }
  /** 끝난 세션을 같은 옵션과 --resume <세션 id>로 다시 연다 (시나리오 3-4). 상한은 startTask와 같다 */
  /** 끝난 세션을 --resume으로 다시 연다. continue면 이어서 하라는 첫 입력을 준다 (중단됨의 [재개], D218) */
  | { type: 'resumeTask'; taskId: string; continue: boolean }
  /** 대기열에서 뺀다 */
  | { type: 'dequeue'; taskId: string }
  /** Stop 훅에 {"decision":"block","reason":…}로 답해 형식 오류를 되돌린다 (D21) */
  | { type: 'blockStop'; taskId: string; reason: string }
  /** 세션의 프로세스 트리를 끝내고 pty.log를 남긴다 (시나리오 5-1) */
  | { type: 'endSession'; taskId: string }
  /** intent 초안을 intent.md로 확정하고 이전 버전은 intent.history/에 둔다 (4.1) */
  | { type: 'confirmIntent'; taskId: string; version: number }
  /**
   * decisions.md에 handoff의 결정을 더한다 (5.4). by는 승인 방식이다(사람 승인, 자동 승인).
   * decisions가 null이면 [오류 무시하고 승인]에서 머리글을 읽지 못한 것이다 (D112)
   */
  | {
      type: 'appendDecisions'
      taskId: string
      node: TaskNode
      at: string
      by: ApprovalBy
      decisions: Decision[] | null
    }
  /**
   * 자동 승인 카운트다운의 타이머를 건다 (4.3, D127). 끝나면 main이 파일을 다시 읽어 autoApprove를 넣는다.
   * 같은 Work의 앞 타이머는 푼다. 카운트다운의 상태는 work.json의 task 기록에 있고 main은 타이머만 돈다
   */
  | { type: 'startCountdown'; taskId: string; startedAt: string; seconds: number }
  /** 카운트다운의 타이머를 푼다: 카운트다운이 멈췄거나 승인됐다 */
  | { type: 'stopCountdown'; taskId: string }
  /** events.jsonl에 한 줄 더한다 (5.5) */
  | { type: 'log'; event: LifecycleEvent }
  /**
   * 되감기의 코드 (6.2, D115~D117). 되돌릴 커밋이나 커밋 안 된 변경이 있으면 백업 브랜치를 만들고
   * (커밋 안 된 변경은 message로 커밋 하나를 더 만든다), to로 되돌린다. main은 결과를 rewind.backedUp,
   * rewind.applied, rewind.failed로 알린다
   */
  | { type: 'rewindCode'; to: string; backupBranch: string; message: string }
  /**
   * 끊긴 되감기를 끊긴 곳부터 잇는다 (D123). main은 git에서 이미 만든 백업과 지금 코드를 보고 core/recovery의
   * rewindResumePlan대로 백업하고 되돌린 뒤, 결과를 rewind.backedUp, rewind.applied, rewind.failed로 알린다
   */
  | { type: 'resumeRewind'; operation: RewindOperation; message: string }
  /**
   * 전달 (7-4~7-6): 커밋 안 된 변경을 처리하고(discard는 git stash -u, commit은 커밋. message는 그 메시지),
   * branch를 origin에 push하고, pr이면 taskId의 pr.md로 PR을 만든다(같은 브랜치의 PR이 열려 있으면 링크만).
   * main은 결과를 delivery.stage, delivery.succeeded, delivery.failed로 알린다
   */
  | {
      type: 'deliver'
      taskId: string
      choice: DeliveryChoice
      uncommitted: UncommittedAction | null
      message: string | null
      branch: string
      base: string
    }
  /** [AI 세션 열기] (7-5): 기록하지 않는 정리 세션을 worktree에서 연다. 세션 상한(D18)을 따른다 */
  | { type: 'openCleanup'; choice: DeliveryChoice }
  /**
   * 정리 (시나리오 8-2): 살아 있는 세션을 끝내고, worktree를 지우고(force면 --force), 브랜치를 지운다.
   * resume이 있으면 끊긴 정리를 그 단계부터 잇는다(D123): branches면 worktree는 건너뛰고, worktree면 --force를
   * core/recovery의 cleanResume으로 다시 정한다. main은 결과를 clean.removed, clean.done, clean.failed로 알린다
   */
  | {
      type: 'clean'
      force: boolean
      deleteBranches: string[]
      deleteRemote?: string
      resume?: CleanStage
    }
  /**
   * 머지 (D176, D177): gh pr merge --match-head-commit <head>. resume이면 끊긴 머지를 잇는다(D123): 먼저 PR을 읽어 머지됐으면
   * 성공으로 알린다. main은 결과를 pr.merged, pr.mergeFailed로 알린다
   */
  | { type: 'merge'; method: MergeMethod; head: string; resume?: boolean }
  /**
   * PR 대응의 push와 답글 게시 (시나리오 10-6, D169, D172, D193, D194). push를 미룬 앞 라운드와 승인한 task(rounds 차례)의
   * 커밋을 함께 push하고 라운드마다 답글을 게시한다. resume이면 끊긴 곳부터 잇는다(D123): 원격에 이미 있는 커밋은 다시
   * 보내지 않고, 게시한 답글은 건너뛰며, 결과를 모르는 답글은 원격에서 표시를 찾는다(D194). main은 결과를
   * respond.pushed, respond.published, respond.deferred, respond.failed로 알린다
   */
  | { type: 'respond'; taskId: string; rounds: string[]; resume?: boolean }
  /**
   * 이슈 기록의 대기열을 앞부터 게시한다 (I98, D344). main은 처리 줄 밖에서 하나씩 게시하고 결과를 issue.attempted,
   * issue.created, issue.posted, issue.closed, issue.failed로 알린다. 이미 게시하는 중이면 그 줄이 이어서 한다
   */
  | { type: 'publishIssue' }

export interface Transition {
  work: WorkState
  effects: Effect[]
  /**
   * 명령(세션 시작, 승인, 사람 버튼)을 받아들이지 않은 이유. 끝난 세션에서 늦게 온 신호처럼
   * 흐름에서 생길 수 있는 이벤트는 이유 없이 무시한다.
   */
  rejected?: string
}

// ---------- 도움 ----------

/** 세션이 살아 있을 때의 표시 (시나리오 3). 승인 대기와 막힘은 세션이 끝나도 남는다 */
const LIVE: readonly TaskStatus[] = [
  'working',
  'asking',
  'input_needed',
  'idle',
  'awaiting_approval',
  'blocked',
]

/** 세션을 끝내도 남는 표시: 유효한 handoff가 있는 승인 대기와 막힘 (3.3) */
const KEPT_WITHOUT_SESSION: readonly TaskStatus[] = ['awaiting_approval', 'blocked']

/** [재개]·[세션 재개]를 받는 상태. 세션이 살아 있지 않아야 한다 */
const RESUMABLE: readonly TaskStatus[] = [
  'interrupted',
  'session_ended',
  'awaiting_approval',
  'blocked',
]

/** 질문 도구 (D24, D35). main은 이 도구의 훅만 core에 넘기고 나머지 도구의 훅은 진행 표시만 바꾼다 (D216) */
export const ASK_TOOL = 'AskUserQuestion'
const PERMISSION_PROMPT = 'permission_prompt'

/** /clear와 /resume도 SessionEnd를 보내지만 CLI는 새 세션으로 계속 돈다. 세션 종료로 보지 않는다 (D110) */
const SESSION_CONTINUES: readonly string[] = ['clear', 'resume']

/** 턴 안에서만 오는 훅. 이 훅이 가져온 세션에는 대화가 있다 */
const TURN_HOOKS: readonly string[] = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop']
const BYPASS_MODE = 'bypassPermissions'

const pad = (n: number) => String(n).padStart(2, '0')

/** task id: t-01 */
export function taskId(seq: number): string {
  return `t-${pad(seq)}`
}

/** task 디렉터리 이름: 01-intake (5.1) */
export function taskDirName(task: Pick<TaskRecord, 'seq' | 'node'>): string {
  return `${pad(task.seq)}-${task.node}`
}

/** 지금 task. 파이프라인은 한 번에 task 하나만 진행한다 */
export function currentTask(work: WorkState): TaskRecord | undefined {
  return work.tasks[work.tasks.length - 1]
}

/** 권한 확인 끈 모드가 아니면 탭 머리 띠에 경고한다 (D94) */
export function permissionWarning(task: TaskRecord): boolean {
  return task.permission_mode !== undefined && task.permission_mode !== BYPASS_MODE
}

/**
 * 세션을 띄울 수 있는 task: 세션이 살아 있지 않고, 새로 만들었거나(작업 중) 대기열에서 자리를 기다리거나
 * [재개]·[세션 재개]를 받는 상태다. main은 띄운 결과를 session.started, session.resumed, session.failed,
 * task.queued로 알린다. 명령과 그 할 일은 Work의 처리 줄 한 번에 끝나므로 그 사이에 다른 명령은 오지 않는다.
 */
function launchable(task: TaskRecord): boolean {
  if (task.session?.alive) return false
  return task.status === 'working' || task.status === 'queued' || RESUMABLE.includes(task.status)
}

/**
 * 사람이 할 수 있는 조작 (액션 바). 화면에 보이는 버튼과 machine이 받는 명령이 같은 판정을 쓴다.
 * [즉시 중단]은 세션이 살아 있거나 대기열에 있을 때, [재개]·[세션 재개]는 세션이 없고 중단됨, 세션 종료,
 * 승인 대기, 막힘일 때, [이 단계 새 세션으로 다시]는 세션 종료일 때다. [단계 선택]은 진행 중이거나 멈춘
 * Work에서 한다(6.2). 고를 수 있는 단계는 core/rewind가 정한다. 멈춘 Work의 [재개]는 verify에서 멈췄으면
 * 보이지 않는다: Work 완료 화면의 전달 버튼이 맡는다(D119). [Work 정리]는 완료나 포기한 Work에서 한다.
 * PR 진행 중에는 끝나지 않은 PR 대응 task의 [즉시 중단]과 [재개]만 있다(D182).
 * 진행 중 작업 기록이 있는 동안은 아무 조작도 받지 않는다: 끊긴 작업이면 패널의 [다시 시도]·[무시]만 받는다(D122).
 */
export function actions(work: WorkState): WorkActions {
  if (work.operation) {
    return {
      interrupt: false,
      resume: false,
      retry: false,
      resumeWork: false,
      selectStep: false,
      stopAfter: false,
      abandon: false,
      clean: false,
    }
  }
  const task = currentTask(work)
  const active = !!task && taskActive(work, task)
  const live = task?.session?.alive === true
  return {
    interrupt: active && (live || task.status === 'queued'),
    resume:
      active &&
      knownTaskEngine(task) !== null &&
      !live &&
      RESUMABLE.includes(task.status) &&
      task.session?.id !== '',
    retry:
      work.status === 'active' &&
      !!task &&
      (task.status === 'session_ended' || unidentifiedCodex(task)),
    resumeWork: work.status === 'stopped' && !stoppedVerify(work),
    selectStep: canSelectStep(work),
    stopAfter: work.status === 'active',
    abandon: work.status === 'active' || work.status === 'stopped',
    clean: canClean(work),
  }
}

/**
 * task의 세션을 다루는 사람 조작([즉시 중단], [재개])을 받는 Work인가: 진행 중이거나, PR 진행이고 그 task가 끝나지 않은
 * PR 대응 task다 (D182)
 */
function taskActive(work: WorkState, task: TaskRecord): boolean {
  return work.status === 'active' || (work.status === 'pr' && isRespondPending(task))
}

function newTask(
  work: WorkState,
  node: TaskNode,
  at: string,
  reason: StartReason = 'default',
): TaskRecord {
  const seq = Math.max(0, ...work.tasks.map((t) => t.seq)) + 1
  return {
    id: taskId(seq),
    seq,
    node,
    status: 'working',
    reason,
    format_version: FORMAT_VERSION,
    created_at: at,
    session: null,
    bounce_count: 0,
    check: null,
  }
}

function withTask(work: WorkState, task: TaskRecord): WorkState {
  return { ...work, tasks: work.tasks.map((t) => (t.id === task.id ? task : t)) }
}

function log(
  work: WorkState,
  at: string,
  type: LifecycleEvent['type'],
  payload: Record<string, unknown> = {},
  task?: TaskRecord,
): Effect {
  const event: LifecycleEvent = task
    ? { ts: at, work_id: work.work_id, task_id: task.id, type, payload }
    : { ts: at, work_id: work.work_id, type, payload }
  return { type: 'log', event }
}

const unchanged = (work: WorkState, rejected?: string): Transition =>
  rejected === undefined ? { work, effects: [] } : { work, effects: [], rejected }

/** 형식 검사로 정한 표시: 유효한 handoff면 승인 대기나 막힘, 아니면 null (3.3, 시나리오 3의 Stop) */
function handoffStatus(check: CheckSummary): 'awaiting_approval' | 'blocked' | null {
  if (!isValid(check)) return null
  return check.status === 'blocked' ? 'blocked' : 'awaiting_approval'
}

/** 세션 없이 남는 task의 표시: 유효한 handoff면 승인 대기나 막힘(3.3), 아니면 중단됨 */
function withoutSession(check: CheckSummary | undefined | null): TaskStatus {
  return (check ? handoffStatus(check) : null) ?? 'interrupted'
}

/** 키를 뺀 사본 */
function omit<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const drop: readonly PropertyKey[] = keys
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !drop.includes(k))) as Omit<T, K>
}

/** 대기열 표시를 지운 task */
const unqueued = (task: TaskRecord): TaskRecord => omit(task, 'queued_at')

/** [이 단계 끝나면 멈춤] 표시를 지운 Work */
const withoutStopAfter = (work: WorkState): WorkState => omit(work, 'stop_after_step')

// ---------- 자동 승인 카운트다운 (4.3, D127~D131) ----------

/** 카운트다운을 멈추고 자동 승인하지 않은 까닭을 적는다. 사람의 승인을 기다리고, 다음 Stop에서 다시 판정한다 */
function held(task: TaskRecord, at: string, reasons: AutoHoldReason[]): TaskRecord {
  return { ...omit(task, 'countdown'), auto_hold: { at, reasons } }
}

/** PR 대응 task인데 PR이 닫혀 있다: 닫힌 PR은 승인을 받지 않아 자동 승인하지 않는다 (D179) */
function closedHold(work: WorkState, task: TaskRecord): AutoHoldReason[] {
  return task.node === RESPOND && work.pr?.closed_at !== undefined ? ['pr_closed'] : []
}

/** 이 task가 어긴 자동 승인 조건 (4.3, D129) */
function holdsNow(
  work: WorkState,
  task: TaskRecord,
  check: AutoApproveInput['check'],
  background: boolean,
): AutoHoldReason[] {
  const holds = autoApproveHolds({ node: task.node, type: workType(work), check, background })
  // Codex Stop은 미완료 작업 전체의 부재를 보장하지 않는다. 타이머/감시에서도 이 판정을 유지한다 (E8).
  const engine = knownTaskEngine(task)
  return engine === null
    ? [...holds, 'settings']
    : engine === 'codex'
      ? [...holds, 'completion_unknown']
      : holds
}

/**
 * Stop으로 승인 대기가 된 task의 자동 승인 판정 (4.3, D128, D129, D131). 그때의 설정으로 자동 승인이 켜진 단계이고
 * 조건을 모두 만족하면 카운트다운을 시작한다. 어긴 조건은 승인 화면에 보이게 적는다. 턴이 끝날 때마다 새로 판정한다
 */
function judgeAtStop(work: WorkState, task: TaskRecord, e: Stopped, config: AppConfig): TaskRecord {
  if (approvalMode(config, work.settings, task.node, knownTaskEngine(task)) !== 'auto') return task
  const reasons: AutoHoldReason[] = work.operation
    ? ['operation']
    : [...closedHold(work, task), ...holdsNow(work, task, e.check, e.background === true)]
  if (reasons.length) return { ...task, auto_hold: { at: e.at, reasons } }
  return { ...task, countdown: { started_at: e.at, seconds: config.auto_approve_countdown_sec } }
}

/** 카운트다운 중인 task의 단계에서 자동 승인을 껐으면(앱 설정이든 Work 설정이든) 바로 멈춘다 (D128) */
function autoTurnedOff(work: WorkState, at: string, config: AppConfig): WorkState {
  const task = currentTask(work)
  if (
    !task?.countdown ||
    approvalMode(config, work.settings, task.node, knownTaskEngine(task)) === 'auto'
  )
    return work
  return withTask(work, held(task, at, ['settings']))
}

/**
 * 카운트다운은 승인 대기인 task에만 있다 (D127): 승인 대기를 벗어난 task(작업 중, 승인됨, 폐기됨 등)의 카운트다운과
 * 자동 승인하지 않은 까닭은 지운다. 새 요청(UserPromptSubmit)으로 작업 중이 되면 이렇게 카운트다운이 멈춘다 (4.3).
 * 카운트다운이 바뀌었으면 main의 타이머를 걸거나 푼다
 */
function countdownEffects(before: WorkState, t: Transition): Transition {
  if (t.work === before) return t
  const stale = (x: TaskRecord) =>
    x.status !== 'awaiting_approval' && (x.countdown !== undefined || x.auto_hold !== undefined)
  const work = t.work.tasks.some(stale)
    ? {
        ...t.work,
        tasks: t.work.tasks.map((x): TaskRecord =>
          stale(x) ? omit(x, 'countdown', 'auto_hold') : x,
        ),
      }
    : t.work
  const stops: Effect[] = []
  const starts: Effect[] = []
  for (const x of work.tasks) {
    const was = before.tasks.find((b) => b.id === x.id)?.countdown
    const now = x.countdown
    if (was && was.started_at !== now?.started_at)
      stops.push({ type: 'stopCountdown', taskId: x.id })
    if (now && now.started_at !== was?.started_at) {
      starts.push({
        type: 'startCountdown',
        taskId: x.id,
        startedAt: now.started_at,
        seconds: now.seconds,
      })
    }
  }
  if (work === t.work && !stops.length && !starts.length) return t
  return { ...t, work, effects: [...stops, ...t.effects, ...starts] }
}

/** 세션을 끝내 카운트다운을 멈춘 까닭 (D145): [즉시 중단], 앱 종료 확인, [단계 선택] */
function endHold(reason: InterruptReason | 'pr_merged' | StepKind): AutoHoldReason {
  if (reason === 'human') return 'interrupt'
  return reason === 'app_quit' ? 'quit' : 'step'
}

/**
 * 세션을 끝낸다: 살아 있으면 endSession, 대기열에 있으면 dequeue. 승인 대기와 막힘은 그대로 두고,
 * 그 밖에는 중단됨이다 (3.3). 세션도 대기열도 아니면 null. 단계 선택(rewind, skip)으로 끝낸 task는 곧
 * 폐기되지만, 코드 되돌리기가 실패하면 이 표시로 남는다.
 */
function endTask(
  work: WorkState,
  task: TaskRecord,
  at: string,
  reason: InterruptReason | 'abandoned' | 'pr_merged' | StepKind,
  check?: CheckSummary,
): { task: TaskRecord; effects: Effect[] } | null {
  // 포기와 밖에서 머지됨(D179)은 Work가 끝난다: 승인 대기로도 남기지 않는다
  const final = reason === 'abandoned' || reason === 'pr_merged'
  if (task.status === 'queued') {
    const status = final ? 'interrupted' : withoutSession(check)
    return {
      task: { ...unqueued(task), status },
      effects: [
        { type: 'dequeue', taskId: task.id },
        log(work, at, 'task.interrupted', { reason, queued: true }, task),
      ],
    }
  }
  if (!task.session?.alive) return null
  const kept = !final && KEPT_WITHOUT_SESSION.includes(task.status)
  const ended: TaskRecord = {
    ...task,
    status: kept ? task.status : 'interrupted',
    session: {
      ...task.session,
      alive: false,
      ended_at: at,
      // 앱 종료 확인으로 끝낸 세션 (D219)
      ...(reason === 'app_quit' ? { app_ended: 'quit' as const } : {}),
    },
  }
  return {
    // 카운트다운 중이던 승인 대기는 카운트다운을 멈추고 사람의 승인을 기다린다 (D130).
    // 까닭은 세션을 끝낸 까닭대로 적는다 (D145)
    task: kept && task.countdown ? held(ended, at, [endHold(reason)]) : ended,
    effects: [
      log(work, at, 'task.interrupted', { reason }, task),
      { type: 'endSession', taskId: task.id },
    ],
  }
}

// ---------- Work 만들기 ----------

export interface NewWork {
  /** 첫 task 생성 시 고정한다. 기존 호출자는 Claude를 사용한다. */
  engine?: AgentEngine
  /** 첫 task에 고정할 엔진·모델·추론 수준(resolveAgent). 있으면 engine보다 우선한다 */
  agent?: ResolvedAgent
  workId: string
  /** 업무 유형 (D236). 사람이 새 Work 대화상자에서 고른 값이다 */
  type: WorkType
  /** 기준 브랜치와, Work를 만들 때 분기한 기준 커밋 (시나리오 1, D97) */
  baseBranch: string
  baseCommit: string
  settings?: WorkSettingsPatch
  /** 앱이 쓴 request.md의 해시 (D124) */
  requestHash?: string
  /**
   * 이슈 기록 (I96). 이슈 기록이 켜진 프로젝트면 있고, linked는 새 Work 대화상자에 적은 기존 이슈 번호(D338), mark는 보이지
   * 않는 표시의 id(D349)다. 없으면 이슈 기록이 없다
   */
  issue?: { linked: number | null; mark: string }
  at: string
}

/** Work를 만들고 intake task를 시작한다 (시나리오 1-2, 1-3) */
export function createWork(input: NewWork): Transition {
  const hashes: OwnedFileHashes = input.requestHash ? { 'request.md': input.requestHash } : {}
  const empty: WorkState = {
    schema_version: 1,
    work_id: input.workId,
    type: input.type,
    status: 'active',
    created_at: input.at,
    base_branch: input.baseBranch,
    base_commit: input.baseCommit,
    intent: null,
    // 빈 값은 앱 설정을 따른다는 뜻이라 두지 않는다 (D72)
    settings: mergeWorkSettings({}, input.settings ?? {}),
    file_hashes: hashes,
    ...(input.issue ? { issue: newIssueRecord(input.issue.linked, input.issue.mark) } : {}),
    tasks: [],
  }
  const intake = {
    ...newTask(empty, 'intake', input.at),
    ...(input.agent ?? { engine: input.engine ?? 'claude' }),
  }
  const work = { ...empty, tasks: [intake] }
  return {
    work,
    effects: [
      log(work, input.at, 'work.created', {
        type: input.type,
        base_branch: input.baseBranch,
        base_commit: input.baseCommit,
      }),
      { type: 'startTask', taskId: intake.id, node: intake.node, reason: intake.reason },
    ],
  }
}

// ---------- 전이 ----------

const TASK_COMMANDS: readonly MachineEvent['type'][] = [
  'session.started',
  'session.resumed',
  'session.failed',
  'task.queued',
  'approve',
  'countdown.cancel',
  'interrupt',
  'resume',
  'retry',
]

/**
 * 진행 중 작업 기록이 있는 동안 받지 않는 사람의 명령 (D122). 기록은 명령 하나 안에서 쓰고 지우므로 명령 사이에
 * 남아 있으면 앱이 도중에 꺼진 끊긴 작업이다. [다시 시도]·[무시]와 Work 설정만 받는다
 */
const BLOCKED_BY_OPERATION: readonly MachineEvent['type'][] = [
  'approve',
  'countdown.cancel',
  'interrupt',
  'resume',
  'retry',
  'stopAfter',
  'resumeWork',
  'abandon',
  'selectStep',
  'deliver',
  'clean',
  'pr.merge',
  'pr.end',
  'pr.respond',
  'pr.checksRerun',
]

export function transition(work: WorkState, event: MachineEvent, config: AppConfig): Transition {
  return queueIssue(
    withEngines(work, countdownEffects(work, dispatch(work, event, config)), config),
  )
}

/**
 * 이번 전이로 새로 만든 task에 지금 설정의 그 단계 엔진·모델·추론 수준을 적는다. 시작과 재개가 이 값을 쓰므로 뒤에 설정을
 * 바꿔도 기존 task는 그대로다
 */
function withEngines(work: WorkState, result: Transition, config: AppConfig): Transition {
  if (result.work.tasks === work.tasks) return result
  const previousIds = new Set(work.tasks.map((t) => t.id))
  let created = false
  const tasks = result.work.tasks.map((t) => {
    if (previousIds.has(t.id)) return t
    created = true
    return { ...t, ...resolveAgent(config, NODE_INFO[t.node].skill) }
  })
  return created ? { ...result, work: { ...result.work, tasks } } : result
}

function dispatch(work: WorkState, event: MachineEvent, config: AppConfig): Transition {
  if (work.operation && BLOCKED_BY_OPERATION.includes(event.type)) {
    return unchanged(work, OPERATION_BLOCKS)
  }
  switch (event.type) {
    case 'stopAfter':
      return stopAfter(work, event)
    case 'shelve':
      return shelve(work, event)
    case 'resumeWork':
      return resumeWork(work, event)
    case 'abandon':
      return abandon(work, event)
    case 'settings.update':
      return updateSettings(work, event, config)
    case 'config.updated':
      return configUpdated(work, event, config)
    case 'app.restarted':
      return restarted(work, event, config)
    case 'selectStep':
      return selectStep(work, event)
    case 'rewind.backedUp':
      return rewindBackedUp(work, event)
    case 'rewind.applied':
      return rewindApplied(work, event)
    case 'rewind.failed':
      return rewindFailed(work, event)
    case 'deliver':
      return deliver(work, event)
    case 'delivery.stage':
      return deliveryStaged(work, event)
    case 'delivery.succeeded':
      return deliverySucceeded(work, event)
    case 'delivery.failed':
      return deliveryFailed(work, event)
    case 'clean':
      return clean(work, event)
    case 'clean.removed':
      return cleanRemoved(work)
    case 'clean.branchesDeleted':
      return cleanBranchesDeleted(work)
    case 'clean.done':
      return cleanDone(work, event)
    case 'clean.failed':
      return cleanFailed(work)
    case 'operationRetry':
      return operationRetry(work, event)
    case 'operationIgnore':
      return operationIgnore(work, event)
    case 'cleanup.started':
      return cleanupStarted(work, event)
    case 'cleanup.ended':
      return cleanupEnded(work)
    case 'files.recorded':
      return filesRecorded(work, event)
    case 'pr.read':
      return prRead(work, event)
    case 'pr.merge':
      return prMerge(work, event)
    case 'pr.merged':
      return prMerged(work, event)
    case 'pr.mergeFailed':
      return prMergeFailed(work, event)
    case 'pr.end':
      return prEnd(work, event)
    case 'pr.cleanOffered':
      return prCleanOffered(work, event)
    case 'pr.respond':
      return prRespond(work, event, config)
    case 'pr.autoPaused':
      return prAutoPaused(work, event, config)
    case 'respond.pushed':
      return respondPushed(work, event)
    case 'respond.published':
      return respondPublished(work, event)
    case 'respond.deferred':
      return respondDeferred(work, event)
    case 'respond.failed':
      return respondFailed(work, event)
    case 'pr.checksRerun':
      return prChecksRerun(work, event)
    case 'issue.attempted':
    case 'issue.created':
    case 'issue.posted':
    case 'issue.closed':
    case 'issue.failed':
      return issueEvent(work, event)
    default:
      return taskTransition(work, event, config)
  }
}

type TaskMachineEvent = Exclude<
  MachineEvent,
  | StopAfterStep
  | ShelveWork
  | ResumeWork
  | Abandon
  | UpdateSettings
  | ConfigUpdated
  | AppRestarted
  | SelectStep
  | RewindBackedUp
  | RewindApplied
  | RewindFailed
  | Deliver
  | DeliveryStaged
  | DeliverySucceeded
  | DeliveryFailed
  | Clean
  | CleanRemoved
  | CleanBranchesDeleted
  | CleanDone
  | CleanFailed
  | OperationRetry
  | OperationIgnore
  | CleanupStarted
  | CleanupEnded
  | FilesRecorded
  | PrRead
  | PrMerge
  | PrMergeSucceeded
  | PrMergeFailed
  | PrEnd
  | PrCleanOffered
  | PrRespond
  | PrAutoPaused
  | RespondPushed
  | RespondPublished
  | RespondDeferred
  | RespondFailed
  | PrChecksRerun
  | IssueAttempted
  | IssueCreated
  | IssuePosted
  | IssueClosed
  | IssueFailed
>

function taskTransition(work: WorkState, event: TaskMachineEvent, config: AppConfig): Transition {
  const task = work.tasks.find((t) => t.id === event.taskId)
  const command = TASK_COMMANDS.includes(event.type)
  if (!task || task !== currentTask(work)) {
    return command ? unchanged(work, `${event.taskId}는 지금 task가 아님`) : unchanged(work)
  }
  switch (event.type) {
    case 'session.identified': {
      if (!task.session?.alive || !event.sessionId || event.agentId !== undefined)
        return unchanged(work)
      if (task.session.id === event.sessionId) return unchanged(work)
      return {
        work: withTask(work, { ...task, session: { ...task.session, id: event.sessionId } }),
        effects: [
          log(work, event.at, 'task.session_identified', { session_id: event.sessionId }, task),
        ],
      }
    }
    case 'turn.started':
      return hook(work, task, { ...event, type: 'UserPromptSubmit' }, config)
    case 'question.started':
    case 'question.finished':
      return hook(
        work,
        task,
        {
          ...event,
          type: event.type === 'question.started' ? 'PreToolUse' : 'PostToolUse',
          toolName: ASK_TOOL,
        },
        config,
      )
    case 'input.required':
      return hook(
        work,
        task,
        { ...event, type: 'Notification', notificationType: PERMISSION_PROMPT },
        config,
      )
    case 'turn.completed':
      return hook(
        work,
        task,
        { ...event, type: 'Stop', background: event.pending === 'pending' },
        config,
      )
    case 'turn.interrupted': {
      if (!task.session?.alive) return unchanged(work)
      const check = summarize(event.check)
      return {
        work: withTask(work, {
          ...omit(task, 'countdown', 'auto_hold'),
          check,
          status: handoffStatus(check) ?? 'idle',
        }),
        effects: [],
      }
    }
    case 'session.ended':
      return sessionEnded(work, task, { ...event, type: 'SessionEnd' })
    case 'session.started':
      return sessionStarted(work, task, event)
    case 'session.resumed':
      return sessionResumed(work, task, event)
    case 'session.failed':
      return sessionFailed(work, task, event)
    case 'session.timing':
      return sessionTiming(work, task, event)
    case 'task.queued':
      return queued(work, task, event)
    case 'approve':
      return approve(work, task, event)
    case 'autoApprove':
      return autoApprove(work, task, event, config)
    case 'countdown.cancel':
      return cancelCountdown(work, task, event)
    case 'interrupt':
      return interrupt(work, task, event)
    case 'resume':
      return resume(work, task)
    case 'retry':
      return retry(work, task, event)
    case 'check.updated':
      return checkUpdated(work, task, event)
    case 'SessionEnd':
    case 'pty.exit':
      return sessionEnded(work, task, event)
    default:
      return hook(work, task, event, config)
  }
}

function sessionStarted(work: WorkState, task: TaskRecord, e: SessionStarted): Transition {
  if (!launchable(task) || task.session) return unchanged(work, `${task.id}는 이미 시작함`)
  const started: TaskRecord = {
    ...omit(unqueued(task), 'error'),
    status: 'working',
    start_commit: e.startCommit,
    skill_hash: e.skillHash,
    ...versionRecord(task, e),
    session: {
      id: e.sessionId,
      pid: e.pid,
      ...(e.processStartedAt === undefined ? {} : { process_started_at: e.processStartedAt }),
      started_at: e.at,
      alive: true,
    },
  }
  return {
    work: withTask(work, started),
    effects: [
      log(work, e.at, 'task.started', { reason: task.reason, session_id: e.sessionId }, task),
    ],
  }
}

/**
 * 다시 연 세션 (시나리오 3-4). pid와 시작 시각을 바꾸고, 표시는 다시 연 때의 검사로 정한다:
 * 유효한 handoff면 승인 대기나 막힘, 아니면 대기다. 다시 연 claude는 사람의 입력을 기다린다 (S6).
 */
function sessionResumed(work: WorkState, task: TaskRecord, e: SessionResumed): Transition {
  if (!launchable(task) || !task.session) {
    return unchanged(work, `${task.id}는 다시 열 수 있는 상태가 아님`)
  }
  const check = summarize(e.check)
  const status = handoffStatus(check) ?? 'idle'
  const session = omit(task.session, 'ended_at', 'process_started_at', 'app_ended')
  const resumed: TaskRecord = {
    ...omit(unqueued(task), 'error'),
    status,
    check,
    ...versionRecord(task, e),
    session: {
      ...session,
      pid: e.pid,
      ...(e.processStartedAt === undefined ? {} : { process_started_at: e.processStartedAt }),
      alive: true,
      resumed_at: e.at,
    },
  }
  const effects: Effect[] = [
    log(
      work,
      e.at,
      'task.resumed',
      {
        session_id: task.session.id,
        engine: taskEngine(task),
        engine_version: e.engineVersion ?? e.claudeVersion,
        ...(taskEngine(task) === 'claude'
          ? { claude_version: e.engineVersion ?? e.claudeVersion }
          : {}),
      },
      task,
    ),
  ]
  if (status === 'awaiting_approval' && task.status !== 'awaiting_approval') {
    effects.push(log(work, e.at, 'task.awaiting_approval', {}, task))
  }
  return { work: withTask(work, resumed), effects }
}

/** Claude의 이전 버전 필드는 유지하면서 엔진 공통 버전을 기록한다. */
function versionRecord(task: TaskRecord, e: SessionStarted | SessionResumed): Partial<TaskRecord> {
  const version = e.engineVersion ?? e.claudeVersion
  if (version === undefined) return {}
  return {
    engine_version: version,
    ...(taskEngine(task) === 'claude' ? { claude_version: version } : {}),
  }
}

function sessionFailed(work: WorkState, task: TaskRecord, e: SessionFailed): Transition {
  if (!launchable(task)) return unchanged(work, `${task.id}는 이미 시작함`)
  const failed: TaskRecord = {
    ...unqueued(task),
    status: withoutSession(e.check),
    error: e.error,
    ...(e.check ? { check: summarize(e.check) } : {}),
  }
  return {
    work: withTask(work, failed),
    effects: [
      log(work, e.at, 'task.interrupted', { reason: 'start_failed', error: e.error }, task),
    ],
  }
}

/** 세션의 첫 출력과 첫 훅을 events.jsonl에 남긴다 (D217). 이 task의 지금 세션이 아니면 남기지 않는다 */
function sessionTiming(work: WorkState, task: TaskRecord, e: SessionTiming): Transition {
  if (!task.session || task.session.pid !== e.pid) return unchanged(work)
  const type = e.first === 'output' ? 'task.first_output' : 'task.first_hook'
  const payload = { pid: e.pid, ms: e.ms, ...(e.hook === undefined ? {} : { event: e.hook }) }
  return { work, effects: [log(work, e.at, type, payload, task)] }
}

/** 세션 상한 때문에 대기열에 넣었다 (D18) */
function queued(work: WorkState, task: TaskRecord, e: TaskQueued): Transition {
  if (!launchable(task)) return unchanged(work, `${task.id}는 띄울 수 있는 상태가 아님`)
  return { work: withTask(work, { ...task, status: 'queued', queued_at: e.at }), effects: [] }
}

/** 훅 신호에 따른 표시 (시나리오 3의 표) */
function hook(
  work: WorkState,
  current: TaskRecord,
  e: UserPromptSubmitted | ToolUse | NotificationSent | Stopped,
  config: AppConfig,
): Transition {
  if (!current.session?.alive || !LIVE.includes(current.status)) return unchanged(work)
  const task = followSession(current, e)
  const set = (patch: Partial<TaskRecord>): Transition => ({
    work: withTask(work, { ...task, ...patch }),
    effects: [],
  })
  const keep = (): Transition => (task === current ? unchanged(work) : set({}))
  switch (e.type) {
    case 'UserPromptSubmit':
      // 작업 중. 사람이 새 요청을 보낸 때를 남기고, 첫 신호의 permission_mode를 기록한다 (D94).
      // 새 요청의 턴은 되돌림이 아니다: 되돌림 안내(D220)를 지운다. 다음 Stop도 0부터 센다
      return set({
        status: 'working',
        bounce_count: 0,
        last_prompt_at: e.at,
        ...(task.permission_mode === undefined && e.permissionMode !== undefined
          ? { permission_mode: e.permissionMode }
          : {}),
      })
    case 'PreToolUse':
      return e.toolName === ASK_TOOL ? set({ status: 'asking' }) : keep()
    case 'PostToolUse':
      return e.toolName === ASK_TOOL ? set({ status: 'working' }) : keep()
    case 'Notification':
      return e.notificationType === PERMISSION_PROMPT ? set({ status: 'input_needed' }) : keep()
    case 'Stop':
      return stop(work, task, e, config)
  }
}

/**
 * 턴의 훅이 다른 session_id를 가져오면 그 세션을 따른다. /clear, 대화형 /resume, /branch로 CLI가 다른
 * 대화로 옮긴 것이다 (D110, Claude Code 문서 commands). [재개]는 이 id로 --resume한다.
 * 알림과 SessionEnd로는 옮기지 않는다: /clear 직후처럼 아직 대화가 없는 세션은 --resume으로 열 수 없다 (S6).
 * 서브에이전트 안의 훅으로도 옮기지 않는다.
 */
function followSession(task: TaskRecord, e: HookSignal & { type: string }): TaskRecord {
  const session = task.session
  const id = e.agentId === undefined && TURN_HOOKS.includes(e.type) ? e.sessionId : undefined
  if (!session || !id || id === session.id) return task
  return { ...task, session: { ...session, id } }
}

/**
 * Stop (시나리오 3-2, 3-3). 유효한 handoff가 있으면 승인 대기나 막힘, 없으면 대기다.
 * 형식 오류가 있고 이번 턴에 handoff가 바뀌었으면 설정한 연속 횟수까지 되돌린다 (D21).
 * 연속 횟수는 사람이 새 요청으로 시작한 턴의 Stop이나 검사 통과 때 0으로 돌아간다 (D107).
 */
function stop(work: WorkState, task: TaskRecord, e: Stopped, config: AppConfig): Transition {
  const check = summarize(e.check)
  const bounces = e.stopHookActive ? task.bounce_count : 0
  const status = handoffStatus(check)
  if (status) {
    const entered = status === 'awaiting_approval' && task.status !== 'awaiting_approval'
    // 턴이 끝날 때마다 자동 승인을 새로 판정한다 (D131)
    const base: TaskRecord = {
      ...omit(task, 'countdown', 'auto_hold'),
      status,
      bounce_count: 0,
      check,
    }
    const next = status === 'awaiting_approval' ? judgeAtStop(work, base, e, config) : base
    return {
      work: withTask(work, next),
      effects: entered ? [log(work, e.at, 'task.awaiting_approval', {}, task)] : [],
    }
  }
  const bounce =
    check.handoff_present &&
    check.errors.length > 0 &&
    e.handoffChanged &&
    bounces < config.format_error_bounce_max
  if (bounce) {
    // 몇 번째 되돌림인지와 오류를 남긴다: 어떤 실수가 흔한지 센다 (D220)
    const bounced = {
      attempt: bounces + 1,
      max: config.format_error_bounce_max,
      errors: check.errors.map((x) => ({ file: x.file, message: x.message })),
    }
    return {
      work: withTask(work, { ...task, status: 'working', bounce_count: bounces + 1, check }),
      effects: [
        log(work, e.at, 'task.bounced', bounced, task),
        { type: 'blockStop', taskId: task.id, reason: bounceMessage(check) },
      ],
    }
  }
  return {
    work: withTask(work, { ...task, status: 'idle', bounce_count: bounces, check }),
    effects: [],
  }
}

/**
 * SessionEnd나 PTY 종료 (시나리오 3). 승인 대기와 막힘은 그대로 둔다. 그 밖에는 세션이 끝날 때 다시 한 검사에
 * 유효한 handoff가 있으면 승인 대기나 막힘이고, 없으면 세션 종료다 (3.3, D146). 턴이 끝난 것이 아니라 자동 승인은
 * 판정하지 않는다(다음 Stop부터, D131).
 * SessionEnd의 reason이 clear나 resume이면 CLI가 계속 돌므로 세션 종료로 보지 않는다 (D110).
 * 다시 연 세션이 있으면 앞 프로세스의 늦은 PTY 종료는 무시한다.
 */
function sessionEnded(work: WorkState, task: TaskRecord, e: SessionEnded): Transition {
  if (e.type === 'SessionEnd' && e.reason !== undefined && SESSION_CONTINUES.includes(e.reason)) {
    return unchanged(work)
  }
  if (!task.session?.alive) return unchanged(work)
  if (e.type === 'pty.exit' && e.pid !== undefined && e.pid !== task.session.pid) {
    return unchanged(work)
  }
  const session = { ...task.session, alive: false, ended_at: e.at }
  if (KEPT_WITHOUT_SESSION.includes(task.status)) {
    // 카운트다운 중에 세션이 끝나면(/exit, 크래시) 카운트다운을 멈추고 사람의 승인을 기다린다 (D130)
    const kept: TaskRecord = { ...task, session }
    return {
      work: withTask(work, task.countdown ? held(kept, e.at, ['session']) : kept),
      effects: [],
    }
  }
  const check = e.check ? summarize(e.check) : null
  const status = check ? handoffStatus(check) : null
  if (check && status) {
    return {
      work: withTask(work, { ...task, session, status, check }),
      effects:
        status === 'awaiting_approval'
          ? [log(work, e.at, 'task.awaiting_approval', { reason: 'session_ended' }, task)]
          : [],
    }
  }
  return {
    work: withTask(work, {
      ...task,
      session,
      status: 'session_ended',
      ...(check ? { check } : {}),
    }),
    effects: [log(work, e.at, 'task.interrupted', { reason: 'session_ended' }, task)],
  }
}

/**
 * 승인 (시나리오 4-4, 5). 승인을 기록하고, 세션을 끝내고, 결정을 decisions.md에 더하고, 다음 단계로 간다.
 * intake 승인은 의도 승인이라 intent를 확정한다 (4.1). verify 승인은 Work 완료 화면의 [완료만]이다. [push]·[PR 생성]은
 * deliver가 전달한 뒤 승인을 기록한다 (D120). 승인하면 멈추는 verify는 [승인하고 멈춤]이다 (D119).
 * 에이전트가 턴을 끝낸 뒤(승인 대기, 대기, 세션 종료)에만 받는다. 누른 때의 검사로 다시 판정한다 (approvalGate).
 * [오류 무시하고 승인]이면 무시한 오류를 남기고, 머리글에서 읽지 못한 값은 없는 것으로 본다 (D112).
 * 에이전트가 이전 단계를 추천했으면 다음 task를 시작하지 않고 멈춘다 (D23). [이 단계 끝나면 멈춤]이
 * 켜져 있어도 멈춘다 (시나리오 3-4). verify 승인도 Work를 완료하지 않고 멈추며, [재개]하면 완료한다.
 * 어느 쪽이든 멈춤 표시는 지운다.
 */
function approve(work: WorkState, task: TaskRecord, e: Approve): Transition {
  if (task.node === RESPOND) return respondApprove(work, task, e)
  if (work.status !== 'active') return unchanged(work, '진행 중인 Work가 아님')
  if (!REVIEWABLE.includes(task.status)) {
    return unchanged(work, `${task.id}는 승인할 수 있는 상태가 아님`)
  }
  const check = summarize(e.check)
  const gate = approvalGate(task, check)
  const forced = !gate.approve && e.force === true && gate.force
  if (!gate.approve && !forced) {
    // 승인 화면을 띄운 뒤 파일이 바뀌었다. 오류를 보이고 승인하지 않는다 (4.1).
    const reason = e.force
      ? `${task.id}: 오류를 무시하고 승인할 수 없음`
      : `${task.id}의 handoff가 유효하지 않음`
    return { work: withTask(work, { ...task, check }), effects: [], rejected: reason }
  }
  return approveNow(work, task, {
    at: e.at,
    check: e.check,
    by: 'human',
    ...(forced ? { ignored: gate.errors } : {}),
  })
}

/** 승인을 기록할 것 */
interface Approval {
  at: string
  /** 승인한 때의 형식 검사. 기록할 결정과 이전 단계 추천을 머리글에서 읽는다 */
  check: TaskCheck
  /** 사람 승인이나 자동 승인 (5.4, 5.5) */
  by: ApprovalBy
  /** [오류 무시하고 승인]으로 넘긴 오류 (D112) */
  ignored?: FormatIssue[]
}

/**
 * 승인을 기록하고 다음 단계로 간다 (시나리오 4-4, 5). 사람의 [승인]과 자동 승인(4.3)이 같이 쓴다. 승인 방식은
 * work.json(approved_by), events.jsonl(task.approved의 by), decisions.md의 머리 줄에 남긴다 (5.4, 5.5).
 * 카운트다운과 자동 승인하지 않은 까닭은 지운다.
 */
function approveNow(work: WorkState, task: TaskRecord, a: Approval): Transition {
  const node = task.node
  // PR 대응 task의 승인은 respondApprove다 (D169)
  if (!isPipelineNode(node)) return unchanged(work, `${task.id}는 파이프라인 task가 아님`)
  const header = a.check.handoffHeader
  const session = task.session?.alive
    ? { ...task.session, alive: false, ended_at: a.at }
    : task.session
  const approved: TaskRecord = {
    ...omit(task, 'countdown', 'auto_hold'),
    status: 'approved',
    approved_at: a.at,
    approved_by: a.by,
    check: summarize(a.check),
    session,
    ...(a.ignored ? { ignored_errors: a.ignored } : {}),
  }
  const stopAfterStep = work.stop_after_step === true
  let next: WorkState = withoutStopAfter(withTask(work, approved))
  const payload = a.ignored ? { by: a.by, ignored_errors: a.ignored.length } : { by: a.by }
  const effects: Effect[] = [log(work, a.at, 'task.approved', payload, task)]
  if (task.session?.alive) effects.push({ type: 'endSession', taskId: task.id })
  effects.push({
    type: 'appendDecisions',
    taskId: task.id,
    node: task.node,
    at: a.at,
    by: a.by,
    decisions: header ? header.decisions : null,
  })
  if (task.node === 'intake') {
    const version = (work.intent?.version ?? 0) + 1
    next = { ...next, intent: { version } }
    effects.push({ type: 'confirmIntent', taskId: task.id, version })
  }

  const rec = header?.recommended_next
  if (rec && stopsForRecommendation(workType(work), node, rec.node)) {
    next = {
      ...next,
      status: 'stopped',
      stop: { kind: 'recommended_back', task_id: task.id, node: rec.node, reason: rec.reason },
    }
    return { work: next, effects }
  }
  if (stopAfterStep) {
    next = { ...next, status: 'stopped', stop: { kind: 'after_step', task_id: task.id } }
    return { work: next, effects }
  }
  const nextNode = defaultNext(workType(work), node)
  if (nextNode === WORK_COMPLETE) {
    next = { ...next, status: 'completed', completed_at: a.at }
    effects.push(log(work, a.at, 'work.completed', { delivery: 'none' }))
    return { work: next, effects }
  }
  const created = newTask(next, nextNode, a.at)
  next = { ...next, tasks: [...next.tasks, created] }
  effects.push({
    type: 'startTask',
    taskId: created.id,
    node: created.node,
    reason: created.reason,
  })
  return { work: next, effects }
}

/**
 * 자동 승인 카운트다운이 끝났다 (4.3, D128). 그때의 설정과 다시 읽은 handoff로 다시 판정해, 조건을 모두 만족하면
 * 자동 승인한다. 아니면 카운트다운을 멈추고 사람의 승인을 기다린다(D130). 끊긴 작업의 기록이 있으면 승인하지
 * 않는다(D122). 멈췄거나 새로 시작한 카운트다운의 늦은 타이머는 무시한다.
 */
function autoApprove(
  work: WorkState,
  task: TaskRecord,
  e: AutoApprove,
  config: AppConfig,
): Transition {
  const c = task.countdown
  if (!c || c.started_at !== e.startedAt) return unchanged(work)
  const hold = (reasons: AutoHoldReason[], check?: TaskCheck): Transition => ({
    work: withTask(work, held(check ? { ...task, check: summarize(check) } : task, e.at, reasons)),
    effects: [],
  })
  if (work.operation) return hold(['operation'])
  if (approvalMode(config, work.settings, task.node, knownTaskEngine(task)) !== 'auto')
    return hold(['settings'])
  if (!e.check) return hold(['invalid'])
  const reasons = [...closedHold(work, task), ...holdsNow(work, task, e.check, false)]
  if (reasons.length) return hold(reasons, e.check)
  // PR 대응 task는 승인하면 push하고 답글을 게시한다 (D169, D172)
  if (task.node === RESPOND) {
    return respondApproveNow(work, task, { at: e.at, check: summarize(e.check), by: 'auto' })
  }
  return approveNow(work, task, { at: e.at, check: e.check, by: 'auto' })
}

/** 승인 화면의 [취소] (4.3): 카운트다운을 멈추고 사람의 승인을 기다린다. 다음 Stop에서 다시 판정한다 (D131) */
function cancelCountdown(work: WorkState, task: TaskRecord, e: CancelCountdown): Transition {
  if (!task.countdown) return unchanged(work, `${task.id}는 자동 승인 카운트다운 중이 아님`)
  return { work: withTask(work, held(task, e.at, ['cancel'])), effects: [] }
}

/**
 * 감시(I15)로 다시 한 검사. 패널 표시만 바꾼다. 카운트다운 중이면 자동 승인 조건을 다시 보고, 어기면 카운트다운을
 * 멈춘다 (D130). 카운트다운은 Stop 때 백그라운드 작업이 없을 때만 시작했다 (D129)
 */
function checkUpdated(work: WorkState, task: TaskRecord, e: CheckUpdated): Transition {
  if (task.status === 'approved' || task.status === 'interrupted') return unchanged(work)
  const next: TaskRecord = { ...task, check: summarize(e.check) }
  const reasons = task.countdown ? holdsNow(work, task, e.check, false) : []
  return { work: withTask(work, reasons.length ? held(next, e.at, reasons) : next), effects: [] }
}

/**
 * [즉시 중단] (시나리오 3-4)과 앱 종료 확인 (시나리오 3-6). 세션을 트리째 끝내고 중단됨으로 남긴다.
 * 유효한 handoff로 승인 대기나 막힘이던 task는 세션이 없어도 그 표시가 남는다 (3.3).
 * 대기열의 task는 대기열에서 빼고 중단됨으로 둔다.
 */
function interrupt(work: WorkState, task: TaskRecord, e: Interrupt): Transition {
  if (!taskActive(work, task)) return unchanged(work, '진행 중인 Work가 아님')
  const ended = endTask(work, task, e.at, e.reason, e.check)
  if (!ended) return unchanged(work, `${task.id}에 끝낼 세션이 없음`)
  return { work: withTask(work, ended.task), effects: ended.effects }
}

/**
 * [재개]와 [세션 재개] (시나리오 3-4, 3-5, 4.4). 세션이 있던 task는 같은 옵션과 --resume으로 다시 열고,
 * 한 번도 띄우지 못한 task(대기열에서 재시작을 맞았거나 시작에 실패함)는 새 세션으로 시작한다.
 * 표시는 main이 띄운 결과(session.resumed, session.started, task.queued, session.failed)로 바꾼다.
 * 세션 상한을 넘으면 main이 대기열에 넣는다.
 */
function resume(work: WorkState, task: TaskRecord): Transition {
  if (knownTaskEngine(task) === null)
    return unchanged(work, `${agentLabel(task)}. 이 세션은 재개할 수 없습니다.`)
  if (!taskActive(work, task)) return unchanged(work, '진행 중인 Work가 아님')
  if (task.session?.alive || !RESUMABLE.includes(task.status)) {
    return unchanged(work, `${task.id}는 재개할 수 있는 상태가 아님`)
  }
  if (task.session?.id === '')
    return unchanged(work, 'Codex 대화 ID를 받지 못했습니다. 이 단계 새 세션으로 다시 실행하세요.')
  // 중단됨의 [재개]는 이어서 하라고 알린다. [세션 재개](세션 종료, 막힘, 승인 대기)는 입력을 기다린다 (D218)
  const effect: Effect = task.session
    ? { type: 'resumeTask', taskId: task.id, continue: task.status === 'interrupted' }
    : { type: 'startTask', taskId: task.id, node: task.node, reason: task.reason }
  return { work, effects: [effect] }
}

/**
 * [이 단계 새 세션으로 다시] (시나리오 3-5, D114). 같은 노드의 새 task를 만들어 새 세션으로 시작한다.
 * 앞 task는 세션 종료로 남고 입력에 들어가지 않는다. 코드는 되돌리지 않는다. 앞 task가 단계 선택으로 들어왔으면
 * 그 선택을 이어받는다 (D327)
 */
function retry(work: WorkState, task: TaskRecord, e: Retry): Transition {
  if (work.status !== 'active') return unchanged(work, '진행 중인 Work가 아님')
  if (task.status !== 'session_ended' && !unidentifiedCodex(task)) {
    return unchanged(work, `${task.id}는 handoff 없이 끝난 세션이 아님`)
  }
  const fresh = newTask(work, task.node, e.at, 'resume')
  // 단계 선택으로 들어온 task면 그 선택(추가 지시, 이어서 하기, 폐기한 task)을 이어받는다 (D327)
  const created: TaskRecord = task.selection
    ? // 코드를 되돌린 것(reset)은 앞 task를 시작할 때 한 일이라 이어받지 않는다: [변경]의 범위가 흐트러진다
      { ...fresh, selection: { ...task.selection, reset: null, kind: selectionKind(task) } }
    : fresh
  return {
    work: { ...work, tasks: [...work.tasks, created] },
    effects: [
      { type: 'startTask', taskId: created.id, node: created.node, reason: created.reason },
    ],
  }
}

/** 훅 신뢰 전에 끝나 실제 대화 ID를 받지 못한 Codex는 임의의 ID로 재개하지 않는다. */
function unidentifiedCodex(task: TaskRecord): boolean {
  return sessionUnknown(task) && task.status === 'interrupted' && task.session?.alive !== true
}

// ---------- Work 조작 ----------

/** [이 단계 끝나면 멈춤] (시나리오 3-4). 지금 단계가 승인되면 다음 단계를 시작하지 않고 멈춘다 */
function stopAfter(work: WorkState, e: StopAfterStep): Transition {
  if (work.status !== 'active') return unchanged(work, '진행 중인 Work가 아님')
  if ((work.stop_after_step === true) === e.on) return unchanged(work)
  return { work: e.on ? { ...work, stop_after_step: true } : withoutStopAfter(work), effects: [] }
}

/** [아카이브로 옮기기]를 받는 Work: 보관됐고 아직 옮기지 않았다. 사이드바의 우클릭 메뉴도 이것으로 정한다 */
export function canShelve(work: WorkState): boolean {
  return work.status === 'archived' && work.shelved_at === undefined
}

/**
 * [아카이브로 옮기기]: 보관된 Work만 옮긴다. 이미 옮겼으면 그대로 둔다.
 * 사이드바의 정리라 Work의 수명 이벤트(5.5)는 남기지 않는다 (D381)
 */
function shelve(work: WorkState, e: ShelveWork): Transition {
  if (work.status !== 'archived') return unchanged(work, '보관된 Work가 아님')
  if (!canShelve(work)) return unchanged(work)
  return { work: { ...work, shelved_at: e.at }, effects: [] }
}

/**
 * 멈춘 Work의 [재개] (3.3, 시나리오 3-4). 멈추게 한 task의 기본 다음 단계를 시작한다.
 * 이전 단계 추천(D23)으로 멈췄으면 추천을 따르지 않고 기본 다음 단계로 간다. 추천을 따르는 것은 [단계 선택]이다.
 * 기본 다음 단계가 Work 완료면 전달 없이 Work를 완료한다: verify에서 멈춘 Work의 Work 완료 화면에서 누른
 * [완료만]이다. [push]·[PR 생성]은 deliver다 (D119).
 */
function resumeWork(work: WorkState, e: ResumeWork): Transition {
  if (work.status !== 'stopped' || !work.stop) return unchanged(work, '멈춘 Work가 아님')
  const stopped = work.tasks.find((t) => t.id === work.stop?.task_id)
  const node = stopped?.node
  if (!node || !isPipelineNode(node)) return unchanged(work, '다음 단계를 정할 수 없음')
  const active: WorkState = { ...omit(work, 'stop'), status: 'active' }
  const nextNode = defaultNext(workType(work), node)
  if (nextNode === WORK_COMPLETE) {
    return {
      work: { ...active, status: 'completed', completed_at: e.at },
      effects: [log(work, e.at, 'work.completed', { delivery: 'none' })],
    }
  }
  const created = newTask(active, nextNode, e.at)
  return {
    work: { ...active, tasks: [...active.tasks, created] },
    effects: [
      { type: 'startTask', taskId: created.id, node: created.node, reason: created.reason },
    ],
  }
}

/**
 * [Work 포기] (3.3). 살아 있는 세션을 끝내고 대기열에서 빼고 Work를 포기로 둔다. push/PR은 하지 않는다.
 * 끝낸 task는 승인 대기였어도 중단됨이다(포기한 Work의 task는 승인하지 않는다).
 */
function abandon(work: WorkState, e: Abandon): Transition {
  if (work.status !== 'active' && work.status !== 'stopped') {
    return unchanged(work, '포기할 수 있는 Work가 아님')
  }
  const task = currentTask(work)
  const ended = task ? endTask(work, task, e.at, 'abandoned') : null
  const rest = omit(ended ? withTask(work, ended.task) : work, 'stop', 'stop_after_step')
  return {
    work: { ...rest, status: 'abandoned', abandoned_at: e.at },
    effects: [...(ended?.effects ?? []), log(work, e.at, 'work.abandoned')],
  }
}

/**
 * Work별 설정 (D72). 준 키만 바꾸고, 빈 값이면 앱 설정을 따른다. 끝난 Work는 바꾸지 않는다. PR 진행 중에도 받는다: 대응
 * 자동 시작과 PR 대응 자동 승인의 덮어쓰기가 가장 쓰이는 때다 (D209). 카운트다운 중에 그 단계의 자동 승인을 끄면 바로
 * 멈춘다 (D128). 대응 자동 시작을 켜도 이미 받은 새 항목으로는 시작하지 않는다 (D210)
 */
function updateSettings(work: WorkState, e: UpdateSettings, config: AppConfig): Transition {
  if (work.status !== 'active' && work.status !== 'stopped' && work.status !== 'pr') {
    return unchanged(work, '끝난 Work의 설정은 바꾸지 않음')
  }
  const next = { ...work, settings: mergeWorkSettings(work.settings, e.settings) }
  return { work: autoTurnedOff(next, e.at, config), effects: [] }
}

/** 앱 설정을 바꿨다 (D70). 카운트다운 중에 그 단계의 자동 승인을 껐으면 바로 멈춘다 (D128) */
function configUpdated(work: WorkState, e: ConfigUpdated, config: AppConfig): Transition {
  const next = autoTurnedOff(work, e.at, config)
  return next === work ? unchanged(work) : { work: next, effects: [] }
}

// ---------- 단계 선택 (6.2) ----------

/**
 * [단계 선택]의 [확인] (6.2, D82). core/rewind의 계산을 따른다: 진행 중인 k를 끝내고, 폐기할 task를 폐기하고,
 * 고른 단계의 새 task를 시작한다. 코드를 되돌리는 되감기는 진행 중 작업을 먼저 기록하고(D77) 세션을 끝낸 뒤
 * 코드를 main에 맡긴다(rewindCode). 폐기와 새 task는 main이 rewind.applied를 알린 뒤에 한다.
 * 미리 본 뒤 지금 task나 그 task가 끝났는지가 바뀌었으면 받지 않는다.
 */
function selectStep(work: WorkState, e: SelectStep): Transition {
  const r = planStep(work, e.node, {
    keepCode: e.keepCode,
    backups: e.backups,
    ...(e.workType ? { type: e.workType } : {}),
  })
  if (!r.ok) return unchanged(work, r.error)
  const plan = r.plan
  if (plan.from.id !== e.expect.taskId || plan.done !== e.expect.done) {
    return unchanged(work, '미리 본 뒤 Work가 바뀌었음. 단계 선택을 다시 여세요')
  }
  const instruction = e.instruction.trim() || null
  const ended = plan.done ? null : endTask(work, plan.from, e.at, plan.kind)
  const base = ended ? withTask(work, ended.task) : work
  const effects = [...(ended?.effects ?? [])]
  if (plan.code.kind === 'reset') {
    const operation: RewindOperation = {
      kind: 'rewind',
      stage: 'backup',
      started_at: e.at,
      node: plan.node,
      from_task: plan.from.id,
      instruction,
      discard: plan.discard.map((t) => t.id),
      reset_to: plan.code.to,
      backup_branch: plan.code.backupBranch,
      backup_commit: null,
      ...(plan.type ? { type: plan.type } : {}),
    }
    effects.push({
      type: 'rewindCode',
      to: plan.code.to,
      backupBranch: plan.code.backupBranch,
      message: backupMessage(work.work_id),
    })
    return { work: { ...base, operation }, effects }
  }
  const selection: StepSelection = {
    from_task: plan.from.id,
    instruction,
    discarded: plan.discard.map((t) => t.id),
    skipped: plan.skipped,
    keep_code: plan.code.kind === 'keep',
    reset: null,
  }
  return select(
    base,
    { node: plan.node, reason: plan.reason, selection, ...(plan.type ? { type: plan.type } : {}) },
    e.at,
    effects,
  )
}

/**
 * 되감기의 백업 단계가 끝났다 (D77). 기록을 코드 되돌리기 단계로 옮기고 만든 백업 브랜치와 커밋, 되돌리기 전
 * HEAD를 적는다. 끊긴 되감기를 다시 할 때 이것으로 백업이 지금 코드와 같은지 본다 (D123)
 */
function rewindBackedUp(work: WorkState, e: RewindBackedUp): Transition {
  const op = work.operation
  if (op?.kind !== 'rewind' || op.stage !== 'backup') return unchanged(work)
  return {
    work: {
      ...work,
      operation: {
        ...op,
        stage: 'reset',
        backup_branch: e.branch,
        backup_commit: e.commit,
        ...(e.head === undefined ? {} : { head: e.head }),
      },
    },
    effects: [],
  }
}

/**
 * 되감기가 코드를 되돌렸다. 기록한 요청대로 폐기하고 새 task를 시작하며, 기록은 같이 지운다 (D77).
 * 끊긴 되감기를 다시 하며 덤으로 남긴 백업이 있으면 task.rewound에 적는다 (D123)
 */
function rewindApplied(work: WorkState, e: RewindApplied): Transition {
  const op = work.operation
  if (op?.kind !== 'rewind') return unchanged(work, '진행 중인 되감기가 없음')
  const selection: StepSelection = {
    from_task: op.from_task,
    instruction: op.instruction,
    discarded: op.discard,
    skipped: [],
    keep_code: false,
    reset: {
      from: e.head,
      to: op.reset_to,
      backup_branch: op.stage === 'reset' ? op.backup_branch : null,
      backup_commit: op.stage === 'reset' ? op.backup_commit : null,
    },
  }
  const extra = e.extraBackup === undefined ? {} : { extra_backup_branch: e.extraBackup }
  return select(
    work,
    { node: op.node, reason: 'rewind', selection, ...(op.type ? { type: op.type } : {}) },
    e.at,
    [],
    extra,
  )
}

/** 되감기의 git 작업이 실패했다. 기록만 지운다. 끝낸 세션은 끝난 채로 두고, 오류는 main이 알린다 */
function rewindFailed(work: WorkState, e: RewindFailed): Transition {
  const op = work.operation
  if (!op) return unchanged(work)
  if (e.cut) return { work: { ...work, operation: { ...op, interrupted_at: e.at } }, effects: [] }
  return { work: omit(work, 'operation'), effects: [] }
}

interface Selected {
  node: NodeName
  reason: StartReason
  selection: StepSelection
  /** 의도 승인 전 [intake 다시]에서 바꿀 유형 (D237). 바꾸지 않으면 없다 */
  type?: WorkType
}

/**
 * 단계 선택을 반영한다 (6.2): 폐기할 task를 폐기됨으로 두고(파일은 남음), 고른 단계의 새 task를 만들고,
 * Work를 진행 중으로 되돌리고(멈춤 표시와 진행 중 작업 기록은 지움), 새 task를 시작한다.
 * 되감기는 task.rewound, 건너뛰기는 task.skipped_to를 새 task의 이벤트로 남긴다 (5.5). extra는 되감기 이벤트에
 * 더할 것이다. 유형을 바꾸면 work.json의 type을 바꾸고 task.rewound에 type_from, type_to를 적는다 (D237, I59).
 */
function select(
  work: WorkState,
  s: Selected,
  at: string,
  effects: Effect[],
  extra: Record<string, unknown> = {},
): Transition {
  const created: TaskRecord = { ...newTask(work, s.node, at, s.reason), selection: s.selection }
  const sel = s.selection
  const tasks = work.tasks.map((t): TaskRecord =>
    sel.discarded.includes(t.id)
      ? { ...t, status: 'discarded', discarded_at: at, discarded_by: created.id }
      : t,
  )
  const next: WorkState = {
    ...omit(work, 'stop', 'operation'),
    ...(s.type ? { type: s.type } : {}),
    status: 'active',
    tasks: [...tasks, created],
  }
  const common = { node: s.node, from_task: sel.from_task, discarded: sel.discarded }
  const typed = s.type ? { type_from: workType(work), type_to: s.type } : {}
  if (s.reason === 'rewind') {
    const reset = sel.reset
      ? { reset_to: sel.reset.to, backup_branch: sel.reset.backup_branch }
      : {}
    effects.push(
      log(
        next,
        at,
        'task.rewound',
        { ...common, keep_code: sel.keep_code, ...reset, ...typed, ...extra },
        created,
      ),
    )
  } else if (s.reason === 'skip') {
    effects.push(log(next, at, 'task.skipped_to', { ...common, skipped: sel.skipped }, created))
  }
  effects.push({
    type: 'startTask',
    taskId: created.id,
    node: created.node,
    reason: created.reason,
  })
  return { work: next, effects }
}

// ---------- 전달 (시나리오 7) ----------

/**
 * [push]·[PR 생성] (7-4~7-6, D119, D120). core/delivery의 판정을 따른다: 승인할 수 있는 verify(승인해도
 * 멈추지 않음)이거나 verify에서 멈춘 Work다. verify 세션은 끝낸다(4-4의 승인과 같음). 승인은 기록하지
 * 않는다: 전달이 성공한 뒤 Work 완료와 함께 남긴다(D120). 세션이 없어도 유효한 handoff면 승인 대기다(3.3).
 * [AI 세션 열기](session)는 정리 세션을 main에 맡기고 끝난다. 아니면 진행 중 작업을 기록하고(D77)
 * 전달을 main에 맡긴다.
 */
function deliver(work: WorkState, e: Deliver): Transition {
  const start = deliveryStart(work, e.check)
  if (!start.ok) return unchanged(work, start.error)
  const task = start.task
  const effects: Effect[] = []
  let next = work
  if (start.from === 'review') {
    const ended: TaskRecord = {
      ...task,
      status: 'awaiting_approval',
      ...(e.check ? { check: summarize(e.check) } : {}),
      ...(task.session?.alive
        ? { session: { ...task.session, alive: false, ended_at: e.at } }
        : {}),
    }
    next = withTask(work, ended)
    if (task.status !== 'awaiting_approval') {
      effects.push(log(work, e.at, 'task.awaiting_approval', {}, task))
    }
    if (task.session?.alive) effects.push({ type: 'endSession', taskId: task.id })
  }
  if (e.uncommitted === 'session') {
    effects.push({ type: 'openCleanup', choice: e.choice })
    return { work: next, effects }
  }
  const branch = workBranch(work.work_id)
  const operation: DeliverOperation = {
    kind: 'deliver',
    stage: e.uncommitted ? 'prepare' : 'push',
    started_at: e.at,
    choice: e.choice,
    task_id: task.id,
    uncommitted: e.uncommitted,
    branch,
    base: work.base_branch,
  }
  effects.push({
    type: 'deliver',
    taskId: task.id,
    choice: e.choice,
    uncommitted: e.uncommitted,
    message:
      e.uncommitted === 'commit'
        ? commitMessage(work.work_id)
        : e.uncommitted === 'discard'
          ? stashMessage(work.work_id)
          : null,
    branch,
    base: work.base_branch,
  })
  return { work: { ...next, operation }, effects }
}

/**
 * 전달이 다음 단계로 넘어갔다. 진행 중 작업 기록의 단계를 옮기고, 커밋 안 된 변경을 처리하며 만든 stash나
 * 커밋을 적는다 (D77, 7-5)
 */
function deliveryStaged(work: WorkState, e: DeliveryStaged): Transition {
  const op = work.operation
  if (op?.kind !== 'deliver' || op.stage === e.stage) return unchanged(work)
  const operation: DeliverOperation = {
    ...op,
    stage: e.stage,
    ...(e.stash === undefined ? {} : { stash: e.stash }),
    ...(e.commit === undefined ? {} : { commit: e.commit }),
  }
  return { work: { ...work, operation }, effects: [] }
}

/**
 * 전달 결과에 남길 stash와 커밋 (7-5): 앞 시도의 결과(실패)에 있던 것에 이번 시도가 만든 것을 더한다.
 * 그래서 전달이 실패한 뒤 [다시 시도]가 성공해도 앞 시도가 백업한 stash와 만든 커밋이 기록에 남는다.
 * found는 끊긴 시도가 만들었지만 기록하지 못해 main이 찾은 것이다 (D123)
 */
function deliveryBackups(
  prior: DeliveryRecord | undefined,
  op: DeliverOperation,
  found?: DeliveryFound,
): Pick<DeliveryRecord, 'stashes' | 'commits'> {
  const uniq = (xs: readonly string[]) => [...new Set(xs)]
  const stashes = uniq([
    ...(prior?.stashes ?? []),
    ...(op.stash ? [op.stash] : []),
    ...(found?.stashes ?? []),
  ])
  const commits = uniq([
    ...(prior?.commits ?? []),
    ...(op.commit ? [op.commit] : []),
    ...(found?.commits ?? []),
  ])
  return {
    ...(stashes.length ? { stashes } : {}),
    ...(commits.length ? { commits } : {}),
  }
}

/**
 * 전달이 끝났다 (7-6). verify가 아직 승인되지 않았으면 승인을 기록한다(4-4: 승인 기록, decisions.md.
 * 세션은 전달을 시작할 때 끝냈다). Work를 완료로 바꾸고 전달 결과를 남기며, 진행 중 작업 기록은 같이
 * 지운다. verify에서 멈춘 Work는 멈춤 표시도 지운다 (D119).
 */
function deliverySucceeded(work: WorkState, e: DeliverySucceeded): Transition {
  const op = work.operation
  if (op?.kind !== 'deliver') return unchanged(work, '진행 중인 전달이 없음')
  const task = work.tasks.find((t) => t.id === op.task_id)
  if (!task) return unchanged(work, `${op.task_id} 없음`)
  const effects: Effect[] = []
  let tasks = work.tasks
  if (task.status !== 'approved') {
    const check = e.check ? summarize(e.check) : task.check
    const approved: TaskRecord = {
      ...task,
      status: 'approved',
      approved_at: e.at,
      approved_by: 'human',
      check,
      ...(task.session?.alive
        ? { session: { ...task.session, alive: false, ended_at: e.at } }
        : {}),
    }
    tasks = work.tasks.map((t) => (t.id === task.id ? approved : t))
    effects.push(log(work, e.at, 'task.approved', { by: 'human' }, task))
    if (task.session?.alive) effects.push({ type: 'endSession', taskId: task.id })
    effects.push({
      type: 'appendDecisions',
      taskId: task.id,
      node: task.node,
      at: e.at,
      by: 'human',
      decisions: e.check?.handoffHeader ? e.check.handoffHeader.decisions : null,
    })
  }
  const delivery: DeliveryRecord = {
    choice: op.choice,
    status: 'succeeded',
    at: e.at,
    branch: op.branch,
    compare_url: e.compareUrl,
    ...(e.prUrl === undefined ? {} : { pr_url: e.prUrl }),
    ...(e.prExisting ? { pr_existing: true } : {}),
    ...(e.draft === undefined ? {} : { draft: e.draft }),
    ...deliveryBackups(work.delivery, op),
  }
  const rest = omit(work, 'operation', 'stop', 'stop_after_step')
  const payload: Record<string, unknown> = { ...delivery }
  delete payload['status']
  delete payload['at']
  if (op.choice === 'pr' && e.pr && e.prUrl) {
    // [PR 생성]이 성공하면 완료 대신 PR 진행이다 (D120, D152). 완료는 머지나 [머지 없이 끝내기]에서 남긴다
    const next: WorkState = {
      ...rest,
      tasks,
      status: 'pr',
      delivery,
      pr: {
        number: e.pr.number,
        url: e.prUrl,
        head: e.pr.head,
        gh_version: e.pr.ghVersion,
        started_at: e.at,
      },
    }
    effects.push(log(next, e.at, 'delivery.succeeded', payload))
    return { work: next, effects }
  }
  const next: WorkState = {
    ...rest,
    tasks,
    status: 'completed',
    completed_at: e.at,
    delivery,
  }
  effects.push(log(next, e.at, 'delivery.succeeded', payload))
  effects.push(log(next, e.at, 'work.completed', { delivery: op.choice }))
  return { work: next, effects }
}

/**
 * 전달이 실패했다 (7-6). Work는 완료하지 않는다: verify는 승인 대기로 남고(멈춘 Work는 멈춘 채),
 * Work 완료 화면이 오류와 [다시 시도]·[전달 없이 완료]를 보인다(D120). 진행 중 작업 기록은 지운다.
 * 이번 시도가 만든 stash나 커밋은 실패한 결과에 남겨, 다음 시도나 [전달 없이 완료] 뒤에도 이어진다 (7-5).
 */
function deliveryFailed(work: WorkState, e: DeliveryFailed): Transition {
  const op = work.operation
  if (op?.kind !== 'deliver') return unchanged(work)
  const backups = deliveryBackups(work.delivery, op)
  const delivery: DeliveryRecord = {
    choice: op.choice,
    status: 'failed',
    at: e.at,
    stage: op.stage,
    error: e.error,
    branch: op.branch,
    ...backups,
  }
  return {
    work: { ...omit(work, 'operation'), delivery },
    effects: [
      log(work, e.at, 'delivery.failed', {
        choice: op.choice,
        stage: op.stage,
        error: e.error,
        ...backups,
      }),
    ],
  }
}

// ---------- 정리 (시나리오 8) ----------

/**
 * [Work 정리]의 [정리] (8-2). 완료나 포기한 Work만 정리한다. 진행 중 작업을 기록하고(D77) git 작업을
 * main에 맡긴다. 지울 브랜치와 --force는 core/cleanup이 사람의 확인과 선택으로 정한 것이다.
 */
function clean(work: WorkState, e: Clean): Transition {
  if (!canClean(work)) return unchanged(work, '정리할 수 있는 Work가 아님')
  const operation: CleanOperation = {
    kind: 'clean',
    stage: 'worktree',
    started_at: e.at,
    force: e.force,
    delete_branches: [...e.deleteBranches],
    ...(e.deleteRemote ? { delete_remote: e.deleteRemote } : {}),
    head: e.head,
  }
  return {
    work: { ...work, operation },
    effects: [
      {
        type: 'clean',
        force: e.force,
        deleteBranches: [...e.deleteBranches],
        ...(e.deleteRemote ? { deleteRemote: e.deleteRemote } : {}),
      },
    ],
  }
}

/** 정리가 worktree를 지웠다. 기록을 브랜치 지우기 단계로 옮긴다 (D77) */
function cleanRemoved(work: WorkState): Transition {
  const op = work.operation
  if (op?.kind !== 'clean' || op.stage !== 'worktree') return unchanged(work)
  return { work: { ...work, operation: { ...op, stage: 'branches' } }, effects: [] }
}

/** 정리가 로컬 브랜치를 지웠다. origin의 브랜치를 지울 것이 있으면 기록을 그 단계로 옮긴다 (D77, D178) */
function cleanBranchesDeleted(work: WorkState): Transition {
  const op = work.operation
  if (op?.kind !== 'clean' || op.stage !== 'branches' || !op.delete_remote) return unchanged(work)
  return { work: { ...work, operation: { ...op, stage: 'remote' } }, effects: [] }
}

/** 정리가 끝났다: 보관됨으로 바꾸고 work.cleaned를 남긴다. 산출물(works/<work-id>/)은 그대로다 (8-2) */
function cleanDone(work: WorkState, e: CleanDone): Transition {
  const op = work.operation
  if (op?.kind !== 'clean') return unchanged(work, '진행 중인 정리가 없음')
  const next: WorkState = {
    ...omit(work, 'operation'),
    status: 'archived',
    cleaned: {
      at: e.at,
      head: op.head,
      forced: op.force,
      deleted_branches: op.delete_branches,
      ...(op.delete_remote ? { deleted_remote_branch: op.delete_remote } : {}),
    },
  }
  return {
    work: next,
    effects: [
      log(next, e.at, 'work.cleaned', {
        forced: op.force,
        deleted_branches: op.delete_branches,
        ...(op.delete_remote ? { deleted_remote_branch: op.delete_remote } : {}),
      }),
    ],
  }
}

/** 정리의 git 작업이 실패했다. 기록만 지운다. 오류는 main이 알린다 */
function cleanFailed(work: WorkState): Transition {
  return work.operation?.kind === 'clean'
    ? { work: omit(work, 'operation'), effects: [] }
    : unchanged(work)
}

/**
 * 재시작 조정 (시나리오 9, D75, D78). 재시작 뒤에는 살아 있는 세션이 없다.
 * - "실행 중"이던 task(세션이 살아 있었거나 띄우는 중이었음)는 중단됨이다. 유효한 handoff가 있으면
 *   승인 대기나 막힘이다. 앱이 꺼진 동안 받지 못한 Stop을 이렇게 보충한다. 자동 재개와 자동 승인은 없다.
 * - 대기열의 task는 대기열을 비우고 중단됨으로 둔다.
 * - 남아 있는 진행 중 작업 기록은 끊긴 작업으로 표시한다(시나리오 9-4, D121). 알리고 [다시 시도]·[무시]만 받는다.
 * - 정리 세션은 재시작 뒤에 남지 않는다: 적어 둔 프로세스를 지운다 (main이 먼저 확인해 끝냈다, D126).
 * - main이 끝낸 고아 프로세스(D76)는 그 task의 조정 이벤트에 killed_pid로 남긴다.
 * - 남은 자동 승인 카운트다운은 지운다. 카운트다운 중이었거나 이 조정으로 승인 대기가 된 task는 자동 승인이 켜진
 *   단계라도 사람이 승인한다 (D75, D127). 다음 Stop에서 다시 판정한다 (D131).
 */
function restarted(work: WorkState, e: AppRestarted, config: AppConfig): Transition {
  const current = currentTask(work)
  const effects: Effect[] = []
  const killed = (t: TaskRecord) => {
    const k = e.killed?.find((x) => x.taskId === t.id)
    return k ? { killed_pid: k.pid } : {}
  }
  /** 재시작 조정으로 승인 대기가 됐거나 카운트다운이 끊긴 task: 자동 승인하지 않은 까닭을 적는다 (D75) */
  const restartHold = (before: TaskRecord, after: TaskRecord): TaskRecord => {
    const auto = approvalMode(config, work.settings, after.node, knownTaskEngine(after)) === 'auto'
    const via = before.countdown !== undefined || before.status !== 'awaiting_approval'
    const next = omit(after, 'countdown')
    return after.status === 'awaiting_approval' && auto && via
      ? held(next, e.at, ['restart'])
      : next
  }
  const tasks = work.tasks.map((t): TaskRecord => {
    // 앱이 세션을 끝내지 못하고 꺼졌다 (D219)
    const session = t.session?.alive
      ? { ...t.session, alive: false, ended_at: e.at, app_ended: 'restart' as const }
      : t.session
    // 도는 PR 대응 task도 다른 task처럼 조정한다 (시나리오 9-7)
    if (t !== current || !taskActive(work, t)) return { ...t, session }
    if (t.status === 'queued') {
      // 대기열을 비운다 (D78). 세션 없이 남는 표시는 3.3을 따른다(보통 중단됨)
      const status = withoutSession(e.check)
      effects.push(
        status === 'interrupted'
          ? log(work, e.at, 'task.interrupted', { reason: 'app_restart', queued: true }, t)
          : log(work, e.at, 'task.awaiting_approval', { reason: 'app_restart' }, t),
      )
      return restartHold(t, { ...unqueued(t), status })
    }
    const running = t.session?.alive === true || (t.status === 'working' && !t.session?.alive)
    if (!running) return { ...t, session }
    const check = e.check ? summarize(e.check) : null
    const status = check ? handoffStatus(check) : null
    if (status) {
      if (status === 'awaiting_approval' && t.status !== 'awaiting_approval') {
        effects.push(
          log(work, e.at, 'task.awaiting_approval', { reason: 'app_restart', ...killed(t) }, t),
        )
      }
      return restartHold(t, { ...t, session, status, check: check ?? t.check })
    }
    effects.push(log(work, e.at, 'task.interrupted', { reason: 'app_restart', ...killed(t) }, t))
    return { ...t, session, status: 'interrupted', ...(check ? { check } : {}) }
  })
  const op = work.operation
  const cut = op !== undefined && op.interrupted_at === undefined
  const changed =
    cut ||
    work.cleanup_process !== undefined ||
    tasks.some((t, i) => JSON.stringify(t) !== JSON.stringify(work.tasks[i]))
  if (!changed) return unchanged(work)
  let next: WorkState = omit({ ...work, tasks }, 'cleanup_process')
  if (op && cut) next = { ...next, operation: { ...op, interrupted_at: e.at } }
  return { work: next, effects }
}

// ---------- 끊긴 작업 (시나리오 9-4, D121~D123) ----------

/**
 * 끊긴 작업의 [다시 시도] (D123). 끊긴 곳부터 잇는다: 되감기와 정리는 끊긴 표시를 지우고 main에 맡긴다(다시 진행
 * 중인 작업이 된다. 또 끊기면 다음 재시작 때 다시 끊긴 작업이다). 전달은 끊긴 시도를 실패로 남기고 기록을 지운다.
 * main이 이어서 같은 전달을 처음부터 한다.
 */
function operationRetry(work: WorkState, e: OperationRetry): Transition {
  const op = cutOperation(work)
  if (!op) return unchanged(work, '끊긴 작업이 없음')
  if (op.kind === 'deliver') return deliveryCut(work, op, e)
  if (op.kind === 'merge') {
    const live: MergeOperation = omit(op, 'interrupted_at')
    return {
      work: { ...work, operation: live },
      effects: [{ type: 'merge', method: live.method, head: live.head, resume: true }],
    }
  }
  if (op.kind === 'respond') {
    const live: RespondOperation = omit(op, 'interrupted_at')
    return {
      work: { ...work, operation: live },
      effects: [{ type: 'respond', taskId: live.task_id, rounds: [...live.rounds], resume: true }],
    }
  }
  if (op.kind === 'rewind') {
    const live: RewindOperation = omit(op, 'interrupted_at')
    return {
      work: { ...work, operation: live },
      effects: [{ type: 'resumeRewind', operation: live, message: backupMessage(work.work_id) }],
    }
  }
  const live: CleanOperation = omit(op, 'interrupted_at')
  return {
    work: { ...work, operation: live },
    effects: [
      {
        type: 'clean',
        force: live.force,
        deleteBranches: [...live.delete_branches],
        ...(live.delete_remote ? { deleteRemote: live.delete_remote } : {}),
        resume: live.stage,
      },
    ],
  }
}

/** 끊긴 작업의 [무시] (D123). 기록만 지우고 git은 건드리지 않는다. 전달은 끊긴 시도를 실패로 남긴다 */
function operationIgnore(work: WorkState, e: OperationIgnore): Transition {
  const op = cutOperation(work)
  if (!op) return unchanged(work, '끊긴 작업이 없음')
  if (op.kind === 'deliver') return deliveryCut(work, op, e)
  // 끊긴 PR 대응의 push와 게시는 실패로 남긴다: 대응 task의 승인 화면이 오류와 [다시 시도]를 보인다
  if (op.kind === 'respond') return respondFailure(work, op, e.at, CUT_ERROR)
  return { work: omit(work, 'operation'), effects: [] }
}

/**
 * 끊긴 전달을 실패로 남긴다 (D123): 끊긴 단계와 오류, 끊긴 시도가 만든 stash와 커밋(기록한 것과 main이 찾은 것)을
 * 전달 결과에 남기고 기록을 지운다. verify는 승인 대기로 남고(멈춘 Work는 멈춘 채), Work 완료 화면이 M5의 실패처럼
 * [다시 시도]·[전달 없이 완료]를 보인다 (D120).
 */
function deliveryCut(
  work: WorkState,
  op: DeliverOperation,
  e: OperationRetry | OperationIgnore,
): Transition {
  const backups = deliveryBackups(work.delivery, op, e.found)
  const delivery: DeliveryRecord = {
    choice: op.choice,
    status: 'failed',
    at: e.at,
    stage: op.stage,
    error: CUT_ERROR,
    branch: op.branch,
    ...backups,
  }
  return {
    work: { ...omit(work, 'operation'), delivery },
    effects: [
      log(work, e.at, 'delivery.failed', {
        choice: op.choice,
        stage: op.stage,
        error: CUT_ERROR,
        reason: 'app_restart',
        ...backups,
      }),
    ],
  }
}

// ---------- 정리 세션의 프로세스 (D126), 앱 소유 파일의 해시 (D124) ----------

/** 정리 세션을 띄웠다. 살아 있는 동안 프로세스를 적어 재시작 때 확인한다 (D126) */
function cleanupStarted(work: WorkState, e: CleanupStarted): Transition {
  return {
    work: {
      ...work,
      cleanup_process: {
        pid: e.pid,
        ...(e.processStartedAt === undefined ? {} : { process_started_at: e.processStartedAt }),
        started_at: e.at,
      },
    },
    effects: [],
  }
}

/** 정리 세션이 끝났다. 적어 둔 프로세스를 지운다 (D126) */
function cleanupEnded(work: WorkState): Transition {
  return work.cleanup_process
    ? { work: omit(work, 'cleanup_process'), effects: [] }
    : unchanged(work)
}

/** 앱 소유 파일의 해시를 적는다 (D124). null이면 파일이 없어 지운다. 키는 OWNED_FILES의 차례다 */
function filesRecorded(work: WorkState, e: FilesRecorded): Transition {
  const prior = work.file_hashes ?? {}
  const next: OwnedFileHashes = {}
  for (const file of OWNED_FILES) {
    const hash = file in e.hashes ? e.hashes[file] : prior[file]
    if (hash) next[file] = hash
  }
  if (work.file_hashes && JSON.stringify(next) === JSON.stringify(work.file_hashes)) {
    return unchanged(work)
  }
  return { work: { ...work, file_hashes: next }, effects: [] }
}

// ---------- PR 진행 (시나리오 10, D152~D200) ----------

/**
 * PR을 읽었다 (시나리오 10-2). 읽은 head와 때를 적고(D191), 받은 항목과 fast-forward로 받은 커밋을 events.jsonl에
 * 남긴다(5.5). 받은 커밋에 기준 브랜치 병합이 있으면 기준 커밋을 옮긴다(D181, D193). MERGED면 [머지]를 누른 것과
 * 같게 완료(머지됨)한다(D179). CLOSED면 닫힘을 적고 자동 읽기를 멈추며, 다시 열린 것을 읽으면 지운다(D179).
 * 진행 중 작업 기록이 있는 동안은 받지 않는다(I51): 끊긴 머지는 [다시 시도]·[무시]가 먼저다
 */
function prRead(work: WorkState, e: PrRead): Transition {
  const pr = work.pr
  if (work.status !== 'pr' || !pr || pr.number !== e.number || work.operation) {
    return unchanged(work)
  }
  const effects: Effect[] = []
  let next: WorkState = { ...work, pr: { ...pr, head: e.head, read_at: e.at } }
  const synced = e.synced
  if (synced && synced.commits.length) {
    if (synced.baseCommit) next = { ...next, base_commit: synced.baseCommit }
    effects.push(
      log(next, e.at, 'pr.synced', {
        commits: [...synced.commits],
        ...(synced.baseCommit ? { base_commit: synced.baseCommit } : {}),
      }),
    )
  }
  if (e.received.length || e.notAccepted.length) {
    effects.push(
      log(next, e.at, 'pr.items_received', {
        items: [...e.received],
        ...(e.notAccepted.length ? { not_accepted: [...e.notAccepted] } : {}),
      }),
    )
  }
  const now = next.pr ?? pr
  if (e.state === 'MERGED') {
    const merged: PrMerged = { at: e.at, head: e.head, method: null, outside: true }
    // 밖에서 머지됐으면 도는 PR 대응 task의 세션을 끝낸다: [머지]는 대응 task가 없을 때만 누른다 (D176, D179)
    const task = currentTask(next)
    const ended = task && isRespondPending(task) ? endTask(next, task, e.at, 'pr_merged') : null
    if (ended) {
      next = withTask(next, ended.task)
      effects.push(...ended.effects)
    }
    next = {
      ...next,
      status: 'completed',
      completed_at: e.at,
      pr: { ...omit(now, 'closed_at'), merged },
    }
    // 승인했지만 push와 답글 게시를 미룬 라운드(D193)는 머지에 들어가지 않았다. 사람이 알 수 있게 남긴다
    // (알림은 main이, 완료 화면은 PR 패널의 라운드로 보인다)
    const deferred = deferredRounds(next).map((t) => t.id)
    effects.push(
      log(next, e.at, 'pr.merged', {
        head: e.head,
        outside: true,
        ...(deferred.length ? { deferred } : {}),
      }),
    )
    effects.push(log(next, e.at, 'work.completed', { delivery: 'pr', merged: true }))
  } else if (e.state === 'CLOSED') {
    if (!pr.closed_at) {
      next = { ...next, pr: { ...now, closed_at: e.at } }
      // 카운트다운 중인 대응 task는 멈춘다: 닫힌 PR은 승인을 받지 않는다 (D179). 알림은 닫힘을 읽은 알림이 한다
      const task = currentTask(next)
      if (task?.node === RESPOND && task.countdown) {
        next = withTask(next, held(task, e.at, ['pr_closed']))
      }
      effects.push(log(next, e.at, 'pr.closed'))
    }
  } else if (pr.closed_at) {
    next = { ...next, pr: omit(now, 'closed_at') }
    effects.push(log(next, e.at, 'pr.reopened'))
  }
  return { work: next, effects }
}

/**
 * 머지 창의 [머지] (D176). 머지 창에 보인 head가 앱이 마지막으로 읽은 head와 같고 머지 조건을 만족할 때만 받는다.
 * 진행 중 작업을 기록하고(D77) 머지를 main에 맡긴다. 그사이 GitHub에 새 커밋이 생겼으면 GitHub가 거절한다
 * (--match-head-commit, S7)
 */
function prMerge(work: WorkState, e: PrMerge): Transition {
  const pr = work.pr
  if (work.status !== 'pr' || !pr) return unchanged(work, 'PR 진행인 Work가 아님')
  if (work.operation) return unchanged(work, '진행 중인 작업이 있음')
  if (e.head !== pr.head) {
    return unchanged(work, '머지 창을 연 뒤 PR의 새 head를 읽었음. 머지 창을 다시 여세요')
  }
  if (!e.gate.enabled) return unchanged(work, `머지할 수 없음: ${e.gate.reasons.join(', ')}`)
  const operation: MergeOperation = {
    kind: 'merge',
    started_at: e.at,
    method: e.method,
    head: e.head,
  }
  return {
    work: { ...work, operation },
    effects: [{ type: 'merge', method: e.method, head: e.head }],
  }
}

/** 머지가 끝났다 (D178): 완료(머지됨)로 바꾸고 기록을 지운다. 정리 창은 화면이 연다 */
function prMerged(work: WorkState, e: PrMergeSucceeded): Transition {
  const op = work.operation
  const pr = work.pr
  if (op?.kind !== 'merge' || !pr) return unchanged(work, '진행 중인 머지가 없음')
  const merged: PrMerged = { at: e.at, head: op.head, method: op.method, outside: false }
  const next: WorkState = {
    ...omit(work, 'operation'),
    status: 'completed',
    completed_at: e.at,
    pr: { ...omit(pr, 'closed_at'), head: op.head, merged },
  }
  return {
    work: next,
    effects: [
      log(next, e.at, 'pr.merged', { method: op.method, head: op.head, outside: false }),
      log(next, e.at, 'work.completed', { delivery: 'pr', merged: true }),
    ],
  }
}

/**
 * 머지가 실패했다. 기록만 지우고 PR 진행에 남는다. 머지 요청은 성공했지만 결과를 읽지 못했으면 실패가 아니다(D330):
 * 기록을 끊긴 작업으로 남겨 [다시 시도]가 다시 읽어 확인하게 한다
 */
function prMergeFailed(work: WorkState, e: PrMergeFailed): Transition {
  const op = work.operation
  if (op?.kind !== 'merge') return unchanged(work)
  if (e.unconfirmed) {
    return {
      work: { ...work, operation: { ...op, unconfirmed: true, interrupted_at: e.at } },
      effects: [log(work, e.at, 'pr.merge_unconfirmed', { method: op.method, head: op.head })],
    }
  }
  return { work: omit(work, 'operation'), effects: [] }
}

/** [머지 없이 끝내기] (D179): 완료(머지 없이)로 바꾼다. GitHub의 PR은 건드리지 않는다 */
function prEnd(work: WorkState, e: PrEnd): Transition {
  const pr = work.pr
  if (work.status !== 'pr' || !pr) return unchanged(work, 'PR 진행인 Work가 아님')
  const task = currentTask(work)
  if (task && isRespondPending(task) && (task.session?.alive || task.status === 'queued')) {
    return unchanged(work, 'PR 대응 task가 돌고 있음: 먼저 [즉시 중단]하세요')
  }
  const next: WorkState = {
    ...work,
    status: 'completed',
    completed_at: e.at,
    pr: { ...pr, ended_at: e.at },
  }
  return {
    work: next,
    effects: [log(next, e.at, 'work.completed', { delivery: 'pr', merged: false })],
  }
}

/** 머지 뒤 정리 창을 열었다 (D178, D200) */
function prCleanOffered(work: WorkState, e: PrCleanOffered): Transition {
  const pr = work.pr
  if (!pr?.merged || pr.clean_offered_at) return unchanged(work)
  return { work: { ...work, pr: { ...pr, clean_offered_at: e.at } }, effects: [] }
}

// ---------- PR 대응 (시나리오 10-3~10-7, D168~D207) ----------

/**
 * PR 패널의 [대응 시작] (시나리오 10-3, D170, D182). core/respond의 판정을 따른다: PR 진행이고, 진행 중 작업이 없고, PR이
 * 닫히지 않았고, 끝나지 않은 대응 task가 없다. 새 라운드의 대응 task(파이프라인 밖, D188)를 만들어 새 세션으로
 * 시작한다(세션 상한과 대기열, D18). 시작하기 전에 main이 원격만 앞선 PR 브랜치를 받았으면 받은 커밋과 옮긴 기준 커밋을
 * 남기고(D181, D193) 읽은 head를 받은 원격 head로 둔다
 */
function prRespond(work: WorkState, e: PrRespond, config: AppConfig): Transition {
  const why = respondBlocked(work)
  if (why) return unchanged(work, why)
  const pr = work.pr
  if (!pr) return unchanged(work, 'PR 진행인 Work가 아님')
  const instruction = e.instruction.trim() || null
  if (!e.items.length && !instruction) {
    return unchanged(work, '대응할 새 항목이 없음. 지시를 적으면 지시만으로 시작함 (D182)')
  }
  if (e.auto) {
    if (!autoStartOn(config, work.settings)) return unchanged(work, '대응 자동 시작이 꺼져 있음')
    if (autoRounds(work) >= config.respond_auto_round_max) return unchanged(work, AUTO_LIMIT)
  }
  const effects: Effect[] = []
  let next = work
  const synced = e.synced
  if (synced?.commits.length) {
    next = {
      ...next,
      pr: { ...pr, head: synced.head },
      ...(synced.baseCommit ? { base_commit: synced.baseCommit } : {}),
    }
    effects.push(
      log(next, e.at, 'pr.synced', {
        commits: [...synced.commits],
        ...(synced.baseCommit ? { base_commit: synced.baseCommit } : {}),
      }),
    )
  }
  // 자동 시작은 사람 손 없이 이어진 라운드를 하나 더 세고, 사람의 [대응 시작]은 다시 센다 (D171)
  next = withRounds(next, e.auto ? autoRounds(work) + 1 : 0)
  const respond: RespondRound = { round: nextRound(work), items: [...e.items], instruction }
  const reason = e.auto ? 'auto_respond' : 'respond'
  const created: TaskRecord = { ...newTask(next, RESPOND, e.at, reason), respond }
  next = { ...next, tasks: [...next.tasks, created] }
  effects.push({
    type: 'startTask',
    taskId: created.id,
    node: created.node,
    reason: created.reason,
  })
  return { work: next, effects }
}

/**
 * 사람 손 없이 이어진 대응 라운드 수를 바꾼다 (D171, D191). 기록이 없고 0이면 적지 않는다(M11 전의 Work를 건드리지 않음)
 */
function withRounds(work: WorkState, rounds: number): WorkState {
  const pr = work.pr
  if (!pr || (pr.auto_rounds ?? 0) === rounds) return work
  return { ...work, pr: { ...pr, auto_rounds: rounds } }
}

/**
 * 자동 대응이 상한에 닿아 시작하지 않았다 (D171, D184): pr.auto_paused를 남긴다(5.5). 멈춘 상태는 따로 적지 않는다: 배지와
 * 패널은 대응 자동 시작, 라운드 수와 상한, 받은 새 항목으로 정한다(core/respond autoPlan). 사람이 [대응 시작]이나 승인을
 * 누르면 다시 센다
 */
function prAutoPaused(work: WorkState, e: PrAutoPaused, config: AppConfig): Transition {
  if (work.status !== 'pr' || !work.pr) return unchanged(work)
  return {
    work,
    effects: [
      log(work, e.at, 'pr.auto_paused', {
        reason: 'round_limit',
        rounds: autoRounds(work),
        max: config.respond_auto_round_max,
        items: [...e.items],
      }),
    ],
  }
}

/**
 * PR 대응 task의 [승인] (시나리오 10-5, 10-6, D169, D172). 판정은 다른 승인과 같고, replies.md의 오류는 넘길 수 없다(D204).
 * 세션을 끝내고 진행 중 작업을 기록한 뒤(D77) push와 답글 게시를 main에 맡긴다. 승인은 push와 게시가 끝나거나 push를
 * 미룬 뒤에 기록한다(D120과 같은 방식). push를 미룬 앞 라운드(D193)가 있으면 함께 push하고 그 답글도 게시한다.
 * 앞 승인의 실패 기록은 지운다: 다시 누른 [승인]은 [다시 시도]다
 */
function respondApprove(work: WorkState, task: TaskRecord, e: Approve): Transition {
  const pr = work.pr
  if (work.status !== 'pr' || !pr) return unchanged(work, 'PR 진행인 Work가 아님')
  // 닫힌 PR에는 push하지도 답글을 게시하지도 않는다: 대응을 멈춘 채 둔다 (D179)
  if (pr.closed_at) return unchanged(work, PR_CLOSED)
  if (!REVIEWABLE.includes(task.status) || !task.respond) {
    return unchanged(work, `${task.id}는 승인할 수 있는 상태가 아님`)
  }
  const check = summarize(e.check)
  const gate = approvalGate(task, check)
  const forced = !gate.approve && e.force === true && gate.force
  if (!gate.approve && !forced) {
    const reason = e.force
      ? `${task.id}: 오류를 무시하고 승인할 수 없음`
      : `${task.id}의 handoff가 유효하지 않음`
    return { work: withTask(work, { ...task, check }), effects: [], rejected: reason }
  }
  return respondApproveNow(work, task, {
    at: e.at,
    check,
    by: 'human',
    ...(forced ? { ignored: gate.errors } : {}),
  })
}

/**
 * 대응 task의 승인을 받는다 (D169, D172): 사람의 [승인]과 자동 승인(4.3)이 같이 쓴다. 세션을 끝내고 진행 중 작업을 적은 뒤
 * push와 답글 게시를 main에 맡긴다. 승인 방식은 진행 중 작업에 두었다가 승인을 기록할 때 남긴다. 사람이 누른 승인은 사람
 * 손 없이 이어진 라운드를 다시 센다 (D171)
 */
function respondApproveNow(
  work: WorkState,
  task: TaskRecord,
  a: { at: string; check: CheckSummary; by: ApprovalBy; ignored?: FormatIssue[] },
): Transition {
  const pr = work.pr
  if (!pr || !task.respond) return unchanged(work, `${task.id}는 승인할 수 있는 상태가 아님`)
  const waiting: TaskRecord = {
    ...omit(task, 'countdown', 'auto_hold'),
    status: 'awaiting_approval',
    check: a.check,
    respond: omit(task.respond, 'failure'),
    ...(task.session?.alive ? { session: { ...task.session, alive: false, ended_at: a.at } } : {}),
  }
  const effects: Effect[] = []
  if (task.status !== 'awaiting_approval') {
    effects.push(log(work, a.at, 'task.awaiting_approval', {}, task))
  }
  if (task.session?.alive) effects.push({ type: 'endSession', taskId: task.id })
  const operation: RespondOperation = {
    kind: 'respond',
    stage: 'push',
    started_at: a.at,
    task_id: task.id,
    rounds: [...deferredRounds(work).map((t) => t.id), task.id],
    from: pr.head,
    ...(a.ignored ? { ignored: a.ignored } : {}),
    ...(a.by === 'auto' ? { by: 'auto' as const } : {}),
  }
  effects.push({ type: 'respond', taskId: task.id, rounds: [...operation.rounds] })
  const counted = a.by === 'human' ? withRounds(work, 0) : work
  return { work: { ...withTask(counted, waiting), operation }, effects }
}

/** PR 대응의 push가 끝났다: 기록을 답글 게시 단계로 옮기고 push한 커밋을 남긴다 (D77, 5.5 pr.pushed) */
function respondPushed(work: WorkState, e: RespondPushed): Transition {
  const op = work.operation
  if (op?.kind !== 'respond' || op.stage !== 'push') return unchanged(work)
  const task = work.tasks.find((t) => t.id === op.task_id)
  const effects: Effect[] = e.commits.length
    ? [log(work, e.at, 'pr.pushed', { head: e.head, commits: [...e.commits] }, task)]
    : []
  return { work: { ...work, operation: { ...op, stage: 'reply' } }, effects }
}

/**
 * 대응 task의 승인을 기록한다 (4-4의 기록, D120과 같은 방식): 승인됨, decisions.md, task.approved. check는 main이 다시 한
 * 검사이고, 읽지 못했으면 승인할 때의 검사를 남긴다. 세션은 승인할 때 끝냈다
 */
function recordRespondApproval(
  work: WorkState,
  task: TaskRecord,
  op: RespondOperation,
  at: string,
  check: TaskCheck | null,
): { task: TaskRecord; effects: Effect[] } {
  // 승인 방식은 승인할 때 진행 중 작업에 적었다. M11 전의 기록은 사람 승인이다 (D169)
  const by: ApprovalBy = op.by ?? 'human'
  const approved: TaskRecord = {
    ...task,
    status: 'approved',
    approved_at: at,
    approved_by: by,
    check: check ? summarize(check) : task.check,
    ...(op.ignored ? { ignored_errors: op.ignored } : {}),
  }
  const payload = op.ignored ? { by, ignored_errors: op.ignored.length } : { by }
  return {
    task: approved,
    effects: [
      log(work, at, 'task.approved', payload, task),
      {
        type: 'appendDecisions',
        taskId: task.id,
        node: task.node,
        at,
        by,
        decisions: check?.handoffHeader ? check.handoffHeader.decisions : null,
      },
    ],
  }
}

/**
 * PR 대응의 push와 답글 게시가 끝났다 (시나리오 10-6). 승인을 기록하고, 이번에 게시한 라운드(미룬 앞 라운드 포함)에 게시한
 * 때를 적어 그 항목을 처리됨으로 하고(D189, 항목의 상태는 main이 pr-items.json에 쓴다), 기준 브랜치를 병합한 라운드면
 * 기준 커밋을 옮기고(D181), 게시한 답글을 남긴다(5.5 pr.replied). 진행 중 작업 기록은 같이 지운다. Work는 PR 진행에 남는다
 */
function respondPublished(work: WorkState, e: RespondPublished): Transition {
  const op = work.operation
  if (op?.kind !== 'respond') return unchanged(work, '진행 중인 PR 대응 게시가 없음')
  const task = work.tasks.find((t) => t.id === op.task_id)
  if (!task) return unchanged(work, `${op.task_id} 없음`)
  const approval = recordRespondApproval(work, task, op, e.at, e.check)
  let next = withTask(work, approval.task)
  next = {
    ...omit(next, 'operation'),
    tasks: next.tasks.map((t): TaskRecord =>
      op.rounds.includes(t.id) && t.respond
        ? { ...t, respond: { ...omit(t.respond, 'failure'), published_at: e.at } }
        : t,
    ),
    ...(e.baseCommit ? { base_commit: e.baseCommit } : {}),
  }
  const effects = [...approval.effects]
  const posted = e.replies.filter((r) => r.commentId !== undefined)
  const skipped = e.replies.filter((r) => r.skipped !== undefined)
  if (posted.length || skipped.length) {
    effects.push(
      log(
        next,
        e.at,
        'pr.replied',
        {
          replies: posted.map((r) => ({ item: r.item, comment_id: r.commentId })),
          ...(skipped.length ? { skipped: skipped.map((r) => r.item) } : {}),
        },
        task,
      ),
    )
  }
  return { work: next, effects }
}

/**
 * push가 원격 PR 브랜치의 새 커밋 때문에 거절됐다 (D193). 이 라운드는 승인된 채 push와 답글 게시를 미룬다: 승인을 기록하고
 * 미룬 때를 적고, 진행 중 작업 기록을 지운다. 함께 push하려던 앞 라운드는 미룬 채로 남는다. 갈라짐 항목은 main이 곧 읽어
 * 만들고, 다음 라운드가 원격을 병합한 뒤 함께 push하고 이 라운드의 답글도 게시한다
 */
function respondDeferred(work: WorkState, e: RespondDeferred): Transition {
  const op = work.operation
  if (op?.kind !== 'respond') return unchanged(work, '진행 중인 PR 대응 게시가 없음')
  const task = work.tasks.find((t) => t.id === op.task_id)
  if (!task?.respond) return unchanged(work, `${op.task_id} 없음`)
  const approval = recordRespondApproval(work, task, op, e.at, e.check)
  const deferred: TaskRecord = {
    ...approval.task,
    respond: { ...omit(task.respond, 'failure'), deferred_at: e.at },
  }
  return { work: omit(withTask(work, deferred), 'operation'), effects: approval.effects }
}

/**
 * push나 답글 게시가 실패했다 (시나리오 10-6, D120과 같은 방식). 끊긴 곳과 오류를 대응 task에 적고 진행 중 작업 기록을
 * 지운다. 대응 task는 승인 대기로 남고 승인 화면이 오류와 [다시 시도]를 보인다. 게시한 답글과 push한 커밋은 main이
 * pr-items.json에 적어 두었다
 */
function respondFailed(work: WorkState, e: RespondFailed): Transition {
  const op = work.operation
  if (op?.kind !== 'respond') return unchanged(work)
  return respondFailure(work, op, e.at, e.error)
}

function respondFailure(
  work: WorkState,
  op: RespondOperation,
  at: string,
  error: string,
): Transition {
  const task = work.tasks.find((t) => t.id === op.task_id)
  const next = task?.respond
    ? withTask(work, {
        ...task,
        respond: { ...task.respond, failure: { at, stage: op.stage, error } },
      })
    : work
  return { work: omit(next, 'operation'), effects: [] }
}

/** [실패한 체크 다시 실행] (D175, D203): main이 다시 실행한 Actions 실행과 체크를 남긴다(5.5 pr.checks_rerun) */
function prChecksRerun(work: WorkState, e: PrChecksRerun): Transition {
  if (work.status !== 'pr' || !work.pr) return unchanged(work, 'PR 진행인 Work가 아님')
  if (!e.runs.length) return unchanged(work)
  return {
    work,
    effects: [log(work, e.at, 'pr.checks_rerun', { runs: [...e.runs], checks: [...e.checks] })],
  }
}

// ---------- 이슈 기록 (설계 3.7, D336~D349, I97) ----------

/**
 * 전이가 남긴 이벤트로 이슈 기록의 대기열에 항목을 더하고 게시를 맡긴다 (I97). 더할 것이 없으면 그대로다. 항목은
 * core/issue issueEntries가 정한다
 */
function queueIssue(result: Transition): Transition {
  const issue = result.work.issue
  if (!issue) return result
  const events = result.effects.flatMap((e) => (e.type === 'log' ? [e.event] : []))
  const added = issueEntries(result.work, events)
  if (added.length === 0) return result
  return {
    ...result,
    work: { ...result.work, issue: { ...issue, pending: [...issue.pending, ...added] } },
    effects: [...result.effects, { type: 'publishIssue' }],
  }
}

type IssueMachineEvent = IssueAttempted | IssueCreated | IssuePosted | IssueClosed | IssueFailed

/**
 * 게시의 결과 (I98, D344, D349). 대기열 맨 앞의 키와 맞지 않는 늦은 결과는 무시한다. 게시하면 맨 앞을 빼서 게시한 것에
 * 적고 시도와 실패 기록을 지운다
 */
function issueEvent(work: WorkState, e: IssueMachineEvent): Transition {
  const issue = work.issue
  const head = issue?.pending[0]
  if (!issue || !head) return unchanged(work)
  const key = issueKey(head)
  const done = (
    patch: Partial<IssueRecord>,
    posted: IssueRecord['posted'][number],
  ): IssueRecord => ({
    ...omit(issue, 'attempted_at', 'failure'),
    ...patch,
    pending: issue.pending.slice(1),
    posted: [...issue.posted, posted],
  })
  switch (e.type) {
    case 'issue.attempted':
      if (e.key !== key) return unchanged(work)
      return { work: { ...work, issue: { ...issue, attempted_at: e.at } }, effects: [] }
    case 'issue.created': {
      if (head.kind !== 'issue') return unchanged(work)
      const next = { ...work, issue: done({ number: e.number, url: e.url }, { key, at: e.at }) }
      return {
        work: next,
        effects: [
          log(next, e.at, 'issue.created', {
            number: e.number,
            url: e.url,
            labeled: e.labeled,
            ...(e.found ? { found: true } : {}),
          }),
        ],
      }
    }
    case 'issue.posted': {
      if (e.key !== key || head.kind === 'issue' || head.kind === 'close') return unchanged(work)
      const url = issue.url ?? issueUrlOf(e.url)
      const next = {
        ...work,
        issue: done(
          { url },
          {
            key,
            at: e.at,
            ...(e.commentId !== null ? { comment_id: e.commentId } : {}),
            url: e.url,
          },
        ),
      }
      return {
        work: next,
        effects: [
          log(next, e.at, 'issue.posted', {
            key,
            comment_id: e.commentId,
            ...(e.found ? { found: true } : {}),
          }),
        ],
      }
    }
    case 'issue.closed': {
      if (head.kind !== 'close') return unchanged(work)
      const reason: IssueCloseReason = head.reason
      const next = { ...work, issue: done({ closed: { at: e.at, reason } }, { key, at: e.at }) }
      return { work: next, effects: [log(next, e.at, 'issue.closed', { reason })] }
    }
    case 'issue.failed': {
      if (e.key !== key) return unchanged(work)
      const next = { ...work, issue: { ...issue, failure: { at: e.at, key, error: e.error } } }
      return {
        work: next,
        effects: [
          log(next, e.at, 'issue.post_failed', {
            key,
            error: e.error,
            pending: issue.pending.length,
          }),
        ],
      }
    }
  }
}
