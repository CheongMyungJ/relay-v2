// 렌더러로 보내는 스냅샷과 조회 결과 (I14). main이 core로 계산하고, 화면은 받은 것을 그리기만 한다.
import type { WorkSettings } from './config'
import type { Decision, HandoffStatus, NodeName, Size } from './contracts'
import type { ApprovedIntent, FormatIssue, TaskStatus, WorkStatus } from './work'

// ---------- 승인 판정과 승인 화면 (core/approval, core/review) ----------

export interface ApprovalGate {
  /** [승인]. 유효한 awaiting_approval handoff가 있다. 사람이 고른 size로 풀린 오류는 치지 않는다 (4.1) */
  approve: boolean
  /** [오류 무시하고 승인]. 확인 창을 거친다 (4.1, D112) */
  force: boolean
  /** 사람이 고른 size로 풀린 것을 뺀 오류 */
  errors: FormatIssue[]
  /** [오류 무시하고 승인]으로도 넘길 수 없는 오류 (D90) */
  blocking: FormatIssue[]
}

export type EmphasisKind =
  | 'blocked'
  | 'intent_deviation'
  | 'open_questions'
  | 'recommended_back'
  | 'uncommitted'
  | 'format_errors'

/** 승인 화면 강조 영역의 한 항목. 사람이 봐야 할 것만 모은다 (D83) */
export interface Emphasis {
  kind: EmphasisKind
  title: string
  lines: string[]
}

/** Work 완료 화면의 판정표 한 행 (시나리오 7-3) */
export interface Verdict {
  criterion: string
  verdict: string
  basis: string
  /** 실패나 판정 불가. 경고로 강조한다 (D59) */
  warn: boolean
}

// ---------- 사이드바 배지 (core/approval, D80) ----------

export type BadgeKind =
  | 'asking'
  | 'awaiting_approval'
  | 'blocked'
  | 'stopped'
  | 'session_ended'
  | 'working'
  | 'idle'
  | 'queued'
  | 'interrupted'
  | 'done'

/** Work마다 하나. 사람이 필요한 상태(hot)는 색으로 강조한다 (D80) */
export interface Badge {
  kind: BadgeKind
  label: string
  hot: boolean
}

// ---------- 스냅샷 (I14) ----------

export interface ProjectView {
  id: string
  /** 레포 폴더 이름 */
  name: string
  repoPath: string
  defaultBranch: string
  origin: boolean
  gh: boolean
}

export interface TaskView {
  id: string
  /** 이 task 터미널의 키 */
  terminal: string
  node: NodeName
  /** "03 원인 분석" (D109) */
  label: string
  /** 탭 위 머리 띠 (시나리오 2-5) */
  band: string
  /** 머리 띠의 경고 (D94) */
  notice: string | null
  status: TaskStatus
  statusLabel: string
  /** 이 앱에서 세션이 살아 있다. 끝난 task의 탭은 읽기 전용이다 */
  live: boolean
  /** --resume으로 다시 연 적이 있다 (시나리오 3-4) */
  resumed: boolean
  /** task를 띄우지 못한 이유 */
  error: string | null
  /** 마지막 형식 검사의 오류 수 */
  errorCount: number
  /** 형식 오류 되돌림의 연속 횟수 (D21, D107) */
  bounces: number
}

export interface WorkView {
  /** <project-id>/<work-id> */
  key: string
  projectId: string
  projectName: string
  workId: string
  /** 요청의 첫 줄 */
  title: string
  status: WorkStatus
  statusLabel: string
  /** 사이드바 배지 (D80) */
  badge: Badge
  /** 액션 바에서 누를 수 있는 조작 (core/machine actions) */
  actions: WorkActions
  /** [이 단계 끝나면 멈춤]이 켜져 있다 (시나리오 3-4) */
  stopAfterStep: boolean
  /** Work별 설정 (D72) */
  settings: WorkSettings
  baseBranch: string
  baseCommit: string
  intent: ApprovedIntent | null
  /** 멈춘 이유: 이전 단계 추천(D23), [이 단계 끝나면 멈춤] */
  stopNotice: string | null
  /** 멈춘 Work에서 [재개]가 할 일 (3.3) */
  stopHint: string | null
  tasks: TaskView[]
  /** 지금 task의 id */
  current: string | null
  /** 할 일을 실행하다 난 오류 */
  problems: string[]
  /** 바뀔 때마다 오른다. 렌더러는 이 값이 바뀌면 승인 화면을 다시 불러온다 */
  revision: number
}

/** 액션 바의 조작 (시나리오 3-4, 3-5, 4.4) */
export interface WorkActions {
  /** [즉시 중단] */
  interrupt: boolean
  /** [재개](중단됨), [세션 재개](세션 종료, 세션 없는 승인 대기와 막힘) */
  resume: boolean
  /** [이 단계 새 세션으로 다시] (D114) */
  retry: boolean
  /** 멈춘 Work의 [재개] */
  resumeWork: boolean
  /** [이 단계 끝나면 멈춤] */
  stopAfter: boolean
  /** [Work 포기] */
  abandon: boolean
}

export interface AppSnapshot {
  projects: ProjectView[]
  works: WorkView[]
  /** 앱을 띄울 때의 경고 (예: config.json을 읽지 못함) */
  warnings: string[]
}

// ---------- 조회 ----------

export interface Artifact {
  name: string
  text: string
}

/** 승인 화면 (D83)과 Work 완료 화면 (시나리오 7-3)에 보일 것. 누를 때마다 다시 읽은 파일로 만든다 */
export interface ReviewView {
  workKey: string
  taskId: string
  node: NodeName
  label: string
  taskStatus: TaskStatus
  /** 에이전트가 턴을 끝낸 뒤라 승인 화면을 보일 상태다 (승인 대기, 대기, 세션 종료. D112) */
  reviewable: boolean
  handoffPresent: boolean
  /** handoff 머리글에서 읽은 status */
  handoffStatus: HandoffStatus | null
  /** handoff 본문의 `## 요약` */
  summary: string | null
  decisions: Decision[]
  assumptions: string[]
  risks: string[]
  errors: FormatIssue[]
  warnings: FormatIssue[]
  emphasis: Emphasis[]
  artifacts: Artifact[]
  /** 이 task의 변경 (task 시작 커밋 → 작업 트리) */
  diff: string
  /** intake: intent 초안의 size. [의도 승인]의 size 고르기 기본값 (4.1) */
  draftSize: Size | null
  /** 고른 size마다의 판정. none은 고르지 않았을 때다 */
  gates: Record<'none' | Size, ApprovalGate>
  /** verify: 판정표와 전체 Work의 변경 (기준 커밋 → 작업 트리) */
  completion: { verdicts: Verdict[]; diff: string } | null
}

// ---------- 명령 ----------

export type CommandResult = { ok: true } | { ok: false; error: string }

/** Work 생성 결과. 만든 Work의 키를 돌려준다 */
export type CreateWorkResult = { ok: true; workKey: string } | { ok: false; error: string }

export type CheckId = 'git_root' | 'claude' | 'duplicate' | 'origin' | 'gh'

/** 프로젝트 등록 점검 표의 한 행 (시나리오 0, D67) */
export interface CheckItem {
  id: CheckId
  label: string
  ok: boolean
  /** 실패하면 등록을 막는다. 아니면 경고만 한다 */
  blocking: boolean
  detail: string
}

export interface ProjectInspection {
  /** 레포 루트(레포가 아니면 고른 폴더)의 절대 경로 */
  path: string
  name: string
  checks: CheckItem[]
  /** origin/HEAD, 없으면 현재 브랜치 (시나리오 0-3). 사람이 고칠 수 있다 */
  defaultBranch: string | null
  canRegister: boolean
}

/** Work 생성 입력 (시나리오 1) */
export interface NewWorkInput {
  request: string
  baseBranch: string
  /** 원격이면 git fetch 뒤 origin/<브랜치>에서 분기한다 */
  baseLocation: 'local' | 'remote'
  /** Work별 설정 (D72). M3는 질문 방식만 덮어쓴다. 없으면 앱 설정을 따른다 */
  settings?: WorkSettings
}

export interface ApproveOptions {
  /** intake에서 사람이 고른 size (4.1) */
  size?: Size
  /** [오류 무시하고 승인] (D112) */
  force?: boolean
}

// ---------- 터미널 ----------

export interface TerminalChunk {
  /** task마다 0부터 오른다 */
  seq: number
  data: string
}

export interface TerminalBacklog {
  /** 지금까지의 출력 */
  data: string
  /** 다음 조각의 seq. 이보다 작은 조각은 data에 들어 있다 */
  next: number
  live: boolean
}
