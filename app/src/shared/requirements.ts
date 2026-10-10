// 요구사항 추출 Work의 extract 기록 (requirements-extraction-flow.md 8절, 결정 32~42, 92~99).
// 단위·주장·근거·사람 결정은 requirements/의 불변 revision 변경분에 두고(docs/contracts/requirements-revision.v0),
// work.json에는 포인터만 둔다(RequirementsPointer). 파일에 쓰는 모양이라 키는 snake_case다.
import type { ExtractIntegrate } from './generated/extract-integrate.v0'
import type { ExtractReview } from './generated/extract-review.v0'
import type { ExtractSummarize } from './generated/extract-summarize.v0'
import type { ExtractSurvey } from './generated/extract-survey.v0'
import type { ExtractTrace } from './generated/extract-trace.v0'
import type {
  Answer,
  Claim,
  Decision as HumanDecision,
  Evidence,
  Lens,
  Link,
  Note,
  Para,
  RequirementsRevision,
  Review,
  Unit,
  UnitUpdate,
} from './generated/requirements-revision.v0'

export type {
  Answer,
  Claim,
  Evidence,
  ExtractIntegrate,
  ExtractReview,
  ExtractSummarize,
  ExtractSurvey,
  ExtractTrace,
  HumanDecision,
  Lens,
  Link,
  Note,
  Para,
  RequirementsRevision,
  Review,
  Unit,
  UnitUpdate,
}

/** run 하나의 결과 제안 (16.4). 생산 run(survey, trace)과 기록을 받는 run(integrate, review, summarize, AI 결정 107) */
export type ExtractResult =
  ExtractSurvey | ExtractTrace | ExtractIntegrate | ExtractReview | ExtractSummarize

/** 단위의 run 종류 */
export type UnitKind = Unit['kind']

/** revision의 빌드 인덱스 상태 (AI 결정 118) */
export type BuildIndexState = NonNullable<RequirementsRevision['build_index']>

/** summarize run의 서술 (AI 결정 113) */
export type SummaryState = NonNullable<RequirementsRevision['summary']>

/** 단위의 상태 (결정 95). open만 열린 상태이고 나머지는 끝난 상태다. merged는 다른 단위에 합쳐졌다 */
export type UnitStatus = UnitUpdate['status']

/** 끝난 상태 (15.1의 "끝난 상태가 없는 분석 항목"을 가른다) */
export const CLOSED_STATUSES: readonly UnitStatus[] = [
  'done',
  'needs_external',
  'out_of_scope',
  'failed',
  'stalled',
  'merged',
  'held',
]

/** 다음 전역 ID 번호 (결정 94). 재사용하지 않는다 */
export interface NextIds {
  unit: number
  claim: number
  evidence: number
  decision: number
  revision: number
  run: number
  /** 연결 l-NNNN (AI 결정 110). 옛 포인터에는 없어 1로 읽는다 */
  link?: number
}

/** 단위마다 연속 횟수 (결정 6, 30, 40). 실패와 미완료는 서로를 끊지 않고 끝난 상태만 끊는다 */
export interface UnitStreak {
  failures: number
  incompletes: number
}

/** 도는 run (결정 32). 재시작 조정이 pid와 시작 시각으로 찾아 끝낸다 (D76) */
export interface ActiveRun {
  id: string
  unit: string
  pid: number | null
  process_started_at?: string
  started_at: string
  /** 띄울 때의 revision. 반영할 때 지금과 같아야 한다 (결정 34) */
  input_revision: number
  /** 패킷·지침·스키마의 sha256:<hex> */
  hashes: { packet: string; instructions: string; schema: string }
}

/**
 * 멈춘 까닭 (결정 98): 사람([즉시 중단], [이 단계 끝나면 멈춤]), 연속 실패(결정 6), 사람 결정만 남음(결정 7), 반영의 무결성
 * 오류(결정 38), 기준 소스 변경(결정 39), run 상한(결정 24, 26), 주간 사용량 한도(결정 29), 재시작(결정 4), run을 띄우지 못함
 */
export type HaltReason =
  | 'human'
  | 'failures'
  | 'decisions'
  | 'integrity'
  | 'source_changed'
  | 'run_limit'
  | 'usage_weekly'
  | 'restart'
  | 'launch'

export interface RequirementsHalt {
  at: string
  reason: HaltReason
  detail: string
}

/** 5시간 창 사용량 한도로 기다리는 중 (결정 29). 재설정 시각까지 기다렸다 같은 단위부터 잇는다 */
export interface UsageWait {
  until: string
  unit: string
}

/** 반영 대기 사람 답 (결정 41): requirements/answers/의 불변 파일과 그 해시 */
export interface PendingAnswer {
  file: string
  hash: string
}

/**
 * work.json의 요구사항 추출 포인터 (결정 32, 93). requirements Work의 extract를 시작하면 생긴다. 반영은 revision 파일을
 * 먼저 쓰고 이 값을 바꾸는 work.json 한 번 쓰기로 마친다
 */
export interface RequirementsPointer {
  /** 현재 revision 번호와 그 파일의 해시 (결정 38). 아직 없으면 0과 null */
  revision: number
  revision_hash: string | null
  next: NextIds
  /** 쓴 run 수 (결정 24, 40). 사용량 한도로 버린 run은 넣지 않는다 */
  runs_used: number
  /** [계속 +N]으로 늘린 run 수 (결정 26, 31) */
  runs_extra: number
  /** 항목과 관계없는 연속 실패 (결정 6) */
  failures_in_row: number
  streaks: Record<string, UnitStreak>
  run?: ActiveRun
  halt?: RequirementsHalt
  usage_wait?: UsageWait
  pending_answers?: PendingAnswer[]
  /** [이 단계 끝나면 멈춤]: 지금 run이 끝나면 멈춘다 (17.12 사람 결정) */
  stop_after_run?: boolean
  /** 답을 받지 않은 사람 결정 수. 배지와 알림이 본다 (결정 7, AI 결정 116) */
  open_decisions?: number
  /** 저장소로 내보낸 결과 (AI 결정 119) */
  exported?: { path: string; commit: string; at: string }
  /**
   * 이 계보를 돌리는 extract task (결정 120). 다른 task(되감기나 다시 연 extract)가 시작하면 계보를 새로 열거나 이어받는다.
   * 없으면(이 필드 전의 포인터) 처음 돌리는 task가 가진다
   */
  task?: string
}

/** 승인 때 기록 무결성 문제의 파일 이름 (AI 결정 124). 이 파일의 문제는 [오류 무시하고 승인]으로도 넘기지 못한다 */
export const RECORD_ISSUE_FILE = 'requirements/'

/** 빌드 인덱스를 만들 구성과 survey가 낸 그 빌드 명령 (AI 결정 118) */
export interface BuildTarget {
  name: string
  command: string
}

/** 앱 설정의 "요구사항 추출" 절 (결정 30, 31) */
export interface RequirementsBudget {
  run_limit: number
  hard_minutes: number
  soft_minutes: number
  unit_failures: number
  failures_in_row: number
  unit_incompletes: number
}

export const DEFAULT_REQUIREMENTS_BUDGET: Readonly<RequirementsBudget> = {
  run_limit: 100,
  hard_minutes: 30,
  soft_minutes: 15,
  unit_failures: 2,
  failures_in_row: 3,
  unit_incompletes: 3,
}

/** 접은 지금의 단위 하나 */
export interface UnitState extends Unit {
  status: UnitStatus
  reason: string
  /** 마지막으로 반영한 run */
  run: string | null
  checkpoint: Record<string, unknown> | null
  checklist: Record<string, unknown> | null
  /** 합쳐진 단위(merged)면 받은 단위 */
  merged_into?: string
  /** 끝난 뒤 사람 결정의 답으로 다시 열렸으면 그 결정 (결정 103) */
  reopened_by?: string
  /** 마지막으로 이 단위를 바꾼 revision 번호 (AI 결정 111의 "마지막 integrate 뒤") */
  revision: number
}

/** 반영한 run 하나 (AI 결정 111): 어느 단위의 무슨 종류를 어느 revision에 반영했나 */
export interface AppliedRun {
  id: string
  unit: string
  kind: UnitKind
  revision: number
}

/** 검토 하나 (AI 결정 112) */
export type ReviewState = Review

export interface DecisionState extends HumanDecision {
  answer: Answer | null
}

/** 변경분을 접은 지금의 기록 (결정 93). 키는 전역 ID이고 순서는 만든 차례다 */
export interface RequirementsState {
  revision: number
  units: UnitState[]
  claims: Claim[]
  evidence: Evidence[]
  decisions: DecisionState[]
  /** integrate가 낸 연결 (AI 결정 110) */
  links: Link[]
  /** review의 비교와 판정 (AI 결정 112) */
  reviews: Review[]
  /** 사람 메모 (AI 결정 114, 120) */
  notes: Note[]
  /** 마지막 빌드 인덱스 상태 (AI 결정 118) */
  build_index: BuildIndexState | null
  /** 마지막 summarize 서술 (AI 결정 113) */
  summary: SummaryState | null
  /** 반영한 run의 차례 */
  runs: AppliedRun[]
}
