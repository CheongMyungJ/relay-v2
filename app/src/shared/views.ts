// 렌더러로 보내는 스냅샷과 조회 결과 (I14). main이 core로 계산하고, 화면은 받은 것을 그리기만 한다.
import type { WorkSettings } from './config'
import type { Decision, HandoffStatus, NodeName, Size, TaskNode } from './contracts'
import type { PrItemKind, PrItemStatus } from './pr'
import type {
  ApprovedIntent,
  DeliveryChoice,
  FormatIssue,
  MergeMethod,
  TaskStatus,
  UncommittedAction,
  WorkStatus,
} from './work'

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
  | 'respond_failed'
  | 'blocked'
  | 'intent_deviation'
  | 'open_questions'
  | 'recommended_back'
  | 'existing_tests'
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

// ---------- 전달과 정리 (core/delivery, core/cleanup) ----------

/** 버튼을 누를 수 있는지와, 누를 수 없는 이유 */
export interface ButtonState {
  enabled: boolean
  reason: string | null
}

/** Work 완료 화면의 전달 버튼 (시나리오 7-3, 7-4, D67): [완료만], [push], [PR 생성] */
export interface DeliveryButtons {
  none: ButtonState
  push: ButtonState
  pr: ButtonState
}

/** 전달 결과 (work.json의 delivery, 시나리오 7-4, 7-6) */
export interface DeliveryView {
  choice: DeliveryChoice
  /** 버튼 이름: "push", "PR 생성" */
  label: string
  status: 'succeeded' | 'failed'
  at: string
  /** 실패한 단계의 이름과 오류 */
  stage: string | null
  error: string | null
  branch: string | null
  /** push 뒤 브라우저에서 PR을 만드는 비교 URL. origin 주소로 만들 수 없으면 null */
  compareUrl: string | null
  prUrl: string | null
  /** 같은 브랜치의 PR이 이미 열려 있어 링크만 기록했다 */
  prExisting: boolean
  draft: boolean
}

/** 정리 세션: [AI 세션 열기]로 연, 기록하지 않는 일반 터미널의 Claude Code (시나리오 7-5) */
export interface CleanupView {
  /** 이 세션 터미널의 키 */
  terminal: string
  /** 대기열(D18), 살아 있음, 끝남 */
  status: 'queued' | 'live' | 'ended'
  /** 원래 고른 전달 */
  choice: DeliveryChoice
  /** 마지막 턴이 끝난 때(Stop) git status가 깨끗했다. [정리 끝 → push/PR 진행]을 강조한다 */
  clean: boolean
  /** 세션이 끝난 뒤 남은 커밋 안 된 변경. 있으면 선택지 화면으로 돌아간다 */
  uncommitted: string[]
}

/** [push]·[PR 생성] (시나리오 7-4, 7-5) */
export interface DeliverInput {
  choice: DeliveryChoice
  /**
   * 커밋 안 된 변경의 처리. expect는 사람에게 보인 변경 목록이다. 그 사이 바뀌었으면 받지 않고
   * 지금 목록을 다시 돌려준다. 변경이 없으면 null이다
   */
  uncommitted: { action: UncommittedAction; expect: string[] } | null
}

/**
 * 전달의 결과. 커밋 안 된 변경이 있어 사람이 골라야 하면 uncommitted에 변경 목록을 준다 (7-5).
 * 전달이 실패하면 error이고, 실패는 Work 완료 화면에도 남는다 (D120)
 */
export type DeliverResult = { ok: true } | { ok: false; error: string; uncommitted?: string[] }

/** 정리를 확인한 때의 사실. [정리]에 함께 보내 그 사이 바뀌었으면 받지 않는다 */
export interface CleanExpect {
  uncommitted: string[]
  locks: string[]
  live: number
  backups: string[]
  /** origin에 작업 브랜치가 있었다 (머지로 완료한 Work만, D178) */
  remote: boolean
}

/** [Work 정리]의 확인 요약 (시나리오 8-1) */
export interface CleanPreview {
  /** worktree가 있다 */
  worktree: boolean
  /** 커밋 안 된 변경. 백업 없이 지운다 */
  uncommitted: string[]
  /** worktree의 git 폴더에 남은 잠금 파일(index.lock 등) */
  locks: string[]
  /** 이 앱에서 살아 있는 세션. 정리하면 트리째 끝낸다 */
  live: number
  branch: {
    name: string
    exists: boolean
    /** origin의 같은 이름 브랜치(원격 추적 브랜치)에 있다 */
    pushed: boolean
    /** 기준 브랜치(로컬이나 origin)에 머지됐다 */
    merged: boolean
    /** 삭제를 제안한다: push됐거나 머지됐다. 기본은 유지다 */
    deletable: boolean
  }
  /** 되감기 백업 브랜치 (D115). "함께 삭제"의 기본은 체크다 */
  backups: string[]
  /** 머지로 완료한 Work다. 작업 브랜치 삭제가 기본으로 체크된다 (D178) */
  merged: boolean
  /**
   * origin의 작업 브랜치 (D178). 머지로 완료한 Work만 삭제를 고를 수 있고 기본은 끈다. 머지로 완료하지 않았으면 null
   */
  remote: { name: string; exists: boolean } | null
  /** 사람이 명시적으로 확인해야 하는 것. 비어 있지 않으면 확인해야 [정리]를 누를 수 있다 */
  confirm: string[]
  expect: CleanExpect
}

export type CleanPreviewResult = { ok: true; preview: CleanPreview } | { ok: false; error: string }

/** [Work 정리]의 [정리] (시나리오 8-2) */
export interface CleanInput {
  /** 작업 브랜치도 지운다. push됐거나 머지됐을 때만 받는다 */
  deleteBranch: boolean
  /** 되감기 백업 브랜치를 함께 지운다 */
  deleteBackups: boolean
  /** origin의 작업 브랜치도 지운다. 머지로 완료한 Work에서 원격에 있을 때만 받는다 (D178). 없으면 지우지 않는다 */
  deleteRemote?: boolean
  /** 확인이 필요한 것(커밋 안 된 변경, 살아 있는 세션, 잠금 파일)을 확인했다 */
  confirmed: boolean
  expect: CleanExpect
}

// ---------- PR 진행 (시나리오 10, core/pr) ----------

/** gh의 체크 분류 (docs/implementation.md 3절, cli/cli pkg/cmd/pr/checks/aggregate.go) */
export type CheckBucket = 'pass' | 'skipping' | 'fail' | 'cancel' | 'pending'

/**
 * head 커밋의 CI (D176, D196): 통과(pass), 체크 없음(none: 처음 읽은 뒤 60초가 지나 통과로 봄),
 * 체크 기다림(waiting: 체크 없음, 60초 안), 도는 중(pending), 실패(fail), 취소됨(cancel)
 */
export type CiState = 'pass' | 'none' | 'waiting' | 'pending' | 'fail' | 'cancel'

export interface PrCheckView {
  name: string
  workflow: string | null
  /** Actions 체크를 부른 이벤트 (push, pull_request 등, D201). Actions 밖 체크이거나 읽지 못했으면 null */
  event: string | null
  /** 화면의 이름: 워크플로 / 이름 (이벤트) (core/pr checkLabel) */
  label: string
  state: string
  bucket: CheckBucket
  url: string | null
}

/**
 * 원격 PR head와 로컬 Work 브랜치의 비교 (D193): 같음, 원격만 앞섬(받음), 로컬만 앞섬, 갈라짐,
 * 원격만 앞서지만 worktree가 깨끗하지 않음, worktree가 Work 브랜치에 있지 않음(D138)
 */
export type SyncKind = 'same' | 'ff' | 'local_ahead' | 'diverged' | 'dirty' | 'off_branch'

export interface PrItemView {
  id: string
  kind: PrItemKind
  /** "리뷰", "인라인 코멘트", "대화 코멘트", "CI 실패", "충돌", "원격과 갈라짐" */
  kindLabel: string
  status: PrItemStatus
  statusLabel: string
  /** 한 줄 제목: 작성자와 본문 첫 줄, 체크 이름, 기준 커밋 */
  title: string
  /** 여러 줄인 본문(코멘트. 한 줄이면 제목에 있음)이나 로그 끝부분(CI 실패) */
  text: string | null
  /** 로그가 없는 까닭 */
  note: string | null
  url: string | null
  /** 인라인 코멘트의 파일:줄, 스레드의 답글이면 스레드 */
  where: string | null
  /** 받지 않은 까닭 (D160, D161) */
  why: string | null
  gone: boolean
}

/** PR 패널 (시나리오 10, D183): PR 요약, 항목, 머지 조건, 받은 커밋 */
export interface PrView {
  number: number
  url: string
  /** 앱이 마지막으로 읽은 원격 head */
  head: string
  /** 마지막으로 읽은 PR의 상태. 아직 읽지 못했으면 null */
  state: 'OPEN' | 'CLOSED' | 'MERGED' | null
  isDraft: boolean
  /** 닫힌 것을 읽어 자동 읽기를 멈췄다 (D179) */
  closed: boolean
  readAt: string | null
  /** 읽는 중이다 */
  reading: boolean
  /** 마지막 읽기의 오류 */
  error: string | null
  ci: CiState | null
  checks: PrCheckView[]
  /** reviewDecision (APPROVED, CHANGES_REQUESTED, REVIEW_REQUIRED). 없으면 null */
  reviewDecision: string | null
  /** mergeable (MERGEABLE, CONFLICTING, UNKNOWN) */
  mergeable: string | null
  sync: SyncKind | null
  items: PrItemView[]
  /** [머지]를 누를 수 있는지와 어긴 조건 (D176) */
  gate: { enabled: boolean; reasons: string[] }
  /** fast-forward로 받은 커밋 (D193) */
  synced: { at: string; commits: string[]; baseCommit: string | null }[]
  merged: { at: string; head: string; method: MergeMethod | null; outside: boolean } | null
  /** [머지 없이 끝내기]를 누른 때 */
  ended: string | null
  /** 머지 뒤 정리 창을 아직 열지 않았다. 사람이 이 Work를 보면 연다 (D178, D200) */
  offerClean: boolean
  /** PR 진행을 시작할 때의 gh 버전 (D198) */
  ghVersion: string | null
  /** [대응 시작] (시나리오 10-3, D170, D182): 누를 수 있는지와 까닭, 누르면 넣을 새 항목 */
  respond: { enabled: boolean; reason: string | null; items: string[] }
  /** 자동 대응 (D154, D169, D171): 설정, 사람 손 없이 이어진 라운드와 상한, 멈춤 */
  auto: AutoRespondView
  /**
   * [실패한 체크 다시 실행] (D175, D203): 지금 head에서 실패한 Actions 체크의 실행. 없으면 null이고 버튼을 보이지 않는다.
   * others는 Actions 밖의 실패한 체크다(사람이 한다)
   */
  rerun: {
    enabled: boolean
    reason: string | null
    runs: number[]
    checks: string[]
    others: string[]
  } | null
  /** 대응 라운드 기록 (화면 구성의 PR 패널): 라운드마다 task, 항목, push한 커밋, 게시한 답글 */
  rounds: RoundView[]
  /** PR 요약의 글: 상태, CI, 리뷰, 충돌, 로컬 Work 브랜치와의 비교. 아직 읽지 못한 것은 null */
  labels: {
    state: string | null
    ci: string | null
    review: string | null
    mergeable: string | null
    sync: string | null
  }
}

/**
 * 자동 대응 (D154, D169, D171, D183): 대응 자동 시작과 PR 대응 자동 승인이 켜졌는지와 어디서 정했는지, 사람 손 없이 이어진
 * 라운드와 상한, 상한에 닿아 멈췄는지. PR 패널에 보인다
 */
export interface AutoRespondView {
  /** 대응 자동 시작이 켜져 있다 (D154) */
  start: boolean
  /** 대응 자동 시작을 Work 설정으로 정했다. 아니면 앱 설정을 따른다 (D72) */
  startFromWork: boolean
  /** PR 대응의 자동 승인이 켜져 있다 (D169) */
  approve: boolean
  /** PR 대응의 자동 승인을 Work 설정으로 정했다. 아니면 앱 설정을 따른다 (D72) */
  approveFromWork: boolean
  /** 사람 손 없이 이어진 라운드 수 (D171) */
  rounds: number
  /** 상한 (respond_auto_round_max) */
  max: number
  /** 상한에 닿아 자동 시작을 멈췄다: 받은 새 항목이 있는데 시작하지 않는다 (배지 "자동 대응 멈춤", D183) */
  paused: boolean
  /** 패널에 보일 한 줄 */
  text: string
}

/** 대응 라운드 하나 (화면 구성의 PR 패널, D193, D194, D205) */
export interface RoundView {
  round: number
  taskId: string
  /** "07 PR 대응" */
  label: string
  /** 도는 중(대응 task가 끝나지 않음), 실패(push나 게시), push를 미룸(D193), 게시함 */
  state: 'running' | 'failed' | 'deferred' | 'published'
  /** 도는 중이면 task 상태, 아니면 상태의 설명 */
  stateLabel: string
  items: { id: string; kindLabel: string; title: string }[]
  instruction: string | null
  /** push한 때와 커밋(새것이 먼저). 없으면 null */
  pushed: { at: string; commits: string[] } | null
  /** push를 미룬 이 라운드를 함께 push한 뒤 라운드의 task (D193) */
  pushedWith: string | null
  /** 게시했거나 게시할 답글. url은 게시한 코멘트, skipped는 건너뛴 까닭이다 (D205) */
  replies: { item: string; url: string | null; skipped: string | null }[]
  publishedAt: string | null
  failure: { stage: string; error: string } | null
}

/** 머지 창 (D176, D177): 레포가 허용하는 방식, 기본 선택, 머지할 head */
export interface MergeInfo {
  head: string
  methods: MergeMethod[]
  /** 기본 선택: 프로젝트 설정이 허용되면 그것, 아니면 허용하는 첫 방식(merge, squash, rebase 차례) */
  preferred: MergeMethod | null
  gate: { enabled: boolean; reasons: string[] }
  /**
   * "판정표는 대응 전 코드 기준" 경고 (D180, D206): 커밋을 push한 대응 라운드 수와 fast-forward로 받은 원격 커밋 수.
   * 머지할 head가 verify가 본 코드면 null이다
   */
  stale: { rounds: number; synced: number } | null
  /** 경고와 함께 보일 verify의 판정표 (시나리오 7-3) */
  verdicts: Verdict[]
}

export type MergeInfoResult = { ok: true; info: MergeInfo } | { ok: false; error: string }

/** 머지 창의 [머지]. head는 창에 보인 커밋이다 (D176) */
export interface MergeInput {
  method: MergeMethod
  head: string
}

/** PR 패널의 항목 조작: [제외], [다시 넣기], [받기] (D160, D161, D170, D189) */
export type PrItemAction = 'exclude' | 'include' | 'accept'

/**
 * PR 패널의 [대응 시작] (시나리오 10-3, D170, D182). items는 사람이 본 새 항목이다: 그사이 바뀌었으면 받지 않는다.
 * instruction은 사람 지시이고 비어 있어도 된다(항목이 있을 때)
 */
export interface RespondStartInput {
  items: string[]
  instruction: string
}

// ---------- 사이드바 배지 (core/approval, D80) ----------

export type BadgeKind =
  | 'recovery'
  | 'asking'
  | 'awaiting_approval'
  | 'blocked'
  | 'stopped'
  | 'auto_paused'
  | 'pr_items'
  | 'pr_closed'
  | 'mergeable'
  | 'session_ended'
  | 'working'
  | 'idle'
  | 'queued'
  | 'pr_waiting'
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
  /** 점검한 gh 버전 (D198). 모르면 null */
  ghVersion: string | null
  /** 프로젝트 설정 (5.1.2, D185) */
  allowedBots: string[]
  mergeMethod: MergeMethod | null
}

export interface TaskView {
  id: string
  /** 이 task 터미널의 키 */
  terminal: string
  node: TaskNode
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
  /** 앱이 꺼져 세션이 끝났다 (D219). 다시 열면 false다 */
  appEnded: boolean
  /** task를 띄우지 못한 이유 */
  error: string | null
  /** 마지막 형식 검사의 오류 수 */
  errorCount: number
  /** 형식 오류 되돌림의 연속 횟수 (D21, D107) */
  bounces: number
  /** 자동 승인 카운트다운 (4.3, D83, D127). 카운트다운 중이 아니면 null */
  countdown: CountdownView | null
  /**
   * 진행 표시 (D216): 작업 중인 task의 경과 시간과 마지막 동작. 작업 중이 아니면 null. 도구 훅으로 바뀐 것은 스냅샷을
   * 기다리지 않고 onActivity로 따로 온다
   */
  activity: ActivityView | null
}

/**
 * 진행 표시 (D216). 시각은 Date.now()와 같은 ms이고, 렌더러가 경과 시간을 센다. 훅으로만 알고 터미널은 읽지 않는다 (D2)
 */
export interface ActivityView {
  /** 첫 턴(UserPromptSubmit)이 시작했다. 아니면 세션을 띄우는 중이다 */
  turn: boolean
  /** 턴이 시작한 때. 세션을 띄우는 중이면 task를 만든 때다 */
  since: number
  /** 이번 턴의 마지막 도구. 아직 없으면 null */
  tool: ToolActivityView | null
}

export interface ToolActivityView {
  /** 도구 이름과 짧은 인자. 예: "Bash(npm test)" */
  label: string
  /** PreToolUse를 받은 때 */
  startedAt: number
  /** PostToolUse를 받은 때. 실행 중이면 null */
  endedAt: number | null
}

/** 도구 훅으로 바뀐 진행 표시 (D216). 이 Work의 다음 스냅샷이 오면 스냅샷의 값을 쓴다 */
export interface ActivityUpdate {
  workKey: string
  taskId: string
  activity: ActivityView | null
}

/** 자동 승인 카운트다운. 승인 화면에 남은 초와 [취소]를 보인다 (D83) */
export interface CountdownView {
  /** 카운트다운 초 */
  seconds: number
  /** 끝나는 때 (Date.now()와 같은 ms). 렌더러가 남은 초를 센다 */
  endsAt: number
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
  /** Work를 완료한 때. 보관된 Work가 완료였는지도 이것으로 안다 */
  completedAt: string | null
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
  /** 단계 선택 대화상자의 단계 (6.2, 6.3, D82) */
  steps: StepChoice[]
  /** 마지막 전달 결과 (시나리오 7) */
  delivery: DeliveryView | null
  /** PR 진행 (시나리오 10). [PR 생성]이 성공한 Work에 있다 */
  pr: PrView | null
  /** 정리 세션 ([AI 세션 열기], 7-5) */
  cleanup: CleanupView | null
  /** 끊긴 작업 (시나리오 9-4, D121~D123). 있으면 [다시 시도]·[무시]만 받는다 */
  operation: OperationView | null
  /** 재시작 때와 실행 중의 알림: 끝낸 고아 프로세스, 앱 밖에서 바뀐 파일 (D76, D121, D124) */
  notices: NoticeView[]
  tasks: TaskView[]
  /** 지금 task의 id */
  current: string | null
  /** 할 일을 실행하다 난 오류 */
  problems: string[]
  /** 바뀔 때마다 오른다. 렌더러는 이 값이 바뀌면 승인 화면을 다시 불러온다 */
  revision: number
}

/** 끊긴 작업의 알림 (시나리오 9-4, D121~D123): 무엇이 어디서 끊겼는지와 [다시 시도]·[무시]가 할 일 */
export interface OperationView {
  kind: 'rewind' | 'deliver' | 'clean' | 'merge' | 'respond'
  title: string
  lines: string[]
  /** [다시 시도]가 할 일 */
  retry: string
  /** [무시]가 할 일 */
  ignore: string
  /** 끊긴 전달의 선택. [다시 시도]가 커밋 안 된 변경을 돌려주면 선택지를 이 이름으로 보인다 (7-5) */
  choice: DeliveryChoice | null
}

/**
 * 재시작 때와 실행 중의 알림 (D121): 끝낸 고아 프로세스(D76, D126), 앱 밖에서 바뀐 앱 소유 파일과
 * work.json(D124). [확인]으로 닫는다. 바뀐 앱 소유 파일은 [확인]하면 지금 내용을 받아들인다
 */
export interface NoticeView {
  id: string
  kind: 'orphans' | 'files' | 'work_json'
  title: string
  lines: string[]
  /** [확인]이 할 일과 앱이 한 일 */
  hint: string
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
  /** [단계 선택] (6.2) */
  selectStep: boolean
  /** [이 단계 끝나면 멈춤] */
  stopAfter: boolean
  /** [Work 포기] */
  abandon: boolean
  /** [Work 정리]: 완료나 포기한 Work (시나리오 8) */
  clean: boolean
}

// ---------- 단계 선택 (6.2, 6.3, D82) ----------

/** 되감기(고른 단계가 지금 단계 이하) 또는 건너뛰기(지금 단계보다 뒤) (6.2) */
export type StepKind = 'rewind' | 'skip'

/** 단계 선택 대화상자의 한 단계. 파이프라인 차례로 보인다 */
export interface StepChoice {
  node: NodeName
  /** "수정(fix)" */
  title: string
  kind: StepKind
  /** 고를 수 있다. 아니면 why가 이유다 (6.3: 의도 승인 전에는 intake만) */
  allowed: boolean
  why: string | null
  /** 지금 단계 */
  current: boolean
  /** 에이전트가 추천한 이전 단계 (D23) */
  recommended: boolean
}

/** 미리 본 때의 지금 task(6.2의 k)와 그 task가 끝났는지. [확인]에 함께 보내 그 사이 바뀌었으면 받지 않는다 */
export interface StepExpect {
  taskId: string
  done: boolean
}

/** 폐기될 task와 그 산출물 (D82) */
export interface DiscardView {
  taskId: string
  /** "04 수정" */
  label: string
  /** 산출물 파일 이름 (D89: context.md와 handoff.md는 뺀다) */
  artifacts: string[]
}

/**
 * 고른 단계의 결과 (D82): 폐기될 산출물, 되돌릴 커밋 수와 커밋 안 된 변경과 백업 브랜치, 건너뛸 단계,
 * 진행 중인 task를 중단하는지. core가 계산하고 main이 git에서 읽은 것을 더한다.
 */
export interface StepPreview {
  node: NodeName
  title: string
  kind: StepKind
  /** 새 task의 머리 띠 이유: 되감기, 건너뛰기, 기본 진행 */
  reason: string
  expect: StepExpect
  /** 진행 중인 task를 중단한다는 안내. 없으면 null */
  interrupt: string | null
  discard: DiscardView[]
  /** 건너뛸 단계의 화면 이름 */
  skipped: string[]
  code: {
    /** reset: 되돌린다, keep: [현재 코드 위에서 이어서], none: 되돌리지 않는다 */
    kind: 'reset' | 'keep' | 'none'
    /** 되돌릴 커밋 */
    to: string | null
    /** 되돌릴 커밋 수 */
    commits: number
    /** 커밋 안 된 변경 (git status). reset이면 백업에 넣고 지운다 (D116) */
    uncommitted: string[]
    /** 만들 백업 브랜치 (D115). 되돌릴 것이 없으면 null */
    backupBranch: string | null
  }
  /** fix로 되감을 때 [현재 코드 위에서 이어서]를 고를 수 있다 (6.2) */
  keepCodeOffered: boolean
  /** intake로 되감으면 intent 새 버전을 만든다는 안내 (D40) */
  intent: string | null
}

/** 미리 보기의 결과. 고를 수 없는 단계거나 git을 읽지 못하면 오류다 */
export type StepPreviewResult = { ok: true; preview: StepPreview } | { ok: false; error: string }

/** [단계 선택]의 [확인] (6.2) */
export interface SelectStepInput {
  node: NodeName
  /** fix로 되감을 때 [현재 코드 위에서 이어서] */
  keepCode: boolean
  /** 사람 추가 지시(선택) */
  instruction: string
  expect: StepExpect
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
  node: TaskNode
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
  /**
   * 자동 승인 안내 (4.2, 4.3, D128~D131). on은 지금 설정으로 자동 승인이 켜진 단계인지, hold는 켜진 단계의 승인
   * 대기인데 카운트다운하지 않는 까닭이다. 카운트다운은 TaskView.countdown이다
   */
  autoApprove: { on: boolean; hold: string | null }
  /** verify: Work 완료 화면 (시나리오 7-3, D119, D120) */
  completion: Completion | null
  /** PR 대응 task의 승인 화면 (D172, D207). 대응 task가 아니면 null */
  respond: RespondReview | null
}

/**
 * PR 대응 task의 승인 화면 (화면 구성의 승인 화면, D172, D180, D202, D207): 이번 라운드의 항목과 사람 지시, 항목별 결과,
 * 게시될 모양의 답글, 함께 게시할 미룬 앞 라운드, 승인 뒤 실패한 push나 게시. 기존 테스트 변경은 강조 영역에 있다
 */
export interface RespondReview {
  round: number
  instruction: string | null
  items: { id: string; kindLabel: string; title: string }[]
  /** response.md의 `## 항목별 결과`. 없으면 null */
  results: string | null
  /**
   * 게시될 모양의 답글 (D207): 어디에 달리는지와 본문(원래 코멘트 링크, 초안, 표시 문구. 보이지 않는 표시는 뺌). 이미
   * 게시했으면 url, 건너뛰었으면 그 까닭이다 (D194, D205)
   */
  replies: {
    item: string
    where: string
    body: string
    url: string | null
    skipped: string | null
  }[]
  /** 함께 push하고 답글을 게시할, push를 미룬 앞 라운드 (D193) */
  deferred: string[]
  /** 승인 뒤 실패한 push나 게시. 있으면 [승인]은 [다시 시도]다 */
  failure: { stage: string; error: string } | null
  /** 지금 승인할 수 없는 까닭(PR이 닫힘, D179). 있으면 [승인]이 꺼진다 */
  blocked: string | null
}

/** Work 완료 화면: 판정표, 전체 Work의 변경(기준 커밋 → 작업 트리), 전달 선택 (시나리오 7-3) */
export interface Completion {
  verdicts: Verdict[]
  diff: string
  /**
   * 누를 버튼. deliver는 전달 버튼([완료만], [push], [PR 생성])이고, stop은 승인하면 Work가 멈추므로
   * [승인하고 멈춤] 하나다(이전 단계 추천 D23, [이 단계 끝나면 멈춤], D119). null이면 누를 버튼이 없다
   */
  mode: 'deliver' | 'stop' | null
  /** verify에서 멈춘 Work다. 이때 [완료만]은 멈춘 Work의 [재개]다 (D119) */
  stopped: boolean
  /** 전달 버튼을 누를 수 있는지와 이유 (7-4, D67, D118) */
  buttons: DeliveryButtons
  /** 마지막 전달 결과. 실패면 오류와 [다시 시도]·[전달 없이 완료]를 보인다 (D120) */
  delivery: DeliveryView | null
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
  /** Work별 설정 (D72): 단계별 자동 승인과 스킬별 질문 방식. 없는 것은 앱 설정을 따른다 */
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
