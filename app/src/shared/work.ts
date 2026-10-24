// work.json의 모양 (5.1). 상태의 기준이고, main이 전이마다 원자적으로 쓴다 (I11).
// core/machine만 이 값을 바꾼다. 파일에 쓰는 모양이라 키는 snake_case다.
import type { WorkSettings } from './config'
import type { AgentEngine } from './agent'
import type { HandoffStatus, NodeName, TaskNode } from './contracts'

/**
 * 업무 유형 (D232, D236, D258, D302, D350): 버그 수정(bugfix), 기능 추가·변경(feature, D429), 리팩터링(refactor), 설계(spec),
 * 일반(general), 커스텀(custom, D447). 사람이 새 Work 대화상자에서 고르고, 의도 승인 전까지만 바꿀 수 있다 (D237). 유형마다 파이프라인이
 * 다르다 (core/pipeline PIPELINES). 설계는 구현 전에 설계만 정하는 큰 일에 쓰고(D353), 일반은 다른 유형에 맞지 않는
 * 일에 쓴다 (D303). 커스텀은 사람이 정의한 유형이고 어느 유형인지는 work.json의 custom_type에 있다 (D462)
 */
export type WorkType = 'bugfix' | 'feature' | 'refactor' | 'spec' | 'general' | 'custom'

/** 기본 업무 유형: 커스텀이 아닌 유형 */
export type BuiltinWorkType = Exclude<WorkType, 'custom'>

/** 업무 유형의 화면 이름 (D236). 기능 추가는 동작을 바꾸거나 없애는 일도 맡아 "기능 추가·변경"이다 (D429) */
export const WORK_TYPE_LABEL: Readonly<Record<WorkType, string>> = {
  bugfix: '버그 수정',
  feature: '기능 추가·변경',
  refactor: '리팩터링',
  spec: '설계',
  general: '일반',
  custom: '커스텀',
}

/** 사이드바와 머리 띠에 보이는 짧은 유형 이름 (D256) */
export const WORK_TYPE_SHORT: Readonly<Record<WorkType, string>> = {
  bugfix: '버그',
  feature: '기능',
  refactor: '리팩터',
  spec: '설계',
  general: '일반',
  custom: '커스텀',
}

/** 고를 수 있는 기본 업무 유형. 새 Work 대화상자의 버튼 차례다 (D236, D353). 커스텀 유형은 그 뒤에 온다 (D460) */
export const WORK_TYPES: readonly BuiltinWorkType[] = [
  'bugfix',
  'feature',
  'refactor',
  'spec',
  'general',
]

/** 커스텀 단계 하나 (5.6.13, D449, D453, D457) */
export interface CustomStep {
  /** 단계 id. 영어 소문자·숫자·`-`. 절차 파일 `<id>.md`와 산출물 `<id>.md`, task 디렉터리의 이름이다 (D462) */
  id: string
  /** 화면 이름 */
  title: string
  /** 산출물의 절 제목. 비우면 기본 두 절이다 (D453) */
  sections: string[]
  /** 자동 승인 기본값 (D457) */
  auto_approve: boolean
}

/** 커스텀 유형의 정의 (type.json, D449) */
export interface CustomTypeDef {
  /** 폴더 이름 */
  id: string
  name: string
  description: string
  steps: CustomStep[]
}

/** 커스텀 유형의 출처 (D450): 전역(<RELAY_HOME>/types/) / 레포(.relay/types/) */
export type CustomTypeSource = 'global' | 'repo'

/** Work를 만들 때 복사한 커스텀 유형 (D458). 단계 목록도 여기 두어 core가 파일 없이 파이프라인을 안다 */
export interface WorkCustomType extends CustomTypeDef {
  source: CustomTypeSource
  /** 복사본(Work 디렉터리의 type/)의 해시 */
  hash: string
}

/** Work의 유형 화면 이름. 커스텀이면 그 유형의 이름이다 (D460) */
export function workTypeLabel(work: { type?: WorkType; custom_type?: { name: string } }): string {
  const type = work.type ?? 'bugfix'
  return type === 'custom' && work.custom_type ? work.custom_type.name : WORK_TYPE_LABEL[type]
}

/**
 * Work 상태 (3.3): 진행 중(active), 멈춤(stopped), PR 진행(pr: [PR 생성] 뒤 머지나 [머지 없이 끝내기]까지, D152),
 * 완료(completed), 포기(abandoned), 보관됨(archived: 완료나 포기 뒤 [Work 정리]를 마침, 시나리오 8).
 */
export type WorkStatus = 'active' | 'stopped' | 'pr' | 'completed' | 'abandoned' | 'archived'

/**
 * Task 상태 (3.3)와 실행 중 표시(시나리오 3)를 한 값으로 둔다.
 * - queued(대기열): 세션 상한 때문에 시작을 기다린다 (D18)
 * - 실행 중: working(작업 중), asking(질문 대기), input_needed(입력 필요), idle(대기).
 *   working이면서 세션이 살아 있지 않으면 세션을 띄우는 중이다
 * - awaiting_approval(승인 대기), blocked(막힘): 세션이 끝나도 남는다 (3.3)
 * - session_ended: handoff 없이 세션이 끝났다. 3.3의 "중단됨"에 들지만 배지가 따로 있다 (D80)
 * - interrupted: 중단됨. [즉시 중단], 앱 종료, 재시작 조정(D75, D78), task를 띄우지 못했을 때
 * - approved: 승인됨
 * - discarded: 폐기됨. D418 전의 되감기나 건너뛰기로 이후 입력에서 빠졌다. 파일과 기록은 남는다. 새로 생기지 않는다 (D424)
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
 * task를 시작한 이유 (시나리오 2-5의 머리 띠): 기본 진행, 대응 시작, 자동 대응. 대응 시작은 PR 패널의 [대응 시작]으로
 * 시작한 PR 대응 task이고 (시나리오 10-3), 자동 대응은 앱이 받은 새 항목으로 자동으로 시작한 PR 대응 task다 (D154, D210).
 * 되감기·건너뛰기(단계 선택)와 재개([이 단계 새 세션으로 다시], D114)는 D418 전에 만든 task에만 있다 (D424)
 */
export type StartReason = 'default' | 'rewind' | 'skip' | 'resume' | 'respond' | 'auto_respond'

/** D418 전에 단계 선택으로 들어온 task의 입력과 코드. 읽기만 한다: [변경]의 범위가 되돌린 코드를 본다 (D424) */
export interface StepSelection {
  /** 단계를 고른 때의 지금 task (6.2의 k) */
  from_task: string
  /** 사람 추가 지시. 없으면 null */
  instruction: string | null
  /** 이번에 폐기한 task. 되감기면 그 시도를 요약해 넣는다 */
  discarded: string[]
  /** 건너뛴 단계 */
  skipped: NodeName[]
  /** [현재 코드 위에서 이어서]를 골랐다 (6.2, D254) */
  keep_code: boolean
  /**
   * 단계 선택의 종류. [이 단계 새 세션으로 다시]로 이어받은 task만 둔다(그 task의 이유는 "재개"라 종류를 따로 적는다,
   * D327). 없으면 task의 이유(rewind, skip, 그 밖은 기본 진행)로 읽는다
   */
  kind?: 'rewind' | 'skip' | 'default'
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

/** 승인 방식 (5.4, 5.5): 사람 승인, 자동 승인 (4.3) */
export type ApprovalBy = 'human' | 'auto'

/**
 * 자동 승인 카운트다운 (4.3, D127). Stop으로 승인 대기가 될 때 조건을 만족하면 시작하고, 끝나면 그때의 설정과
 * 다시 읽은 handoff로 다시 판정해 자동 승인한다 (D128). 멈추면 지운다
 */
export interface Countdown {
  /** 시작한 때: Stop을 받은 때 */
  started_at: string
  /** 카운트다운 초. 시작할 때의 설정이다 (D128) */
  seconds: number
}

/**
 * 자동 승인이 켜진 단계에서 자동 승인하지 않은 까닭 (4.3, D128~D130, D75, D122).
 * 조건: open_questions, intent_deviation, background(Stop 때 백그라운드 작업이나 예약된 깨우기가 남음, D129),
 * invalid(다시 읽은 handoff가 유효하지 않음).
 * 멈춤: cancel([취소]), interrupt([즉시 중단]), quit(앱 종료 확인), session(세션 종료), settings(자동 승인을 끔),
 * restart(재시작 조정), operation(끊긴 작업), pr_closed(PR 대응인데 PR이 닫혀 승인을 받지 않음, D179).
 * recommended_next(기본 다음 단계가 아님)와 step([단계 선택], D145)은 D418 전 기록에만 있다 (D424)
 */
export type AutoHoldReason =
  | 'open_questions'
  | 'intent_deviation'
  | 'recommended_next'
  | 'background'
  | 'completion_unknown'
  | 'invalid'
  | 'cancel'
  | 'interrupt'
  | 'quit'
  | 'step'
  | 'session'
  | 'settings'
  | 'restart'
  | 'operation'
  | 'pr_closed'

/** 자동 승인하지 않은 때와 까닭. 다음 Stop에서 다시 판정한다 (D131) */
export interface AutoHold {
  at: string
  reasons: AutoHoldReason[]
}

/** PR 대응의 push와 답글 게시에서 실패한 단계 (D77): push, 답글 게시(reply) */
export type RespondStage = 'push' | 'reply'

/**
 * PR 대응 task의 라운드 (시나리오 10-3~10-6, D170, D189, D193). [대응 시작] 때 적고, 승인 뒤 push와 답글 게시의 결과를
 * 적는다. 게시한 답글의 본문과 코멘트 id는 pr-items.json의 라운드 기록에 둔다 (D191, D194)
 */
export interface RespondRound {
  /** 라운드: 이 Work의 PR 대응 task 차례. 1부터다. 답글의 보이지 않는 표시에 넣는다 (D194) */
  round: number
  /** 이번 라운드의 항목 id. [대응 시작]을 누른 때 사람이 본 새 항목이다 (D170) */
  items: string[]
  /** 사람 지시. 없으면 null (D182) */
  instruction: string | null
  /**
   * 승인했지만 원격 PR 브랜치의 새 커밋 때문에 push가 거절돼 push와 답글 게시를 미뤘다 (D193). 다음 라운드가 원격을
   * 병합한 뒤 함께 push하고 이 라운드의 답글도 게시한다
   */
  deferred_at?: string
  /** push와 답글 게시를 마친 때. 이 라운드의 항목은 처리됨이다 (D189) */
  published_at?: string
  /** 마지막으로 실패한 push나 답글 게시 (D120과 같은 방식). 승인 대기로 남고 다시 승인하면 이어서 한다 */
  failure?: { at: string; stage: RespondStage; error: string }
  /** 묶음 Work에서 이 라운드의 PR 카드: 서브모듈 경로 (D480). 메인 PR이면 없다 */
  repo?: string
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
  /**
   * 앱이 꺼져 끝난 세션 (D219): quit은 앱 종료 확인으로 끝냈고, restart는 앱이 세션을 끝내지 못하고 꺼져 다시 켤 때
   * 조정했다. 승인 안내와 [재개]의 첫 입력에 쓴다. 다른 까닭으로 끝났거나 다시 열면 없다
   */
  app_ended?: 'quit' | 'restart'
}

export interface TaskRecord {
  /** 생성 시 고정한 엔진. 없는 기존 기록은 Claude다 (E3, E5). */
  engine?: AgentEngine
  /** 생성 시 고정한 모델. 없으면 엔진의 기본이다 (설정의 기본 모델, 상세 설정) */
  model?: string
  /** 생성 시 고정한 추론 수준. 없으면 엔진의 기본이다 */
  effort?: string
  /** 실행/재개할 때 점검한 CLI 버전. 기존 claude_version도 읽는다. */
  engine_version?: string
  /** t-01. 순번은 Work 안에서 1부터 오른다 */
  id: string
  /** task 디렉터리 tasks/<nn>-<node>(커스텀 단계는 <nn>-<step>)의 nn */
  seq: number
  node: TaskNode
  /** 커스텀 단계(node가 custom)의 단계 id (D462). task 디렉터리는 tasks/<nn>-<step>이다 */
  step?: string
  /** 커스텀 단계의 화면 이름. task를 만들 때 Work의 custom_type에서 옮긴다 (D462) */
  step_title?: string
  status: TaskStatus
  reason: StartReason
  /** handoff를 검사할 형식 버전 (5.2.1) */
  format_version: number
  created_at: string
  /** task 시작 커밋 (시나리오 2-1). [변경]의 범위가 쓴다 */
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
  /** 자동 승인 카운트다운 (4.3, D127). 승인 대기에서 카운트다운 중일 때만 있다 */
  countdown?: Countdown
  /**
   * 자동 승인이 켜진 단계에서 자동 승인하지 않은 까닭 (D128~D130). 승인 대기일 때만 있고, 다음 Stop에서 다시
   * 판정한다 (D131). 승인 화면에 보인다
   */
  auto_hold?: AutoHold
  /** 승인 기록 (D3). 자동 승인이면 auto다 (4.3) */
  approved_at?: string
  approved_by?: ApprovalBy
  /** [오류 무시하고 승인]으로 넘긴 오류 (4.1, D112) */
  ignored_errors?: FormatIssue[]
  /** task를 띄우지 못한 이유 */
  error?: string
  /** D418 전에 단계 선택으로 들어온 task (D424) */
  selection?: StepSelection
  /** D418 전의 단계 선택으로 폐기한 때와, 폐기를 부른 단계 선택이 만든 task (D424) */
  discarded_at?: string
  discarded_by?: string
  /** PR 대응 task의 라운드 (시나리오 10). respond 노드에만 있다 */
  respond?: RespondRound
  /**
   * 묶음 Work(D470)에서 고른 서브모듈마다의 task 시작 커밋. 키는 서브모듈 경로다. 메인 레포는 start_commit이다. 그 레포의
   * worktree가 없던 때(나중에 [레포 추가]로 더함, D473) 시작한 task에는 그 키가 없다
   */
  repo_starts?: Record<string, string>
}

/** 승인된 intent (5.3). intent.md 머리글의 version과 같다 */
export interface ApprovedIntent {
  version: number
}

/** Work가 멈춘 이유 (3.3): [이 단계 끝나면 멈춤] (시나리오 3-4). 이전 단계 추천(D23)은 D418 전 기록이다 (D424) */
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

/** 진행 중 작업 기록의 공통 (D77) */
interface OperationBase {
  started_at: string
  /**
   * 앱을 다시 켜며 이 기록이 남아 있는 것을 찾은 때 (시나리오 9-4). 있으면 끊긴 작업이다: 알리고
   * [다시 시도]·[무시]만 받는다 (D121~D123). [다시 시도]가 시작하면 지운다
   */
  interrupted_at?: string
}

/**
 * 코드를 되돌리는 되감기의 진행 중 작업 기록 (D77). D418 전 기록이다: 되감기는 없어 새로 쓰지 않고, 끊긴 채 남은
 * 기록은 [무시]만 받는다 (D424).
 */
export interface RewindOperation extends OperationBase {
  kind: 'rewind'
  /** 지금 하는 단계: backup(백업 브랜치 만들기), reset(코드 되돌리기) */
  stage: 'backup' | 'reset'
  /** 고른 단계 */
  node: NodeName
  /** 단계를 고른 때의 지금 task */
  from_task: string
  instruction: string | null
  /** 의도 승인 전 [intake 다시]에서 바꿀 유형 (D237, I59). 바꾸지 않으면 없다 */
  type?: WorkType
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
  /**
   * reset 단계에서 되돌리기 전 HEAD. 끊긴 되감기를 다시 할 때 백업이 지금 코드와 같은지 본다 (D123).
   * backup 단계와 M6 전의 기록에는 없다
   */
  head?: string
}

/** 전달 (시나리오 7-3): [push] 또는 [PR 생성]. [완료만]은 전달이 없다 */
export type DeliveryChoice = 'push' | 'pr'

/**
 * 묶음 Work(D470)의 레포 하나를 어떻게 전달하는가 (D477, D479). 앱이 서브모듈마다 차례로 하고 메인은 마지막이다.
 * 서브모듈 레포마다의 진행과 결과를 적는다
 */
export interface RepoDeliverStep {
  /** 서브모듈 경로 */
  path: string
  choice: DeliveryChoice
  /** 이 레포의 커밋 안 된 변경을 어떻게 하는가. 없었으면 null */
  uncommitted: UncommittedAction | null
  /** PR 대상 브랜치: 이 레포의 머지 대상 */
  base: string
  /** 지금 하는 단계. 이 레포를 마쳤으면 done이다 */
  stage: DeliveryStage | 'done'
  stash?: string
  commit?: string
}

/** 전달의 단계 (D77): 커밋 안 된 변경 처리(prepare), push, PR 만들기(pr) */
export type DeliveryStage = 'prepare' | 'push' | 'pr'

/** 커밋 안 된 변경의 처리 (7-5): [변경 버리고 진행](git stash -u), [커밋하고 진행] */
export type UncommittedAction = 'discard' | 'commit'

/**
 * 전달의 진행 중 작업 기록 (7-6, D77). 전달을 시작할 때 적고, 단계마다 stage를 옮기고, 끝나면(성공이든
 * 실패든) 결과를 남기는 work.json 한 번 쓰기에서 지운다. 재시작 때 남아 있으면 끊긴 작업이다 (D123).
 */
export interface DeliverOperation extends OperationBase {
  kind: 'deliver'
  stage: DeliveryStage
  choice: DeliveryChoice
  /** 전달하는 verify task */
  task_id: string
  /** 커밋 안 된 변경을 어떻게 하는가. 없었으면 null */
  uncommitted: UncommittedAction | null
  /** push할 브랜치(작업 브랜치, D425)와 PR 대상 브랜치(머지 대상, D428) */
  branch: string
  base: string
  /** 커밋 안 된 변경을 처리하며 만든 stash나 커밋 (7-5). prepare 단계를 마치고 push로 옮길 때 적는다 */
  stash?: string
  commit?: string
  /**
   * 묶음 Work(D470)에서 메인 레포를 보내지 않는다(D477). choice는 서브모듈에 고른 것 가운데 하나로 기록에만 쓴다. 메인의
   * 전달 기록(delivery)은 남기지 않는다
   */
  skip_main?: true
  /** 묶음 Work의 서브모듈 전달 (D479). 앞부터 차례로 하고 메인은 그 뒤다 */
  repos?: RepoDeliverStep[]
  /** 메인이 새 커밋을 가리키게 할 서브모듈 경로 (D478). 메인을 보낼 때만 있다 */
  link?: string[]
  /** 메인에 더한 gitlink 커밋 (D478). 만들었으면 있다 */
  link_commit?: string
}

/** 정리의 단계 (D77): worktree 지우기, 브랜치 지우기, 원격 브랜치 지우기(머지한 Work, D178) */
export type CleanStage = 'worktree' | 'branches' | 'remote'

/** 묶음 Work(D470)에서 서브모듈 레포마다 정리할 것 (D482) */
export interface RepoCleanStep {
  path: string
  /** git worktree remove --force */
  force: boolean
  /** 지울 로컬 브랜치 (그 서브모듈 저장소의 것) */
  delete_branches: string[]
  /** 지울 origin의 브랜치 */
  delete_remote?: string
  /** 정리를 시작할 때 그 worktree의 HEAD. 없었으면 작업 브랜치의 커밋, 그것도 없으면 null */
  head: string | null
}

/**
 * 정리의 진행 중 작업 기록 (시나리오 8, D77). 정리를 시작할 때 적고, worktree를 지우면 stage를 옮기고,
 * 끝나면 보관됨으로 바꾸는 work.json 한 번 쓰기에서 지운다. 재시작 때 남아 있으면 끊긴 작업이다 (D123).
 */
export interface CleanOperation extends OperationBase {
  kind: 'clean'
  stage: CleanStage
  /** git worktree remove --force: 커밋 안 된 변경이나 잠금 파일을 사람이 확인했다 */
  force: boolean
  /** 지울 브랜치: 작업 브랜치(push됐거나 머지됐고 사람이 골랐을 때)와 되감기 백업 브랜치 */
  delete_branches: string[]
  /** 지울 origin의 브랜치. 머지로 완료한 Work에서 사람이 골랐을 때만 있다 (D178) */
  delete_remote?: string
  /** 정리를 시작할 때 worktree의 HEAD. worktree 폴더가 없었으면 작업 브랜치의 커밋, 그것도 없으면 null */
  head: string | null
  /** 묶음 Work의 서브모듈마다 정리할 것 (D482). 서브모듈 worktree를 먼저 지우고 메인 worktree를 지운다 */
  repos?: RepoCleanStep[]
}

/** 머지 방식 (D177): 머지 커밋, squash, rebase */
export type MergeMethod = 'merge' | 'squash' | 'rebase'

/**
 * 머지의 진행 중 작업 기록 (시나리오 10-8, D77). gh pr merge를 부르기 전에 적고, 결과를 남기는 work.json 한 번
 * 쓰기에서 지운다. 재시작 때 남아 있으면 끊긴 작업이다: [다시 시도]는 PR을 다시 읽어 머지됐으면 완료하고, 아니면
 * 같은 head로 다시 머지한다 (D123)
 */
export interface MergeOperation extends OperationBase {
  kind: 'merge'
  method: MergeMethod
  /** 머지할 head: 머지 창에 보인 커밋이다. 이 커밋이 아니면 GitHub가 머지하지 않는다 (D176) */
  head: string
  /** gh pr merge는 성공했지만 머지됐는지 읽지 못했다 (D330). 끊긴 작업으로 남고 [다시 시도]가 확인한다 */
  unconfirmed?: true
  /** 묶음 Work의 서브모듈 PR 카드 (D480). 메인 PR이면 없다 */
  repo?: string
}

/**
 * PR 대응을 승인한 뒤의 push와 답글 게시 (시나리오 10-6, D77, D169, D194). 승인하면 적고, 결과(게시 마침, push를 미룸,
 * 실패)를 남기는 work.json 한 번 쓰기에서 지운다. 재시작 때 남아 있으면 끊긴 작업이다: [다시 시도]는 push를 다시 하고
 * (보낸 커밋은 다시 보내지 않음) 코멘트 id가 적힌 답글은 건너뛴다(D123, D194)
 */
export interface RespondOperation extends OperationBase {
  kind: 'respond'
  stage: RespondStage
  /** 승인한 PR 대응 task */
  task_id: string
  /** push하고 답글을 게시할 라운드의 task. push를 미룬 앞 라운드(D193)가 먼저이고 승인한 task가 끝이다 */
  rounds: string[]
  /**
   * 승인할 때 앱이 마지막으로 읽은 원격 PR head. push한 커밋은 여기서 닿지 않고 로컬 HEAD에서 닿는 커밋이다. 끊긴 push를
   * 다시 해도 같은 커밋을 적는다
   */
  from: string
  /** [오류 무시하고 승인]으로 넘긴 오류 (D112). 승인을 기록할 때 남긴다 */
  ignored?: FormatIssue[]
  /** 승인 방식 (4.3, D169). 없으면 사람 승인이다(M11 전의 기록) */
  by?: ApprovalBy
  /** 묶음 Work의 서브모듈 PR 카드 (D480). 메인 PR이면 없다 */
  repo?: string
}

/** 진행 중인 여러 단계 작업 (D77): 되감기, 전달, 정리, 머지, PR 대응의 push와 게시 */
export type WorkOperation =
  RewindOperation | DeliverOperation | CleanOperation | MergeOperation | RespondOperation

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

/** 해시를 적는 앱 소유 파일 (6.1, D91, D124, D125). work.json은 따로 비교한다 */
export type OwnedFile = 'request.md' | 'intent.md' | 'decisions.md'

/** 앱 소유 파일의 해시(sha256:<hex>). 없는 파일은 키가 없다 (D124) */
export type OwnedFileHashes = Partial<Record<OwnedFile, string>>

/**
 * 살아 있는 정리 세션([AI 세션 열기], 7-5)의 claude 프로세스 (D126). 세션이 끝나면 지운다.
 * 재시작 때 task의 세션과 같이 확인해 끝낸다 (D76)
 */
export interface CleanupProcess {
  pid: number
  process_started_at?: string
  started_at: string
}

/**
 * 곁 세션의 기록 (시나리오 11, D389). 대화는 남겨 [곁 세션 열기]가 잇고, 프로세스는 살아 있는 동안만 두어 재시작 때
 * task의 세션과 같이 확인해 끝낸다 (D76, D126)
 */
export interface SideRecord {
  /** 다시 열 대화. 첫 요청(UserPromptSubmit)이 와 대화가 생긴 뒤에 있다 */
  session_id?: string
  /** 그 대화의 엔진 (D391). 없는 옛 기록은 Claude다. 지금 설정과 다르면 이어 가지 않고 새 대화로 연다 */
  engine?: AgentEngine
  /** 살아 있는 곁 세션의 claude 프로세스 */
  process?: CleanupProcess
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
  /** 지운 origin의 브랜치 (D178). 지우지 않았으면 없다 */
  deleted_remote_branch?: string
  /** 묶음 Work의 서브모듈마다 정리 결과 (D482). 키는 서브모듈 경로다 */
  repos?: Record<
    string,
    { head: string | null; deleted_branches: string[]; deleted_remote_branch?: string }
  >
}

/** 머지 (D176~D179) */
export interface PrMerged {
  at: string
  /** 머지한 head 커밋 */
  head: string
  /** 앱의 [머지]로 고른 방식. 밖에서 머지된 것을 읽었으면 null (D179) */
  method: MergeMethod | null
  /** 밖에서 머지된 것을 읽었다 (D179) */
  outside: boolean
}

/**
 * PR 진행의 기록 (D191). 항목의 본문과 상태는 Work 디렉터리의 pr-items.json에 둔다.
 * PR의 레포는 주소에서 읽는다 (I50)
 */
export interface PullRequestRecord {
  number: number
  /** gh pr create가 찍은 주소나 이미 열려 있던 PR의 주소 (7-4, D156) */
  url: string
  /**
   * 앱이 마지막으로 읽은 원격 PR head. PR을 만들 때는 push한 커밋이다. 머지 창에 보이고 머지는 이 커밋으로만
   * 한다 (D176)
   */
  head: string
  /** PR 진행을 시작할 때의 gh --version (D198). 읽지 못했으면 null */
  gh_version: string | null
  started_at: string
  /** 마지막으로 읽은 때 (D158) */
  read_at?: string
  /** 닫힌 것을 읽은 때 (D179). 있는 동안은 자동으로 읽지 않는다. 다시 열린 것을 읽으면 지운다 */
  closed_at?: string
  /** 머지 (D178, D179). 있으면 Work는 완료다 */
  merged?: PrMerged
  /** [머지 없이 끝내기]를 누른 때 (D179). 있으면 Work는 완료다 */
  ended_at?: string
  /** 머지 뒤 [Work 정리] 창을 연 때 (D178, D200). 머지했는데 없으면 사람이 그 Work를 볼 때 연다 */
  clean_offered_at?: string
  /**
   * 사람 손 없이 이어진 대응 라운드 수 (D171, D191의 "자동 라운드 수"). 자동 시작할 때 1 더하고, 사람이 [대응 시작]이나
   * 대응 task의 승인을 누르면 0으로 돌린다. 없으면 0이다
   */
  auto_rounds?: number
}

/**
 * 묶음 Work(D470)에서 함께 고치는 서브모듈 하나. 메인 레포는 WorkState의 기준 브랜치·커밋, 전달, PR 기록이다. 작업 브랜치
 * 이름은 모든 레포가 WorkState의 branch로 같다 (D471)
 */
export interface WorkRepo {
  /** 메인 레포 안의 서브모듈 경로 (`.gitmodules`의 path, `/`로 나눔) */
  path: string
  /** `.gitmodules`의 서브모듈 이름. git 설정(`submodule.<이름>.*`)의 이름이다 (D415) */
  name: string
  /** 이 레포의 기준 브랜치와 기준 커밋 (D470) */
  base_branch: string
  base_commit: string
  /** 머지 대상 (D428). 없으면 기준 브랜치다 */
  target_branch?: string
  /** [레포 추가]로 더한 때 (D473). Work를 만들 때 고른 레포면 없다 */
  added_at?: string
  /** 이 레포의 마지막 전달 결과 (D477) */
  delivery?: DeliveryRecord
  /** 이 레포의 PR 진행 기록 (D480) */
  pr?: PullRequestRecord
  /** 메인이 이 레포의 새 커밋을 가리키게 했다 (D478). 메인 PR의 [머지]는 이 레포의 PR이 머지된 뒤다 (D481) */
  linked?: true
}

/** 이슈를 닫는 까닭 (D346): Work를 끝냈다(completed), 하지 않고 끝냈다(not_planned) */
export type IssueCloseReason = 'completed' | 'not_planned'

/**
 * 이슈 기록의 게시 하나 (설계 3.7, D339, D341, D346, D347, D349). 대기열의 앞부터 차례로 게시한다 (D344).
 * - issue: 새 이슈를 만든다. 본문은 그때 확정한 intent다 (D336). 기존 이슈(D338)에는 없다
 * - task: 승인된 task의 코멘트 (D339). intake면 그때 확정한 intent 버전을 적는다
 * - step: D418 전의 단계 선택(되감기·건너뛰기) 코멘트. 그 앱이 대기열에 남긴 것만 게시한다 (D424)
 * - end: Work가 어떻게 끝났는지 한 줄 (D347)
 * - close: 이슈를 닫는다 (D346). 기존 이슈에는 없다
 */
export type IssueEntry =
  | { kind: 'issue'; intent_version: number }
  | { kind: 'task'; task_id: string; intent_version?: number }
  | { kind: 'step'; task_id: string }
  | { kind: 'end'; text: string }
  | { kind: 'close'; reason: IssueCloseReason }

/** 게시한 항목 (D349). 키는 core/issue issueKey다 */
export interface IssuePosted {
  key: string
  at: string
  /** 코멘트의 id와 주소. 이슈 만들기와 닫기에는 없다 */
  comment_id?: number
  url?: string
}

/**
 * 이슈 기록 (설계 3.7, D336~D349, I96). 이슈 기록이 켜진 프로젝트에서 만든 Work에만 있다. 이슈는 로컬 기록을 내보내는
 * 사본이고 앱은 이슈를 읽지 않는다 (D349)
 */
export interface IssueRecord {
  /** 새 Work 대화상자에 적은 기존 이슈 (D338). 새 이슈를 만들지 않고 앱이 닫지 않는다 */
  linked: boolean
  /** 이슈 번호와 주소. 새 이슈는 만들기 전에 null이고, 기존 이슈의 주소는 첫 코멘트를 올린 뒤에 안다 */
  number: number | null
  url: string | null
  /**
   * 보이지 않는 표시의 id (D349, core/issue issueMarkId): <work-id>-<임의의 16진수>. work-id는 앱 하나 안에서만 겹치지 않아
   * 팀원의 Work가 같은 레포에 남긴 글과 가린다
   */
  mark: string
  /** 게시할 항목. 앞부터 하나씩 게시한다 (D344) */
  pending: IssueEntry[]
  posted: IssuePosted[]
  /**
   * 대기열 맨 앞을 게시하려고 시도한 때. 결과를 모를 수 있어 다음 시도는 원격에서 표시를 먼저 찾는다 (D349). 게시하면
   * 지운다
   */
  attempted_at?: string
  /** 마지막으로 실패한 게시 (D344). 패널에 [다시 시도]와 보인다. 게시하면 지운다 */
  failure?: { at: string; key: string; error: string }
  /** 앱이 닫은 때와 까닭 (D346) */
  closed?: { at: string; reason: IssueCloseReason }
  /**
   * 다시 한 Work가 원래 Work에서 이어 쓰는 이슈 (D421): 원래 Work의 id. 이슈가 이미 있어 새로 만들지 않고 intent부터
   * 코멘트로 단다. linked는 원래 Work의 것이라, 앱이 만든 이슈면 이 Work가 끝날 때 닫는다
   */
  from_work?: string
}

export interface WorkState {
  schema_version: 1
  /** w-YYYYMMDD-NNN */
  work_id: string
  /**
   * 업무 유형 (D236). 새 Work 대화상자에서 고른 값이다. 없으면 버그 수정으로 읽는다 (D256, I58). 읽는 쪽은
   * core/pipeline의 workType을 쓴다
   */
  type?: WorkType
  /** 커스텀 유형이면 Work를 만들 때 복사한 정의와 출처, 해시 (D458). type이 custom일 때만 있다 */
  custom_type?: WorkCustomType
  status: WorkStatus
  created_at: string
  completed_at?: string
  abandoned_at?: string
  /** 기준 브랜치와 기준 커밋 (시나리오 1, D97) */
  base_branch: string
  base_commit: string
  /**
   * 작업 브랜치 (D425). 프로젝트의 브랜치 규칙(D426)이나 사람이 고친 이름 끝에 임의의 4자를 붙인 것이다(D427). 이것을
   * 적기 전에 만든 Work면 없고 relay/<work-id>로 읽는다. 읽는 쪽은 core/records의 workBranch를 쓴다
   */
  branch?: string
  /** 머지 대상 브랜치 (D428): PR의 base다. 없으면 기준 브랜치다. 읽는 쪽은 core/records의 targetBranch를 쓴다 */
  target_branch?: string
  /**
   * 메인 통합 검증 worktree (D414). 서브모듈 Work에서 함께 만들었으면 있다: 메인 레포의 기준 브랜치와 고정한 커밋이다.
   * 이 Work의 worktree는 그 안의 서브모듈 자리에 있다
   */
  integration?: { base_branch: string; base_commit: string }
  /**
   * 묶음 Work (D470): 함께 고치는 서브모듈. 메인 worktree 안의 그 자리에 서브모듈 레포의 worktree가 있다 (D471). 메인 레포만
   * 고치는 Work면 없다
   */
  repos?: WorkRepo[]
  /**
   * 메인 레포를 고르지 않은 묶음 Work (D470, D471). 메인 worktree는 기준 커밋에 분리된 HEAD로 고정되고 메인은 커밋하거나
   * 전달하지 않는다
   */
  main_fixed?: true
  /**
   * 서브모듈 PR 카드의 렌즈 (D480, I174): 그 레포를 메인 자리(pr, 기준 브랜치·커밋, 머지 대상, 전달)에 둔 모양의 표시다.
   * 앱 안에서만 쓰고 work.json에 쓰지 않는다(core/repos unfocusLane이 뗀다)
   */
  lens?: string
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
  /** 보관된 Work를 사이드바의 공통 아카이브로 옮긴 때. 옮기지 않았으면 없다 */
  shelved_at?: string
  /**
   * 앱 소유 파일의 해시 (D91, D124). 앱이 쓸 때마다 적고, 앱을 켤 때와 읽을 때 비교한다.
   * M6 전에 만든 Work는 처음 읽을 때 적기 전까지 없다
   */
  file_hashes?: OwnedFileHashes
  /** 살아 있는 정리 세션의 프로세스 (D126) */
  cleanup_process?: CleanupProcess
  /** 곁 세션의 대화와 프로세스 (D389). 연 적이 없으면 없다 */
  side?: SideRecord
  /** PR 진행의 기록 (D191). [PR 생성]이 성공한 Work에 있다 */
  pr?: PullRequestRecord
  /** 이슈 기록 (설계 3.7, I96). 이슈 기록이 켜진 프로젝트에서 만든 Work에 있다 */
  issue?: IssueRecord
  /** 다시 한 Work면 원래 Work의 id (D421). Work에서 쓴 초안으로 만들었을 때 있다 */
  from_work?: string
  tasks: TaskRecord[]
}

/** events.jsonl의 이벤트 유형 (5.5) */
export type LifecycleEventType =
  | 'work.created'
  | 'work.completed'
  | 'work.abandoned'
  | 'work.cleaned'
  | 'work.repo_added'
  | 'task.started'
  | 'task.session_identified'
  | 'task.first_output'
  | 'task.first_hook'
  | 'task.bounced'
  | 'task.awaiting_approval'
  | 'task.approved'
  | 'task.interrupted'
  | 'task.resumed'
  | 'delivery.succeeded'
  | 'delivery.failed'
  | 'pr.items_received'
  | 'pr.synced'
  | 'pr.pushed'
  | 'pr.replied'
  | 'pr.checks_rerun'
  | 'pr.relinked'
  | 'pr.merged'
  | 'pr.merge_unconfirmed'
  | 'pr.closed'
  | 'pr.reopened'
  | 'pr.auto_paused'
  | 'issue.created'
  | 'issue.posted'
  | 'issue.post_failed'
  | 'issue.closed'

/** events.jsonl의 한 줄 (5.5). task_id는 task 이벤트에만 있다 */
export interface LifecycleEvent {
  ts: string
  work_id: string
  task_id?: string
  type: LifecycleEventType
  payload: Record<string, unknown>
}
