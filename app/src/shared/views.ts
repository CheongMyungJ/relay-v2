// 렌더러로 보내는 스냅샷과 조회 결과 (I14). main이 core로 계산하고, 화면은 받은 것을 그리기만 한다.
import type { WorkSettings } from './config'
import type { Decision, HandoffStatus, TaskNode } from './contracts'
import type { PendingQuestionView } from './questions'
import type { PrItemKind, PrItemStatus } from './pr'
import type { DraftRef, ParsedDraft } from './session'
import type {
  ApprovedIntent,
  CustomStep,
  CustomTypeDef,
  CustomTypeSource,
  DeliveryChoice,
  FormatIssue,
  MergeMethod,
  TaskStatus,
  TypeSource,
  TypeTarget,
  UncommittedAction,
  WorkDriver,
  WorkStatus,
  WorkType,
} from './work'

// ---------- 승인 판정과 승인 화면 (core/approval, core/review) ----------

export interface ApprovalGate {
  /** [승인]. 유효한 awaiting_approval handoff가 있다 (4.1) */
  approve: boolean
  /** [오류 무시하고 승인]. 확인 창을 거친다 (4.1, D112) */
  force: boolean
  /** 형식 오류 */
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
  | 'submodule_changes'
  | 'submodule_guard'
  | 'main_changes'
  | 'format_errors'

/** 승인 화면 강조 영역의 한 항목. 사람이 봐야 할 것만 모은다 (D83) */
export interface Emphasis {
  kind: EmphasisKind
  title: string
  lines: string[]
  /** 사람이 할 일. 열린 질문은 어디에 답하는지다 (D222) */
  hint?: string
}

/**
 * [요약] 탭 맨 위에 둘 이 단계의 핵심 (D223): 의도 정리는 intent 초안의 목표·비목표·완료조건, 원인 분석과 수정은
 * 원인, 리뷰와 검증은 리뷰 지적과 반영이다
 */
export interface StageLead {
  title: string
  /** 절마다 제목과 본문(마크다운) */
  sections: { title: string; text: string }[]
}

/** 작업 브랜치의 커밋 (D225). Work 완료 화면과 완료 알림에 보인다 */
export interface BranchInfo {
  /** 작업 브랜치 (D425) */
  name: string
  /** 기준 커밋 뒤의 커밋 수 */
  ahead: number
  /** 마지막 커밋의 짧은 해시와 제목. 기준 뒤 커밋이 없으면 null */
  last: { sha: string; subject: string } | null
  /** worktree 경로. [Work 정리]로 지웠으면 null */
  worktree: string | null
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
  engineLabel?: string
  notice?: string
  question?: PendingQuestionView
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

/** 곁 세션 (시나리오 11, D385~D390): 사람이 언제든 여는 Claude Code 세션. task가 아니다 */
export interface SideView {
  /** 이 세션 터미널의 키. 연 적이 없으면 null이다 */
  terminal: string | null
  /** 살아 있음, 끝남. 연 적이 없으면 null이다 (앱을 다시 켜도 없음) */
  status: 'live' | 'ended' | null
  /** 엔진 이름. 열린 곁 세션은 그 엔진, 아니면 열 때 쓸 설정의 엔진이다 (D391) */
  engineLabel: string
  /** Codex 곁 세션의 안내가 아직 대화에 들어가지 않았을 때의 안내 (훅 신뢰, 다시 열기) */
  notice?: string
  /** 이어 갈 대화가 있다 (D389). [곁 세션 열기]가 --resume으로 잇는다 */
  resumable: boolean
  /** 열 수 없는 까닭 (보관된 Work). 열 수 있으면 null */
  blocked: string | null
}

/** [push]·[PR 생성] (시나리오 7-4, 7-5) */
export interface DeliverInput {
  choice: DeliveryChoice
  /**
   * 커밋 안 된 변경의 처리. expect는 사람에게 보인 변경 목록이다. 그 사이 바뀌었으면 받지 않고
   * 지금 목록을 다시 돌려준다. 변경이 없으면 null이다
   */
  uncommitted: { action: UncommittedAction; expect: string[] } | null
  /**
   * 묶음 Work의 레포마다 고른 전달 (D477, D478). 메인은 path ''다. 있으면 choice와 uncommitted 대신 이것과
   * repoUncommitted를 따른다
   */
  repos?: { path: string; choice: DeliveryChoice | null; link?: boolean }[]
  /** 묶음 Work의 레포마다 커밋 안 된 변경의 처리 (D475). expect는 사람에게 보인 그 레포의 변경이다 */
  repoUncommitted?: { path: string; action: UncommittedAction; expect: string[] }[]
}

/**
 * 전달의 결과. 커밋 안 된 변경이 있어 사람이 골라야 하면 uncommitted에 변경 목록을 준다 (7-5). 묶음 Work는 보낼 레포마다
 * repoUncommitted에 준다 (D475). 전달이 실패하면 error이고, 실패는 Work 완료 화면에도 남는다 (D120)
 */
export type DeliverResult =
  | { ok: true }
  | {
      ok: false
      error: string
      uncommitted?: string[]
      repoUncommitted?: { path: string; label: string; lines: string[] }[]
    }

/** 정리를 확인한 때의 사실. [정리]에 함께 보내 그 사이 바뀌었으면 받지 않는다 */
export interface CleanExpect {
  uncommitted: string[]
  locks: string[]
  live: number
  backups: string[]
  /** origin에 작업 브랜치가 있었다 (머지로 완료한 Work만, D178) */
  remote: boolean
  /** 작업 브랜치에만 있는 커밋(머지한 PR에 없는 것, D329) */
  lost: string[]
  /** 체크아웃된 서브모듈 (D382) */
  submodules: string[]
  /** 메인 통합 검증 worktree의 메인 쪽 변경 (D416). 없으면 없다 */
  integration?: string[]
  /** 묶음 Work의 서브모듈마다 확인한 것 (D482). 없으면 없다 */
  repos?: {
    path: string
    uncommitted: string[]
    locks: string[]
    remote: boolean
    lost: string[]
  }[]
}

/** [Work 정리]의 확인 요약 (시나리오 8-1) */
export interface CleanPreview {
  /** worktree가 있다 */
  worktree: boolean
  /** 커밋 안 된 변경. 백업 없이 지운다 */
  uncommitted: string[]
  /** worktree의 git 폴더에 남은 잠금 파일(index.lock 등) */
  locks: string[]
  /** 체크아웃된 서브모듈. 그 안의 작업도 함께 지우고, git이 요구해 --force로 지운다 (D382) */
  submodules: string[]
  /** 이 앱에서 살아 있는 세션. 정리하면 트리째 끝낸다 */
  live: number
  branch: {
    name: string
    exists: boolean
    /** origin의 같은 이름 브랜치(원격 추적 브랜치)에 있다 */
    pushed: boolean
    /** 기준 브랜치(로컬이나 origin)에 머지됐다 */
    merged: boolean
    /**
     * 지울 수 있다: push됐거나 머지됐거나, PR을 머지한 Work에서 머지한 PR의 커밋을 로컬에서 찾았다(D329). 기본은
     * 유지다(머지로 완료한 Work는 잃을 커밋이 없으면 기본 체크, D178)
     */
    deletable: boolean
    /** 작업 브랜치에만 있는 커밋: PR을 머지한 Work에서 머지한 PR head에 없는 것. 지우려면 잃는 것을 확인한다 (D329) */
    lost: { sha: string; subject: string }[]
    /**
     * 이 브랜치를 머지 대상으로 쓰는, PR을 만들기 전의 다른 Work (D428). 있으면 로컬과 origin의 브랜치를 지우지 않는다.
     * 예전 기록에는 없다
     */
    stacked?: string[]
  }
  /** 되감기 백업 브랜치 (D115). "함께 삭제"의 기본은 체크다 */
  backups: string[]
  /** 머지로 완료한 Work다. 작업 브랜치 삭제가 기본으로 체크된다 (D178) */
  merged: boolean
  /**
   * origin의 작업 브랜치 (D178). 머지로 완료한 Work만 삭제를 고를 수 있고 기본은 끈다. 머지로 완료하지 않았으면 null
   */
  remote: { name: string; exists: boolean } | null
  /**
   * 서브모듈 Work의 메인 통합 검증 worktree (D416): 그 폴더와 메인 쪽 변경(전달 안 됨). 서브모듈 worktree를 지운 뒤
   * --force로 지운다. 없으면 null
   */
  integration: { root: string; changes: string[] } | null
  /**
   * 묶음 Work의 서브모듈마다 (D482): 메인 worktree보다 먼저 지운다. 작업 브랜치와 origin의 브랜치 지우기는 레포마다 고른다.
   * 묶음 Work가 아니면 없다
   */
  repos?: RepoCleanPreview[]
  /** 사람이 명시적으로 확인해야 하는 것. 비어 있지 않으면 확인해야 [정리]를 누를 수 있다 */
  confirm: string[]
  expect: CleanExpect
}

/** 묶음 Work의 서브모듈 하나의 정리 (D482) */
export interface RepoCleanPreview {
  path: string
  /** 그 서브모듈 worktree가 있다 */
  worktree: boolean
  uncommitted: string[]
  locks: string[]
  /** 작업 브랜치: 메인과 같은 모양이다 (CleanPreview.branch) */
  branch: CleanPreview['branch']
  /** 머지로 끝난 그 레포의 PR이 있으면 origin의 작업 브랜치 (D178). 아니면 null */
  remote: { name: string; exists: boolean } | null
  /**
   * 메인 PR이 아직 이 작업 브랜치에만 있는 커밋을 가리킨다 (D482). origin의 브랜치를 지우면 메인 PR이 가리키는 커밋을 받을 수
   * 없게 되어 경고한다
   */
  pointed: boolean
}

export type CleanPreviewResult = { ok: true; preview: CleanPreview } | { ok: false; error: string }

/** [등록 해제] 창 (D408): main이 core 규칙으로 정한 막는 까닭과 함께 지울 Work 수 */
export interface ProjectRemovePreview {
  /** 막는 까닭. 해제할 수 있으면 null */
  block: string | null
  /** 함께 지울 Work 기록 수 */
  works: number
  /** 그 가운데 아카이브로 옮긴 것 */
  shelved: number
}

export type ProjectRemovePreviewResult =
  { ok: true; preview: ProjectRemovePreview } | { ok: false; error: string }

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
  /** 작업 브랜치를 지울 때 그 브랜치에만 있는 커밋을 잃는 것을 확인했다 (D329) */
  confirmLost?: boolean
  expect: CleanExpect
  /** 묶음 Work의 서브모듈마다 고른 것 (D482). 없는 레포는 브랜치를 지우지 않는다 */
  repos?: { path: string; deleteBranch: boolean; deleteRemote?: boolean; confirmLost?: boolean }[]
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
  /** PR 카드 (D480): 서브모듈 PR이면 그 경로, 메인 PR이면 '' */
  repo: string
  /**
   * 메인 PR이 머지된 커밋을 가리키지 않는 서브모듈 (D481): 그 서브모듈 PR을 squash·rebase로 머지했다. [서브모듈 커밋 맞추기]를
   * 보인다. 메인 PR이 아니거나 없으면 빈 목록이다
   */
  relink: string[]
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
  /** 묶음 Work의 서브모듈 PR 카드 (D480). 메인 PR이면 없다 */
  repo?: string
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
  /** 묶음 Work의 서브모듈 PR 카드 (D480). 메인 PR이면 없다 */
  repo?: string
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
  | 'reviewing'
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
  /** 이슈 기록이 켜져 있다 (D337) */
  issueLog: boolean
  /** 작업 브랜치 이름 규칙 (D426). 설정하지 않았으면 기본 규칙이다 */
  branchRule: string
  /** 규칙에 {slug}가 있다: 새 Work 대화상자에 짧은 이름 칸을 보인다 (D426) */
  branchSlug: boolean
  /** 서브모듈 프로젝트의 메인 프로젝트 id와 그 안의 경로 (D413). 메인 프로젝트면 null */
  parent: { id: string; path: string } | null
  /** 서브모듈 경로마다의 설정 (D483). 빈 목록과 null은 메인의 값을 쓴다 */
  submodules: Record<string, { allowedBots: string[]; mergeMethod: MergeMethod | null }>
}

/** 묶음 Work의 서브모듈 하나 (D470, D471) */
export interface RepoView {
  path: string
  baseBranch: string
  baseCommit: string
  /** 머지 대상 (D428). 고르지 않았으면 기준 브랜치다 */
  targetBranch: string
  /** 그 서브모듈 worktree의 폴더: 메인 worktree 안의 그 자리 */
  worktree: string
  /** 이 레포의 마지막 전달 결과 (D477) */
  delivery: DeliveryView | null
}

/** 새 Work 대화상자의 대상 목록에 보이는 서브모듈 (D413) */
export interface SubmoduleView {
  name: string
  path: string
  /** 메인 체크아웃에 받아 두었다. 아니면 고를 때 앱이 받는다 */
  initialized: boolean
  /** 이 서브모듈의 프로젝트. 아직 고른 적이 없으면 null */
  projectId: string | null
}

export interface TaskView {
  question?: PendingQuestionView
  /** 사용 엔진과 CLI 버전. 이전 스냅샷 호출자의 호환을 위해 생략 가능하다. */
  engineLabel?: string
  engineVersion?: string | null
  id: string
  /** 이 task 터미널의 키 */
  terminal: string
  node: TaskNode
  /** "02 원인 분석과 수정" (D109) */
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
  /** 세션 기록이 있다. 없으면(띄우다 실패함 등) [재개]는 이 단계를 새 세션으로 시작한다 (D218) */
  hasSession: boolean
  /** 세션은 있지만 대화 ID를 받지 못했다(Codex). 같은 대화를 다시 열 수 없다 (engines.md 4.3) */
  sessionUnknown: boolean
  /** task를 띄우지 못한 이유 */
  error: string | null
  /** 마지막 형식 검사의 오류 수 */
  errorCount: number
  /** 형식 오류 되돌림의 연속 횟수 (D21, D107) */
  bounces: number
  /** 되돌린 뒤 에이전트가 형식을 고치는 동안의 안내 (D220). 아니면 null */
  bounceNotice: string | null
  /** 자동 승인 카운트다운 (4.3, D83, D127). 카운트다운 중이 아니면 null */
  countdown: CountdownView | null
  /**
   * 진행 표시 (D216): 작업 중인 task의 경과 시간과 마지막 동작. 작업 중이 아니면 null. 도구 훅으로 바뀐 것은 스냅샷을
   * 기다리지 않고 onActivity로 따로 온다
   */
  activity: ActivityView | null
  /**
   * 마무리 단계의 독립 리뷰 (D495, D496): running은 리뷰가 도는 중, ready는 끝났지만 결과로 세션을 아직 다시 열지 않음(앱을
   * 다시 켰거나 다시 열지 못함. [재개]가 결과를 첫 입력으로 준다). 그 밖에는 null. codeReview는 그때의 설정이다 (D497)
   */
  review?: { state: 'running' | 'ready'; codeReview: boolean } | null
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
  /**
   * 독립 리뷰 중(D502)이면 지금 호출의 이름("찾기", "확인"). since는 그 호출을 시작한 때이고 tool은 그 호출의 마지막
   * 도구다. 작업 중인 task는 없다
   */
  phase?: string
  /** 독립 리뷰 중의 최근 도구 (오래된 것부터, 지금 것을 빼고). Codex는 도구를 받지 않아 없다 */
  recent?: readonly string[]
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
  /** 업무 유형 (D236). work.json에 없으면 버그 수정이다 (D256) */
  type: WorkType
  /** 커스텀 Work의 유형 (D458): 이름, 출처, 단계와 단계마다의 자동 승인 기본값. 아니면 null */
  customType: {
    id: string
    name: string
    source: CustomTypeSource
    steps: { id: string; title: string; autoApprove: boolean }[]
  } | null
  /** 요청의 첫 줄 */
  title: string
  /** Work를 진행하는 쪽 (D519). caller면 패널에 띠와 [직접 맡기]를 보이고 승인·답·전달 버튼을 끈다 (D523) */
  driver: WorkDriver
  status: WorkStatus
  statusLabel: string
  /** Work를 완료한 때. 보관된 Work가 완료였는지도 이것으로 안다 */
  completedAt: string | null
  /** 보관된 Work를 사이드바의 공통 아카이브로 옮겼다 */
  shelved: boolean
  /** 우클릭 메뉴에 [아카이브로 옮기기]를 보인다 (core/machine canShelve) */
  canShelve: boolean
  /** 우클릭 메뉴에 [기록 지우기]를 보인다 (core/cleanup canDelete, D407) */
  canDelete: boolean
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
  /** 작업 브랜치 (D425) */
  branch: string
  /** 머지 대상 브랜치 (D428). 고르지 않았으면 기준 브랜치다 */
  targetBranch: string
  /** 머지 대상을 바꿀 수 있다: PR을 만들기 전의 진행 중이거나 멈춘 Work다 */
  canSetTarget: boolean
  /** 메인 통합 검증 worktree (D414): 메인 레포의 기준 브랜치, 고정한 커밋, 그 폴더. 없으면 null */
  integration: { baseBranch: string; baseCommit: string; root: string } | null
  /**
   * 묶음 Work (D470): 함께 고치는 서브모듈. 메인 레포만 고치는 Work면 빈 목록이다. 이전 스냅샷 호출자의 호환을 위해 생략할 수
   * 있다
   */
  repos?: RepoView[]
  /** 메인 레포를 고르지 않은 묶음 Work (D470). 메인 worktree는 기준 커밋에 고정되어 있다 */
  mainFixed?: boolean
  /** [레포 추가]로 더할 수 있다 (D473): 메인 프로젝트의 진행 중이거나 멈춘 Work다 */
  canAddRepo?: boolean
  intent: ApprovedIntent | null
  /** 멈춘 이유: [이 단계 끝나면 멈춤]. 이전 단계 추천(D23)은 D418 전 기록이다 */
  stopNotice: string | null
  /** 멈춘 Work에서 [재개]가 할 일 (3.3) */
  stopHint: string | null
  /** 마지막 전달 결과 (시나리오 7) */
  delivery: DeliveryView | null
  /** PR 진행 (시나리오 10). [PR 생성]이 성공한 Work에 있다 */
  pr: PrView | null
  /** 묶음 Work의 서브모듈 PR 카드 (D480). 없으면 빈 목록이다. 이전 스냅샷 호출자의 호환을 위해 생략할 수 있다 */
  prs?: PrView[]
  /** 정리 세션 ([AI 세션 열기], 7-5) */
  cleanup: CleanupView | null
  /** 곁 세션 (시나리오 11) */
  side: SideView
  /** 이 Work의 task와 곁 세션이 쓴 Work 초안 (D421). 오른쪽 패널 맨 위에 카드로 보인다 */
  drafts: DraftView[]
  /** 끊긴 작업 (시나리오 9-4, D121~D123). 있으면 [다시 시도]·[무시]만 받는다 */
  operation: OperationView | null
  /** 이슈 기록 (설계 3.7). 이슈 기록이 켜진 프로젝트에서 만든 Work에 있다 */
  issue: IssueView | null
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

/** 이슈 기록 (설계 3.7, D344): 패널의 이슈 줄 */
export interface IssueView {
  /** 이슈 번호와 주소. 새 이슈를 아직 만들지 못했으면 null이다 */
  number: number | null
  url: string | null
  /** 새 Work 대화상자에 적은 기존 이슈 (D338) */
  linked: boolean
  /** 아직 게시하지 못한 항목 수 */
  pending: number
  /** 게시하는 중 */
  publishing: boolean
  /** 마지막으로 실패한 게시. 있으면 [다시 시도]를 보인다 */
  failure: { at: string; error: string } | null
  /** 앱이 닫았다 (D346) */
  closed: boolean
}

/** 끊긴 작업의 알림 (시나리오 9-4, D121~D123): 무엇이 어디서 끊겼는지와 [다시 시도]·[무시]가 할 일 */
export interface OperationView {
  kind: 'rewind' | 'deliver' | 'clean' | 'merge' | 'respond'
  title: string
  lines: string[]
  /** [다시 시도]가 할 일. null이면 [다시 시도]가 없다: D418 전에 끊긴 되감기 (D424) */
  retry: string | null
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
  /** 멈춘 Work의 [재개] */
  resumeWork: boolean
  /** [이 단계 끝나면 멈춤] */
  stopAfter: boolean
  /** [Work 포기] */
  abandon: boolean
  /** [Work 정리]: 완료나 포기한 Work (시나리오 8) */
  clean: boolean
}

export interface AppSnapshot {
  projects: ProjectView[]
  works: WorkView[]
  /** 기본 세션 (D405). 최근에 만든 것이 앞이다 */
  sessions: SessionView[]
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
  /** [요약] 탭 맨 위의 이 단계 핵심 (D223). 의도 정리, 원인 분석과 수정, 리뷰와 검증만 있다 */
  lead: StageLead | null
  artifacts: Artifact[]
  /**
   * 독립 리뷰의 진행 기록 (D502): 호출마다 find.log, check.log. 산출물이 아니라 이슈 기록에는 넣지 않는다. 독립 리뷰를
   * 요청하지 않은 task는 없다
   */
  reviewLogs?: Artifact[]
  /** 이 task의 변경 (task 시작 커밋 → 작업 트리) */
  diff: string
  /**
   * 묶음 Work의 레포마다 이 task의 변경 (D475): 메인이 맨 앞이고 서브모듈이 뒤다. [변경] 탭이 레포를 고른다. 묶음 Work가
   * 아니면 없다(diff만 본다)
   */
  repoDiffs?: RepoDiffView[]
  /** 승인 버튼의 판정 (4.1) */
  gate: ApprovalGate
  /**
   * 자동 승인 안내 (4.2, 4.3, D128~D131). on은 지금 설정으로 자동 승인이 켜진 단계인지, hold는 켜진 단계의 승인
   * 대기인데 카운트다운하지 않는 까닭 또는 Codex 수동 승인 정책이다. 카운트다운은 TaskView.countdown이다
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
  /**
   * 설계 Work의 다시 볼 결정: verification.md `## 다시 볼 결정`의 본문. 판정표 아래에 보이고, 바꾸려면 [단계 선택]에서
   * 설계 문답으로 되감는다 (시나리오 7-3, D362, D365, I106). 다른 유형이거나 "없음"이면 null이다
   */
  revisit: string | null
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
  /** 작업 브랜치의 커밋 (D225). 브랜치가 없으면(정리로 지움) null */
  branch: BranchInfo | null
  /** 이 Work가 바꾼 지식 (D298). 지식 관리를 끄면 null */
  knowledge: KnowledgeChange[] | null
  /**
   * 묶음 Work의 레포마다 전달 (D475, D477, D478): 메인이 맨 앞이다. 있으면 전달 버튼 대신 레포마다 고르고 [전달]을 누른다.
   * 묶음 Work가 아니면 없다
   */
  repos?: RepoCompletion[]
  /**
   * 마무리 단계의 독립 리뷰 (D495, D497): ok(코드 리뷰와 확인을 함), off(코드 리뷰를 끔, 판정표만 확인), failed(호출이 실패함,
   * error에 까닭), none(리뷰를 받지 않고 승인할 수 있게 됨, 형식 오류를 무시한 때 등). 옛 Work의 verify는 null이다
   */
  review: { state: 'ok' | 'off' | 'failed' | 'none'; error?: string } | null
}

/** 묶음 Work의 승인 화면에서 레포 하나의 변경 (D475) */
export interface RepoDiffView {
  /** 서브모듈 경로. 메인은 '' */
  path: string
  label: string
  diff: string
}

/** 묶음 Work의 Work 완료 화면에서 레포 하나 (D475, D477, D478) */
export interface RepoCompletion {
  /** 서브모듈 경로. 메인은 '' */
  path: string
  label: string
  /** 이 Work가 고치는 레포다. 메인을 고르지 않은 Work의 메인은 아니다 */
  editable: boolean
  /** 기준 커밋부터의 변경 */
  diff: string
  /** 작업 브랜치의 커밋. 브랜치가 없으면 null */
  branch: BranchInfo | null
  /** 커밋 안 된 변경 */
  uncommitted: string[]
  /** 전달 버튼을 누를 수 있는지와 이유 (D477) */
  buttons: DeliveryButtons
  /** 이 레포의 마지막 전달 결과 */
  delivery: DeliveryView | null
  /** 메인이 이 서브모듈의 새 커밋을 가리키게 할지 물을 수 있다 (D478): 메인을 고친 Work의 서브모듈이다 */
  linkable: boolean
}

/** Work 완료 화면의 "이 Work의 지식" 한 줄 (D298) */
export interface KnowledgeChange {
  /** 레포 안의 경로 (`docs/knowledge/...`) */
  path: string
  /** added 새로 만듦, updated 고침(기준 브랜치나 머지 전 앞 Work에 있던 것), removed 지움 */
  change: 'added' | 'updated' | 'removed'
  /** 첫 `# ` 제목. 지웠으면 null */
  title: string | null
  /** 머리글의 kind. 없거나 지웠으면 null */
  kind: 'rule' | 'fact' | 'history' | 'pitfall' | null
  /** verify handoff의 줄에 적은 까닭이나 바뀐 내용 */
  note: string | null
  /** 머지 전 앞 Work의 항목을 다시 썼으면 그 Work id. diff는 그 Work의 글에서 본 것이다 */
  pendingFrom: string | null
  /** 이 파일의 diff */
  diff: string
}

// ---------- 명령 ----------

export type CommandResult = { ok: true } | { ok: false; error: string }

/** Work 생성 결과. 만든 Work의 키를 돌려준다 */
export type CreateWorkResult = { ok: true; workKey: string } | { ok: false; error: string }

// ---------- [파일] 탭 (D464~D468) ----------

/** 트리의 항목 하나. other는 worktree 밖을 가리키거나 깨진 링크, 파일도 폴더도 아닌 것이라 열지 않는다 */
export interface FileEntryView {
  name: string
  kind: 'dir' | 'file' | 'other'
}

/** 폴더 하나의 항목 (D465). more는 상한(DIR_MAX_ENTRIES)을 넘어 보이지 않는 개수다 */
export type FileListResult =
  { ok: true; entries: FileEntryView[]; more: number } | { ok: false; error: string }

/**
 * 연 파일 (D466). text는 줄 끝을 `\n`으로 바꾼 글이고 hash는 디스크의 바이트로 계산한다(저장할 때 바뀌었는지 본다).
 * 글이 아니거나 너무 큰 파일은 크기만 돌려준다
 */
export type FileReadResult =
  | { ok: true; kind: 'text'; text: string; hash: string }
  | { ok: true; kind: 'binary' | 'large'; size: number }
  | { ok: false; error: string }

/** 저장 결과 (D467). 연 뒤 파일이 바뀌었으면 conflict다 */
export type FileSaveResult =
  { ok: true; hash: string } | { ok: false; error: string; conflict?: boolean }

/** Work가 기준 커밋 뒤에 더하거나(A) 고치거나(M) 지운(D) 파일 (D490). path는 worktree 기준 상대 경로(`/`로 이음)다 */
export interface FileChangeView {
  path: string
  status: 'A' | 'M' | 'D'
}

/** 트리에 보일 바뀐 파일 (D490) */
export type FileChangesResult =
  { ok: true; changes: FileChangeView[] } | { ok: false; error: string }

/** 터미널에서 Ctrl+클릭한 경로가 [파일] 탭에서 열 Work의 글 파일일 때 (D491) */
export interface FilesOpenTarget {
  workKey: string
  /** worktree 기준 상대 경로(`/`로 이음) */
  path: string
}

// ---------- 기본 세션 (시나리오 12, D397~D406) ----------

/** Work 초안 카드 (D404). 만든 곳과 상관없는 모양이다. 틀린 칸은 null이고 형식 오류는 errors에 있다 */
export interface DraftView extends ParsedDraft {
  /** 초안의 자리. [새 Work로 만들기]가 새 Work 입력에 실어 보내고, [버리기]가 지운다 */
  ref: DraftRef
  /** 요청의 첫 줄 (Work 제목이 될 글) */
  title: string
}

/** 기본 세션 하나 (D405). task가 아니다 */
export interface SessionView {
  id: string
  /** 이름. 짓기 전에는 "새 세션"이다 (D403) */
  name: string
  /** 만들 때 고른 폴더 (D398) */
  cwd: string
  created_at: string
  /** 엔진 이름. 열린 세션은 그 엔진, 아니면 열 때 쓸 설정의 엔진이다 (D399) */
  engineLabel: string
  /** 살아 있음, 끝남. 이 앱에서 연 적이 없으면 null이다 (앱을 다시 켜도 없음) */
  status: 'live' | 'ended' | null
  /** 이 세션 터미널의 키. 연 적이 없으면 null이다 */
  terminal: string | null
  /** 이어 갈 대화가 있다. [열기]가 --resume으로 잇는다 */
  resumable: boolean
  /** Codex 세션의 안내가 아직 대화에 들어가지 않았을 때의 안내 (훅 신뢰, 다시 열기) */
  notice?: string
  /** Work 초안 카드 (D404). 파일 이름 차례다 */
  drafts: DraftView[]
}

/** [새 세션]의 결과. 만들었지만 띄우지 못했으면 id와 함께 오류다 */
export type CreateSessionResult =
  { ok: true; id: string } | { ok: false; error: string; id?: string }

export type CheckId = 'git_root' | 'claude' | 'codex' | 'duplicate' | 'origin' | 'gh' | 'submodules'

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
  /** 업무 유형 (D236). 기본값이 없어 사람이 골라야 한다 */
  type: WorkType
  /** 커스텀 유형이면 그 id (D460). 이 프로젝트에서 고를 수 있는 유형(레포 먼저, D451)에서 찾는다 */
  customType?: string
  baseBranch: string
  /** 원격이면 git fetch 뒤 origin/<브랜치>에서 분기한다 */
  baseLocation: 'local' | 'remote'
  /**
   * 사람이 고친 작업 브랜치 이름 (D425). 앱이 끝에 임의의 4자를 붙인다(D427). 없거나 비었으면 프로젝트의 규칙으로
   * 만든다(D426)
   */
  branchName?: string | null
  /** 규칙의 {slug}에 넣을 짧은 이름 (D426). 비면 그 자리와 바로 앞 구분자를 뺀다 */
  slug?: string
  /** 머지 대상 브랜치 (D428): PR의 base다. 없으면 기준 브랜치다 */
  targetBranch?: string
  /** Work별 설정 (D72): 단계별 자동 승인과 스킬별 질문 방식. 없는 것은 앱 설정을 따른다 */
  settings?: WorkSettings
  /** 요청이 온 기존 이슈의 번호 (D338). 이슈 기록이 켜진 프로젝트에서만 쓴다. 없으면 새 이슈를 만든다 */
  issueNumber?: number | null
  /** 채운 Work 초안 (D404). Work를 만들면 앱이 그 초안을 지운다 */
  draft?: DraftRef
  /**
   * Work에서 쓴 초안(D421)으로 만들 때 원래 Work를 포기한다: 다시 하기. 원래 Work가 진행 중이거나 멈춤일 때만 쓴다.
   * 새 Work를 만든 뒤 포기한다
   */
  abandonOriginal?: boolean
  /**
   * 서브모듈 Work의 메인 통합 검증 worktree (D414). 서브모듈 프로젝트에서만 쓴다. 메인 레포의 기준 브랜치와 기준 위치다
   * (메인 레포에 origin이 없을 수 있어 Work의 기준 위치와 따로 고른다). 없거나 null이면 서브모듈 worktree만 만든다
   */
  integration?: { baseBranch: string; baseLocation: 'local' | 'remote' } | null
  /**
   * 묶음 Work (D470): 함께 고칠 서브모듈과 그 기준. 메인 프로젝트에서만 쓴다. 없거나 비면 메인 레포만 고친다. 메인 레포의
   * 기준은 baseBranch, baseLocation, targetBranch다
   */
  repos?: NewWorkRepo[]
  /** 메인 레포를 고친다 (D470). 없으면 고친다. 끄면 repos가 하나 이상 있어야 한다 */
  editMain?: boolean
}

/** 묶음 Work에서 함께 고칠 서브모듈 하나 (D470, D472) */
export interface NewWorkRepo {
  /** 메인 레포 안의 서브모듈 경로 */
  path: string
  baseBranch: string
  baseLocation: 'local' | 'remote'
  /** 머지 대상 (D428). 없으면 기준 브랜치다 */
  targetBranch?: string
}

/**
 * 새 Work 대화상자의 레포 표에서 고른 서브모듈의 정보 (D472). 고를 때 앱이 메인 체크아웃에 받고(받지 않았으면) 읽는다
 */
export interface RepoChoiceView {
  name: string
  path: string
  /** 기준 브랜치의 기본값 (D413의 차례) */
  defaultBranch: string
  /** 고를 수 있는 기준 브랜치: 기본 브랜치가 맨 앞이다 */
  branches: string[]
  /** origin 원격이 있다. 없으면 원격 기준을 고르지 못한다 */
  origin: boolean
}

/** 커스텀 유형 하나 (D459, D460). 형식이 깨졌으면 errors가 있고 고를 수 없다 */
export interface CustomTypeView {
  id: string
  /** 출처. 기본 유형은 builtin이다 (D506) */
  source: TypeSource
  /** 유형 이름. 깨졌으면 id다 */
  name: string
  description: string
  steps: { id: string; title: string; autoApprove: boolean }[]
  /** 새 Work 대화상자의 요청 입력 안내 (D511) */
  requestHint: string
  /** 완료조건마다 확인 방법 (D509) */
  checkMethod: boolean
  /** 다루는 대상 (D510) */
  target: TypeTarget
  errors: string[]
  /** 같은 id의 레포 유형이 있어 이 프로젝트에서 가려진 전역 유형이다 (D451) */
  shadowed?: boolean
}

/** 업무 유형 화면의 목록 (D459): 전역 유형과 등록한 프로젝트마다의 레포 유형 */
export interface CustomTypeList {
  /** 앱에 든 기본 유형 (D506, D512). 읽기 전용이고 새 유형의 베이스로 고른다 */
  builtin: CustomTypeView[]
  global: CustomTypeView[]
  projects: { projectId: string; projectName: string; types: CustomTypeView[] }[]
}

/** 유형 편집 화면이 고치는 유형 폴더의 글 (D459) */
export interface CustomTypeFiles {
  def: CustomTypeDef
  /** 단계 id → 사람이 쓴 절차 */
  procedures: Record<string, string>
  /** 유형 단위 칸의 글 (D456, D507): intake.md, verify.md, finish.md, pr-template.md. 없으면 빈 글 */
  intake: string
  verify: string
  finish: string
  prTemplate: string
}

/** [단계 더하기]의 기반 단계 (D512): 기본 유형 단계의 정의와 절차 */
export interface BaseStep {
  step: CustomStep
  procedure: string
}

/** 지식 정리 후보 (D393) */
export interface TidyCandidateView {
  kind: 'same_anchor' | 'stale_anchor' | 'missing_path' | 'format'
  paths: string[]
  detail: string
}

/** 새 Work 대화상자의 지식 정리 (D393). 후보가 없거나 지식 관리를 끄면 candidates가 비어 있다 */
export interface TidyView {
  candidates: TidyCandidateView[]
  /** [지식 정리 Work로 채우기]가 채울 요청 */
  request: string
}

export interface ApproveOptions {
  /** [오류 무시하고 승인] (D112) */
  force?: boolean
  /** 승인한 쪽 (D522). relay MCP 호출자면 caller다. 앱 화면(IPC)은 넣지 않는다 */
  by?: WorkDriver
}

// ---------- 터미널 ----------

/** PTY의 열과 줄 */
export interface TerminalSize {
  cols: number
  rows: number
}

export interface TerminalChunk {
  /** task마다 0부터 오른다 */
  seq: number
  data: string
  /** PTY 크기. 앞 조각과 크기가 다를 때만 있다 (I189) */
  size?: TerminalSize
}

export interface TerminalBacklog {
  /** 지금까지의 출력 */
  data: string
  /** 다음 조각의 seq. 이보다 작은 조각은 data에 들어 있다 */
  next: number
  live: boolean
  /**
   * data를 그린 PTY 크기. at(data의 글자 위치)부터 그 크기다. 마지막 것이 지금 PTY의 크기다. 이 앱에서 PTY를 띄우지
   * 않은 터미널(pty.log로 채운 것, 대기열)은 비어 있다 (I189)
   */
  sizes: { at: number; size: TerminalSize }[]
}
