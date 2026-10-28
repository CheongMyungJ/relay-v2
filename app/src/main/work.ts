// Work 하나의 흐름 (시나리오 2~7, 9). 훅 신호, 사람 버튼, 프로세스 종료, 감시, 재시작을 이벤트로 바꿔
// core/machine에 넣고, 전이마다 work.json을 쓰고(I11) 돌려받은 할 일을 차례로 실행한다.
// work.json은 쓰기 전에 앱이 마지막으로 쓰거나 읽은 내용과 비교하고, 앱 소유 파일은 읽을 때 적힌 해시와 비교한다
// (D124). 재시작 때의 알림과 끊긴 작업의 [다시 시도]·[무시]도 여기서 한다 (시나리오 9, D121~D123).
// 이벤트는 Work마다 한 줄로 처리한다. 할 일(task 시작 등)이 끝날 때까지 다음 이벤트는 기다린다.
// 세션 상한(D18)은 Relay의 SessionPool이 모든 Work에 걸쳐 센다. 자리가 없으면 대기열에 넣는다.
// 자동 승인 카운트다운(4.3)은 언제 시작하고 멈추는지를 core가 정해 work.json에 두고(D127), 여기서는 타이머만 돈다.
// PR 진행(시나리오 10)은 주기 읽기의 타이머, 읽은 결과의 반영(fast-forward, pr-items.json), 머지를 여기서 한다.
// 읽기의 네트워크 부분은 main/pr이 처리 줄 밖에서 한다(I51). 판정은 core/pr이 한다.
// PR 대응(시나리오 10-3~10-7)은 [대응 시작]의 fetch와 fast-forward, 승인 뒤 push와 답글 게시, [실패한 체크 다시 실행]을 여기서
// 한다. 자동 대응(D154, D171, D210)은 읽기가 받은 새 항목으로 자동 시작을 바라 두고, 막힘이 풀리면 시작하거나 상한에서
// 멈추고 알린다. push·게시 바로 전에 PR 상태를 다시 읽는다(D208). 판정은 core/respond가 한다.
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { agentRuntime } from '../adapters/agent'
import { codexJson, codexSkillPath, findCodex } from '../adapters/codex'
import { AGENT_LABELS, resolveAgent, type AgentEngine } from '../shared/agent'
import { codexToolDenial } from '../core/codex'
import { humanAnswers, humanQuestions } from '../core/questions'
import type { HumanAnswerReply, PendingQuestionView } from '../shared/questions'
import {
  agentLabel,
  knownTaskEngine,
  sessionUnknown,
  taskEngine,
  taskEngineVersion,
} from '../core/agent'
import {
  GhApiError,
  ghApiPost,
  ghCreatePr,
  ghIssueClose,
  ghIssueComment,
  ghIssueComments,
  ghIssueCreate,
  ghIssueList,
  ghLabelCreate,
  ghLabelExists,
  ghMerge,
  ghMergeSettings,
  ghOpenPr,
  ghPrView,
  ghRerunFailed,
  ghVersion,
  type GhPrOptions,
  type GhRepoOptions,
} from '../adapters/gh'
import {
  addWorktree,
  changedPaths,
  checkedOutSubmodules,
  commitAll,
  commitGitlinks,
  commitGitlinksAt,
  gitlinkAt,
  commitInfo,
  commitsOnlyIn,
  commitsWithParents,
  countCommits,
  currentBranch,
  deleteBranches,
  clearSubmodule,
  dirtySubmodules,
  discardChanges,
  deleteRemoteBranch,
  diffFrom,
  hasCommit,
  headBranch,
  headCommit,
  isAncestor,
  lockFiles,
  mergeFastForward,
  pruneWorktrees,
  pushBranch,
  refCommit,
  refNames,
  remoteBranchExists,
  remoteUrl,
  removeWorktree,
  repairSubmoduleWorktree,
  repoRoot,
  stashEntries,
  statusLines,
  submodulePaths,
  untrackedPaths,
} from '../adapters/git'
import type { HookReply, HookRequest, HookServer } from '../adapters/hooks'
import { processStartTime, startPty, type PtySession } from '../adapters/pty'
import {
  isArtifactName,
  pathKey,
  readText,
  removeTree,
  sha256,
  writeFileAtomic,
  writeJson,
  type OwnedWrite,
  type PtyLog,
  type WorkFiles,
} from '../adapters/store'
import { watchDir } from '../adapters/watch'
import {
  REVIEWABLE,
  approvalGate,
  autoApproveNote,
  badge,
  pendingBackground,
} from '../core/approval'
import {
  canClean,
  canDelete,
  cleanPreview,
  halfRemovedHint,
  backupPattern,
  planClean,
  type CleanFacts,
  type RepoCleanFacts,
} from '../core/cleanup'
import {
  buildContext,
  previousInputs,
  type PreviousRound,
  type PreviousTask,
  type RespondInput,
  type BundleInput,
  type SubmoduleTarget,
} from '../core/context'
import {
  ASK_TOOL,
  actions,
  canShelve,
  currentTask,
  transition,
  type DeliveryFound,
  type Effect,
  type InterruptReason,
  type MachineEvent,
  type ResumeInput,
} from '../core/machine'
import {
  CLEANUP_BLOCKS,
  DELIVERY_LABEL,
  approvalStops,
  cleanupActions,
  closingButtons,
  commitMessage,
  compareUrl,
  deliveryButtons,
  deliveryStart,
  deliveryView,
  ghRepo,
  prText,
  remoteRepo,
  sameChanges,
  stashMessage,
  stoppedVerify,
} from '../core/delivery'
import {
  NODE_INFO,
  RESPOND,
  completesWork,
  customSections,
  customStep,
  finishesWork,
  isPipelineNode,
  isStepNode,
  nodeTitle,
  taskArtifacts,
  taskTitle,
  workType,
} from '../core/pipeline'
import { assemblyFlags, checkMethodOn, typeTarget } from '../core/builtin-types'
import {
  CHECK_SCHEMA,
  FIND_SCHEMA,
  REVIEW_CALL_TIMEOUT_MS,
  REVIEW_INPUT_DIR,
  REVIEW_PHASE,
  REVIEW_RECENT,
  REVIEW_RECORD_FILE,
  REVIEW_RESULT_FILE,
  REVIEW_SYSTEM as INDEPENDENT_REVIEW_SYSTEM,
  REVIEW_TOOLS,
  checkPrompt,
  findPrompt,
  readCheck,
  readFind,
  reviewError,
  reviewMarkdown,
  reviewPart,
  reviewLogFile,
  reviewLogLine,
  reviewResumePrompt,
  reviewSteps,
  sortFindings,
  type CallRecord,
  type ReviewCall,
  type ReviewBrief,
  type ReviewDiff,
  type ReviewResult,
} from '../core/independent-review'
import { VERIFY_NOTES_FILE } from '../core/custom-type'
import {
  ISSUE_LABEL,
  ISSUE_LABEL_COLOR,
  ISSUE_LABEL_DESCRIPTION,
  commentIdOf,
  commentShowsIntent,
  endComment,
  findMarked,
  issueBody,
  issueKey,
  issueMarker,
  issueNumberOf,
  issueTitle,
  stepComment,
  taskComment,
  withCloses,
  type IssueArtifact,
} from '../core/issue'
import {
  CHECK_WAIT_MS,
  allowedMethods,
  applyItemAction,
  ciLogRead,
  ciState,
  divergedFact,
  gatherItems,
  reapplyRules,
  mergeGate,
  prBadgeKind,
  prLocation,
  prView,
  preferredMethod,
  repoArg,
  restRepo,
  roundItemViews,
  syncKind,
  type Gate,
  type ItemRules,
  type PrLocation,
  type PrReadState,
} from '../core/pr'
import {
  confirmedIntent,
  decisionsBlock,
  decisionsWithout,
  offWorkBranch,
  targetBranch,
  workBranch,
} from '../core/records'
import {
  OPERATION_BLOCKS,
  OWNED_FILES,
  changedCopyName,
  changedFileLine,
  changedFiles,
  cleanResume,
  cutOperation,
  filesNotice,
  knownBackups,
  lostCommit,
  lostStashes,
  operationView,
  orphanNotice,
  workJsonNotice,
  type ActualHashes,
  type RecordedProcess,
  type WorkJsonChange,
} from '../core/recovery'
import {
  TASK_STATUS_LABEL,
  WORK_STATUS_LABEL,
  bandText,
  bounceNotice,
  shownErrors,
  changeRange,
  completionReview,
  emphasis,
  reviewState,
  handoffSummary,
  hasVisibleText,
  humanNotice,
  permissionNotice,
  resumeHint,
  revisitDecisions,
  stageLead,
  stopNotice,
  taskLabel,
  toolLabel,
  verdicts,
  repoChangeRange,
  repoEndRange,
  type BundleFacts,
  type IntegrationFacts,
} from '../core/review'
import {
  GONE_SKIP,
  PR_CLOSED,
  RESPOND_STAGE_LABEL,
  autoPausedNotice,
  autoPlan,
  autoStartNotice,
  autoStartOn,
  anyPendingRespond,
  deferredRounds,
  existingTestChanges,
  isAppReply,
  pendingRespond,
  planRound,
  receivedNeedsNotice,
  reconcileItems,
  replyItemIds,
  respondFailureView,
  respondInputError,
  respondStart,
  respondTasks,
  staleVerdicts,
  unpostedReplies,
  visibleBody,
  wantsAutoStart,
} from '../core/respond'
import { DRAFTS_DIR } from '../core/draft'
import { treeChanges } from '../core/files'
import { DraftFolder } from './drafts'
import { continuePrompt, INSTRUCTIONS_FILE } from '../core/settings'
import { sideBlock, sideGuide } from '../core/side'
import {
  HANDOFF_FILE,
  INTENT_DRAFT_FILE,
  PR_FILE,
  REPLIES_FILE,
  RESPONSE_FILE,
  VERIFICATION_FILE,
  checkTask,
  parseFrontMatter,
  sectionText,
  type TaskCheck,
  type TaskCheckInput,
} from '../core/validate'
import type { AppConfig, WorkSettingsPatch } from '../shared/config'
import {
  EMPTY_PR_ITEMS,
  type PrItem,
  type PrItemsFile,
  type PrReply,
  type PrRound,
  type PrSynced,
} from '../shared/pr'
import { projectName, repoSettings, type ProjectChecks, type ProjectState } from '../shared/project'
import { mainSideChanges, submoduleGuardEnv } from '../core/submodule'
import {
  bundlePlan,
  relinkMessage,
  relinkUnchecked,
  cardDone,
  focusLane,
  laneOf,
  prCards,
  isBundle,
  linkMessage,
  repoDraftFile,
  withIssueRef,
  withLinkedPrs,
  type RepoDeliverFacts,
  type RepoPick,
  type RepoUncommitted,
  mainEditable,
  repoLine,
  repoTarget,
  withoutRepoPaths,
  workRepos,
} from '../core/repos'
import type {
  ActivityView,
  Artifact,
  ApproveOptions,
  BadgeKind,
  BranchInfo,
  CleanInput,
  CleanPreviewResult,
  CleanupView,
  SideView,
  CommandResult,
  Completion,
  DeliveryButtons,
  RepoCompletion,
  RepoDiffView,
  DeliverInput,
  DeliverResult,
  FileChangesResult,
  IssueView,
  KnowledgeChange,
  MergeInfoResult,
  MergeInput,
  NoticeView,
  PrItemAction,
  PrView,
  RespondReview,
  RespondStartInput,
  ReviewView,
  TaskView,
  TerminalBacklog,
  ToolActivityView,
  WorkView,
} from '../shared/views'
import type {
  DeliverOperation,
  RepoCleanStep,
  WorkRepo,
  DeliveryChoice,
  FormatIssue,
  IssueEntry,
  MergeMethod,
  OwnedFile,
  RespondOperation,
  TaskRecord,
  UncommittedAction,
  WorkState,
} from '../shared/work'
import { workTypeLabel } from '../shared/work'
import type { SessionPool } from './pool'
import type { UiPort } from './ports'
import { listPrComments, readPr, receivedCommits, fetchTip, type PrFetched } from './pr'
import {
  chatHook,
  chatMark,
  chatNotice,
  chatSession,
  dropAux,
  killAux,
  openChat,
  type AuxSession,
  type ChatSession,
} from './chat'
import { noBacklog, TerminalBuffer } from './terminals'
import {
  changedKnowledge,
  knowledgePathsAt,
  readPendingKnowledge,
  readRepoKnowledge,
  removedKnowledge,
  changedCodePaths,
  knowledgeFileChanges,
  type KnowledgeSource,
} from '../adapters/knowledge'
import {
  REVIEW_CALL_LIMIT,
  REVIEW_FILE,
  REVIEW_SCHEMA,
  REVIEW_SYSTEM,
  REVIEW_TIMEOUT_MS,
  humanDecisionLines,
  relatedEntries,
  reviewEnabled,
  reviewFailedIssue,
  reviewIssues,
  reviewPrompt,
  reviewTarget,
  type ReviewInput,
  type ReviewRecord,
} from '../core/knowledge-review'
import {
  builtinTypeDir,
  claudeJson,
  findClaude,
  selectFlags,
  type TypeSource,
} from '../adapters/claude'
import {
  INJECTED_FILE,
  INJECT_LIMIT,
  candidatesOf,
  identifiersIn,
  pathsIn,
  knowledgeIssues,
  knowledgeLineIssues,
  injectedText,
  knowledgeEnabled,
  mergeEntries,
  knowledgeChanges,
  type KnowledgeInput,
  type KnowledgeQuery,
} from '../core/knowledge'

/** verify의 지식 확인 결과: 되돌리는 것(errors)과 보이기만 하는 것(warnings, 되돌린 뒤의 지식 검토) */
interface KnowledgeCheck {
  errors: FormatIssue[]
  warnings: FormatIssue[]
}

/** 여러 Work가 함께 쓰는 것 */
export interface RunnerContext {
  env: NodeJS.ProcessEnv
  /** 스킬 원본 폴더 (D103) */
  skills: string
  hooks: HookServer
  ui: UiPort
  /** 살아 있는 세션의 합계 상한과 대기열 (D18) */
  pool: SessionPool
  /** 판정하는 때의 앱 설정 (D73) */
  config(): AppConfig
  /** gh 실행 파일 (D67, 시나리오 7-4) */
  ghBin: string
  /** 프로젝트의 origin·gh 점검 결과 (D67) */
  checks(projectId: string): ProjectChecks | undefined
  /** 지금 프로젝트. 프로젝트 설정(받을 봇, 기본 머지 방식)이 실행 중에 바뀐다 (D185) */
  project(projectId: string): ProjectState | undefined
  /** 등록된 프로젝트 id. Work 초안의 project를 맞춰 본다 (D404, D421) */
  projectIds(): string[]
  /** origin·gh를 다시 점검해 project.json을 고친다. verify를 시작할 때와 [다시 점검]에서 부른다 (D118) */
  recheck(projectId: string): Promise<void>
  /** 레포 하나의 origin·gh 점검 (D477). 묶음 Work의 서브모듈마다 전달 버튼을 정한다 */
  repoChecks(dir: string): Promise<ProjectChecks>
  /**
   * 지식을 읽을 앞 Work (core/knowledge): 같은 프로젝트에서 완료했거나 PR 진행인 다른 Work의 브랜치와 기준 커밋.
   * 오래된 차례다
   */
  knowledgeSources(projectId: string, exceptWorkId: string): KnowledgeSource[]
  /**
   * 이 브랜치를 머지 대상으로 쓰는, 아직 PR을 만들지 않은 같은 프로젝트의 다른 Work의 id (D428). 정리가 그 브랜치를 지우지
   * 않게 한다: 지우면 그 Work의 [PR 생성]이 없는 base로 간다
   */
  stackedOn(projectId: string, branch: string, exceptWorkId: string): string[]
  /** 같은 프로젝트의 모든 Work의 작업 브랜치 (D425). 예전 되감기 백업 브랜치를 찾을 때 Work 브랜치를 뺀다 */
  workBranches(projectId: string): string[]
  /** 지금 시각. 현지 시각과 오프셋을 담은 ISO 8601 */
  at(): string
  /** 새 PTY의 크기. 탭이 크기를 알리면 그 크기를 쓴다 */
  size(): { cols: number; rows: number }
}

interface LiveSession {
  question?: PendingHumanQuestion
  hooksReady: boolean
  pty: PtySession
  log: PtyLog
  unregister: () => void
  unwatch: () => void
  /** PTY가 끝나면 풀린다 */
  exited: Promise<void>
  /** 직전 UserPromptSubmit이나 Stop 때의 handoff.md(intake는 intent 초안도) (D21, D107) */
  turnFiles: string
  stopped: boolean
  /** 앱이 끝내는 중이다. 이 세션의 훅은 줄에 넣지 않고 바로 답한다 (D231) */
  ending: boolean
  /** 띄운 때 (Date.now()). 첫 출력과 첫 훅까지 걸린 시간을 잰다 (D217) */
  spawnedAt: number
  /** 첫 PTY 출력과 첫 훅을 이미 알렸다 (D217) */
  sawOutput: boolean
  sawHook: boolean
  /** 진행 표시 (D216): 이번 턴이 시작한 때(UserPromptSubmit)와 마지막 도구. 기록하지 않고 살아 있는 동안만 둔다 */
  turnStartedAt: number | null
  tool: (ToolActivityView & { id?: string; name: string }) | null
}

interface PendingHumanQuestion {
  view: PendingQuestionView
  resolve: (reply: HumanAnswerReply) => void
}

/**
 * 정리 세션: [AI 세션 열기]로 연, 기록하지 않는 일반 터미널의 선택된 에이전트 (시나리오 7-5).
 * 살아 있는 동안만 프로세스 ID와 시작 시각을 work.json에 두어 앱이 충돌한 뒤 살아남으면 재시작 때 끝낸다 (D126).
 */
interface CleanupSession extends AuxSession {
  question?: PendingHumanQuestion
  /** Codex 내부 대화 전환에서 앞 질문을 취소한다. task 기록에는 저장하지 않는다. */
  sessionId?: string
  /** 대기열에서도 정리를 요청한 verify task의 엔진을 유지한다. */
  engine: TaskRecord['engine']
  choice: DeliveryChoice
  status: CleanupView['status']
  /** 마지막 Stop 때 git status가 깨끗했다 */
  clean: boolean
  /** 세션이 끝난 뒤 남은 커밋 안 된 변경 */
  uncommitted: string[]
}

/** 정리 세션의 훅 URL(/hook/cleanup/<Event>)의 id. 터미널 id는 cleanup-<n>이다 */
const CLEANUP_ID = 'cleanup'

/** 곁 세션 (시나리오 11, D385~D392). 대화와 살아 있는 동안의 프로세스는 work.json의 side에 둔다 (D389) */
type SideSession = ChatSession

/** 곁 세션의 훅 URL(/hook/side/<Event>)의 id. 터미널 id는 side-<n>이다 */
const SIDE_ID = 'side'
const CONTEXT_FILE = 'context.md'
const SETTINGS_FILE = 'task.settings.json'
const MAX_DIFF_CHARS = 2_000_000
const KILL_WAIT_MS = 10_000

/** 리뷰 요청 Stop에 답한 뒤 세션을 끝내기까지 기다리는 ms (D496). CLI가 훅의 답을 받고 턴을 마칠 틈이다 */
const REVIEW_END_DELAY_MS = 500

/** 독립 리뷰의 지침 (skills/_review.md, D495) */
const REVIEW_GUIDE_FILE = '_review.md'

/** 다시 연 세션의 출력 앞에 넣는 줄. 이전 화면 뒤에 이어 보인다 (시나리오 3-4) */
const RESUME_MARK = '\r\n\x1b[0m\x1b[2m── relay: 세션 재개 (--resume) ──\x1b[0m\r\n'

/** 새 세션의 출력 앞에 넣는 줄. CLI가 첫 화면을 그리기 전의 빈 화면을 채운다 (시나리오 2-5, D215) */
const startMark = (task: TaskRecord) =>
  `\x1b[0m\x1b[2m── relay: ${taskLabel(task)} · 새 세션을 띄우는 중 ──\x1b[0m\r\n`

/** 앱이 꺼지며 끝난 세션의 pty.log 끝에 넣는 줄 (D219). 다시 그린 옛 화면이 어디서 끝났는지 보인다 */
const APP_END_MARK = '\r\n\x1b[0m\x1b[2m── relay: 앱이 꺼져 세션이 여기서 끝났습니다 ──\x1b[0m\r\n'

/** 도구 훅. 실패한 도구는 PostToolUse 대신 PostToolUseFailure를 보낸다 (D216) */
const TOOL_HOOKS: readonly string[] = ['PreToolUse', 'PostToolUse', 'PostToolUseFailure']

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const exists = (p: string) =>
  fsp.stat(p).then(
    () => true,
    () => false,
  )

/** task에 고정한 모델·추론 수준. 시작과 재개가 같은 값을 준다. 없는 옛 기록은 엔진의 기본이다 */
function pinnedAgent(task: TaskRecord): { model?: string; effort?: string } {
  return {
    ...(task.model ? { model: task.model } : {}),
    ...(task.effort ? { effort: task.effort } : {}),
  }
}

function clip(text: string): string {
  return text.length > MAX_DIFF_CHARS
    ? `${text.slice(0, MAX_DIFF_CHARS)}\n… (잘림: 전체 ${text.length}자)`
    : text
}

/**
 * handoffChanged를 정할 때 비교하는 파일 (D21): handoff.md, intake는 intent 초안도. verify는 레포의 지식 파일도
 * 넣는다(knowledge): 지식 파일만 고치고 멈춘 것도 다시 마무리를 시도한 것이다 (D328)
 */
function turnSnapshot(
  task: TaskRecord,
  files: Readonly<Record<string, string>>,
  knowledge = '',
): string {
  const draft = task.node === 'intake' ? (files[INTENT_DRAFT_FILE] ?? null) : null
  return JSON.stringify([files[HANDOFF_FILE] ?? null, draft, knowledge])
}

/** 한 번의 답글 게시에서 받아 둔 코멘트 목록 (인라인 코멘트, 대화 코멘트) */
type ReplyLists = Map<'inline' | 'convo', Promise<unknown[]>>

export { workTitle } from './drafts'

/** 결과를 모르는 머지를 다시 확인하는 간격과 횟수 (D330). 간격은 환경 변수 RELAY_MERGE_CONFIRM_MS(시험)로 바꾼다 */
const MERGE_CONFIRM_MS = 30_000
const MERGE_CONFIRM_TRIES = 5

/** PR 카드 배지의 차례 (core/pr prBadgeKind의 차례와 같다) */
const CARD_BADGE_ORDER: readonly BadgeKind[] = [
  'auto_paused',
  'pr_items',
  'pr_closed',
  'mergeable',
  'pr_waiting',
]

/** task가 그 PR 카드의 레포에서 시작한 커밋 (D475, D480): 메인은 start_commit, 서브모듈은 repo_starts다 */
function laneStart(task: TaskRecord, lane: string): string | undefined {
  return lane ? task.repo_starts?.[lane] : task.start_commit
}

/** PR 카드 하나의 메모리 상태 (D480, I175). 메인 PR은 '', 서브모듈 PR은 그 경로의 카드다 */
interface Lane {
  /** pr-items.json의 내용 (D191). 처음 쓸 때 읽는다 */
  file: PrItemsFile | null
  /** 마지막으로 읽은 PR (D159: 메모리에만 두고 앱을 켜면 다시 읽는다) */
  read: PrReadState | null
  /** 마지막 읽기 때의 로컬 Work 브랜치 커밋 */
  local: string | null
  /** 마지막 읽기의 오류나 경고 */
  error: string | null
  /** 읽는 중인 읽기. 한 카드의 읽기는 한 번에 하나다 (I51) */
  reading: Promise<CommandResult> | null
  /** 주기 읽기의 타이머 (D158) */
  timer: NodeJS.Timeout | null
  /** head를 처음 읽은 때 (D196). 메모리에만 두어 앱을 다시 켜면 다시 잰다 */
  readonly headSeen: Map<string, number>
  /**
   * Actions 실행 id → 이벤트 (D201, I52). 실행의 이벤트는 바뀌지 않아 메모리에 두고 처음 보는 실행만 읽는다. 앱을 다시
   * 켜면 CI 실패 항목에 적힌 것부터 채운다
   */
  readonly runEvents: Map<number, string>
  /**
   * 자동 대응을 바란다 (D210): 읽기가 받은 새 항목이 있을 때 대응 자동 시작이 켜져 있었다. 시작하거나 상한에서 멈추거나
   * 넣을 새 항목이 없어지거나 자동 시작이 꺼지면 버린다. 도는 대응 task, 진행 중 작업, 닫힌 PR로 막히면 남겨 두고 풀리면
   * 시작한다. 메모리에만 둔다: 앱을 다시 켜면 쌓인 항목만으로는 시작하지 않는다 (D159)
   */
  autoWanted: boolean
  /** 자동 대응을 판정하고 시작하는 중. 한 번에 하나다 */
  autoRunning: Promise<void> | null
  /**
   * 앱을 켤 때의 읽기를 아직 반영하지 못했다 (D159). 켤 때의 읽기가 실패하거나 끊긴 작업 때문에 읽지 못하면, 반영에 성공한
   * 첫 읽기가 켤 때의 읽기다: 그 읽기까지는 알리지 않고 자동 대응을 바라지 않는다. 꺼져 있던 동안 쌓인 항목으로는 자동
   * 시작하지 않는다
   */
  startRead: boolean
  /** 결과를 모르는 머지를 앱이 다시 확인한 횟수 (D330) */
  mergeConfirms: number
  /** 메인 PR이 머지된 커밋을 가리키지 않는 서브모듈 (D481). 메인 카드의 읽기가 정한다 */
  relink: string[]
  /** 메인 카드: 마지막 읽기에서 머지된 커밋을 가리키는지 확인한 서브모듈 (D481) */
  relinkChecked: string[]
  /** 메인 카드: 머지 대상에 있다고 확인한 서브모듈 커밋 (경로 → gitlink). 같은 커밋이면 다시 받지 않는다 */
  relinkOk: Map<string, string>
}

/** 도는 독립 리뷰 호출의 진행 (D502): 호출, 시작한 때, 지금 도구(끝났으면 끝난 때), 지금 것 앞의 최근 도구 */
interface ReviewProgress {
  call: ReviewCall
  since: number
  tool: { id: string; label: string; startedAt: number; endedAt: number | null } | null
  recent: string[]
}

export class WorkRunner {
  readonly key: string
  private queue: Promise<unknown> = Promise.resolve()
  private readonly live = new Map<string, LiveSession>()
  /** Stop 훅이 줄에 들어가기 전에 새로 부른 지식 검토의 입력 해시 (task id → 해시, D300). 그 Stop의 확인이 한 번 쓴다 */
  private readonly freshReview = new Map<string, string>()
  /** 이 Stop에서 검토가 되돌리려는 입력 (D328). core가 실제로 되돌리면 기록에 "되돌림"을 남긴다 */
  private readonly reviewBounce = new Map<string, string>()
  private readonly terminals = new Map<string, TerminalBuffer>()
  /**
   * 다시 열 세션에 이어서 하라는 첫 입력을 줄지 (D218). [재개]·[세션 재개]마다 core가 정한 것을 두고, 세션을 다시 열
   * 때 쓴다. 대기열에서 기다리는 동안에도 남는다
   */
  /** 다시 열 세션의 첫 입력 (D218, D496). resumeTask가 적고 resumeSession이 한 번 쓴다 */
  private readonly resumeInput = new Map<string, ResumeInput>()
  /** 도는 독립 리뷰 (task id → 끊기, D496). [Work 포기]가 끊는다 */
  private readonly reviews = new Map<string, AbortController>()
  /** 도는 독립 리뷰가 끝나는 때 (호출 프로세스가 끝남). 앱 종료가 worktree를 놓기 전에 기다린다 */
  private readonly reviewRuns = new Map<string, Promise<void>>()
  /** 도는 독립 리뷰 호출의 진행 (D502). 기록하지 않고 리뷰가 도는 동안만 둔다 */
  private readonly reviewProgress = new Map<string, ReviewProgress>()
  /** task마다 자리를 잡아 세션을 띄우기 시작한 때. 진행 표시의 "세션을 띄우는 중"을 여기서부터 센다 (D216) */
  private readonly launchedAt = new Map<string, number>()
  private readonly problems: string[] = []
  private revision = 0
  /** 이 Work의 Work 초안 폴더 (D421) */
  private readonly drafts: DraftFolder
  /** 이번 명령의 전달이나 정리가 실패한 이유. 명령의 결과로 돌려준다 */
  private opError: string | null = null
  /** 정리 세션 ([AI 세션 열기], 7-5) */
  private cleanup: CleanupSession | null = null
  private cleanupSeq = 0
  /** 곁 세션 (시나리오 11). 앱을 다시 켜면 없고, 이어 갈 대화는 work.json의 side에 있다 */
  private side: SideSession | null = null
  private sideSeq = 0
  /** 재시작 때 끝낸 이 Work의 고아 프로세스 (D76, D121). [확인]으로 지운다 */
  private orphans: RecordedProcess[] = []
  /** 앱 밖에서 바뀐 앱 소유 파일: 알림 줄과 그때의 해시 (D124). [확인]으로 지운다 */
  private readonly fileChanges = new Map<OwnedFile, { line: string; hash: string | null }>()
  /** 앱 밖에서 바뀐 work.json (D124). [확인]으로 지운다 */
  private workJsonChanges: WorkJsonChange[] = []
  /**
   * 자동 승인 카운트다운의 타이머 (4.3, D127). 카운트다운의 상태는 work.json의 task 기록에 있다. 끝나는 때는
   * 스냅샷으로 렌더러에 보내 남은 초를 세게 한다
   */
  private countdown: {
    taskId: string
    startedAt: string
    endsAt: number
    timer: NodeJS.Timeout
  } | null = null
  /** PR 카드마다 읽은 상태 (D480). 메인 PR은 '', 서브모듈 PR은 그 경로다 */
  private readonly laneStates = new Map<string, Lane>()
  /** 앱을 끝낸다. 읽기를 더 걸지 않는다 */
  private closing = false
  /** 앱을 끝내라고 했다 (shutdown). 지우기가 실패해 closing을 되돌릴 때 이것을 따른다 */
  private quitting = false
  /** 기록을 지웠다 (D407). work.json을 다시 쓰지 않고 스냅샷도 보내지 않는다 */
  private removed = false
  /** 도는 동안 앱이 서브모듈 저장소의 core.worktree를 되돌린 task (D415). 승인 화면에 알린다. 메모리에만 둔다 */
  private readonly submoduleRepaired = new Set<string>()
  /** 묶음 Work의 서브모듈마다 origin·gh 점검 (D477). verify를 시작할 때와 [다시 점검]에서 새로 한다 */
  private readonly repoCheckMap = new Map<string, ProjectChecks>()
  /** 이슈 기록의 게시 줄 (I98). 한 번에 하나이고 Work의 처리 줄 밖에서 돈다 */
  private issueRunning: Promise<void> | null = null
  /** 게시 줄이 도는 동안 다시 게시하라는 요청이 왔다. 줄이 끝나면 한 번 더 돈다 */
  private issueAgain = false

  /**
   * workText는 앱이 마지막으로 쓰거나 읽은 work.json의 내용이다. 다음에 쓰기 전에 이것과 비교한다 (D124).
   * 새로 만든 Work는 아직 쓰지 않아 null이다
   */
  constructor(
    private readonly ctx: RunnerContext,
    readonly project: ProjectState,
    readonly files: WorkFiles,
    readonly worktree: string,
    public work: WorkState,
    /** 사이드바의 Work 제목 (요청의 첫 줄) */
    readonly title: string,
    private workText: string | null = null,
    /**
     * 메인 통합 검증 worktree의 폴더 (D414). 이 Work의 worktree는 그 안의 서브모듈 자리다. 배치는 Relay가 정한다.
     * 서브모듈 Work가 아니거나 만들지 않았으면 null
     */
    readonly integrationRoot: string | null = null,
  ) {
    this.key = `${project.project_id}/${work.work_id}`
    this.drafts = new DraftFolder({
      dir: path.join(files.dir, DRAFTS_DIR),
      source: { kind: 'work', id: this.key },
      projectIds: () => ctx.projectIds(),
      changed: () => this.changed(),
      live: () => !this.removed,
    })
  }

  /** 이 Work의 Work 초안 폴더 (D421): task와 곁 세션이 다시 할 Work의 초안을 쓰는 곳 */
  get draftsDir(): string {
    return this.drafts.dir
  }

  /**
   * 초안 폴더를 만들고 본다 (D421, I135). 초안을 쓰는 세션(task, 곁 세션)을 띄울 때 건다: 감시는 폴더가 지워졌다 다시
   * 생기면 알리지 않으므로(watchDir) 띄울 때마다 다시 건다. 보관된 Work는 쓸 세션이 없어 폴더를 만들지 않고 남은 초안만 읽는다
   */
  async watchDrafts(): Promise<void> {
    if (this.work.status !== 'archived') await this.drafts.watch()
    await this.drafts.refresh()
  }

  /** 초안 폴더를 다시 읽는다: 앱을 켤 때, 프로젝트 목록이 바뀔 때 (초안의 project를 맞춰 봄) */
  refreshDrafts(): Promise<void> {
    return this.drafts.refresh()
  }

  /** 초안을 지운다: [버리기], 그 초안으로 Work를 만든 뒤 (D404, D421) */
  removeDraft(name: string): Promise<CommandResult> {
    return this.drafts.remove(name)
  }

  /**
   * 다시 하기로 새 Work를 만들며 이 Work를 포기할 수 없는 까닭 (D421). 포기할 수 있으면 null이다: 진행 중이거나 멈췄고,
   * 끊긴 작업이 없고(D122), 정리 세션이 열려 있지 않다(D137). 새 Work를 만들기 전에 본다
   */
  redoAbandonBlock(): string | null {
    if (this.work.status !== 'active' && this.work.status !== 'stopped') {
      return '원래 Work는 진행 중이거나 멈춘 Work가 아니라 포기할 수 없습니다'
    }
    if (this.work.operation) return `원래 Work를 포기할 수 없음: ${OPERATION_BLOCKS}`
    if (this.cleanupOpen()) return `원래 Work를 포기할 수 없음: ${CLEANUP_BLOCKS}`
    return null
  }

  /** 다시 하기로 새 Work는 만들었는데 이 Work를 포기하지 못했다: 이 Work에 알린다 (D421) */
  redoAbandonFailed(newWorkId: string, error: string): void {
    this.problem(
      `${newWorkId}로 다시 하며 이 Work를 포기하지 못함: ${error}. [Work 포기]를 누르세요`,
    )
    this.changed()
  }

  /** 서브모듈 Work의 메인 프로젝트 (D413). 메인 레포의 Work거나 메인 프로젝트를 찾지 못하면 null */
  private mainProject(): ProjectState | null {
    const parent = this.project.parent
    return parent ? (this.ctx.project(parent.project_id) ?? null) : null
  }

  /**
   * 에이전트 세션(task, 곁 세션, 정리 세션)의 환경 변수 (D415). 메인 통합 검증 worktree가 있으면 git submodule update가
   * 이 서브모듈을 건너뛰게 한다
   */
  private agentEnv(): NodeJS.ProcessEnv {
    const parent = this.project.parent
    // 묶음 Work는 고른 서브모듈마다 막는다 (D471)
    const names = [
      ...(this.integrationRoot !== null && parent ? [parent.name] : []),
      ...workRepos(this.work).map((r) => r.name),
    ]
    if (names.length === 0) return this.ctx.env
    return { ...this.ctx.env, ...submoduleGuardEnv(this.ctx.env, names) }
  }

  /** 묶음 Work의 서브모듈 worktree 폴더 (D471): 메인 worktree 안의 그 자리 */
  private repoTree(p: string): string {
    return path.join(this.worktree, ...p.split('/'))
  }

  /** 묶음 Work의 서브모듈 저장소: 메인 체크아웃의 그 서브모듈 폴더 (D471). 브랜치와 원격은 여기서 읽고 쓴다 */
  private repoDir(p: string): string {
    return path.join(this.project.repo_path, ...p.split('/'))
  }

  /** 에이전트가 함께 쓰는 폴더 (D414): 메인 통합 검증 worktree. 없으면 빈 값이다 */
  private extraDirs(): { extraDirs?: string[] } {
    const root = this.integrationRoot
    return root ? { extraDirs: [root] } : {}
  }

  /**
   * 서브모듈 저장소의 core.worktree를 사용자 체크아웃으로 되돌린다 (D415). 메인 통합 검증 worktree가 있는 Work만 본다.
   * 턴이 끝날 때, 승인 화면과 정리 요약을 만들 때, 앱을 켤 때 부른다. 되돌렸으면 알리고, taskId가 있으면 그 task의 승인
   * 화면에도 알린다. 실패하면 알리기만 한다
   */
  private async guardSubmodule(taskId?: string): Promise<void> {
    const dirs = [
      ...(this.integrationRoot !== null ? [this.project.repo_path] : []),
      // 묶음 Work는 고른 서브모듈마다 본다 (D471)
      ...workRepos(this.work).map((r) => this.repoDir(r.path)),
    ]
    for (const dir of dirs) {
      try {
        if (!(await repairSubmoduleWorktree(dir, { env: this.ctx.env }))) continue
        if (taskId) this.submoduleRepaired.add(taskId)
        this.problem(
          `서브모듈 저장소의 core.worktree가 바뀌어 ${dir}로 되돌렸습니다 (메인 worktree의 git submodule update)`,
        )
      } catch (e) {
        this.problem(`서브모듈 저장소의 core.worktree를 확인하지 못함: ${message(e)}`)
      }
    }
  }

  /**
   * 묶음 Work의 서브모듈마다 지금 HEAD (D475). 키는 서브모듈 경로다. worktree가 없거나 읽지 못한 레포는 빠진다
   */
  private async repoHeads(): Promise<Record<string, string>> {
    const out: Record<string, string> = {}
    for (const r of workRepos(this.work)) {
      const head = await headCommit(this.repoTree(r.path), { env: this.ctx.env }).catch(() => null)
      if (head) out[r.path] = head
    }
    return out
  }

  /** 이 앱에서 살아 있는 세션이 있다 (앱 종료 확인, 시나리오 3-6). 정리 세션과 곁 세션(D390)도 센다 */
  hasLiveSession(): boolean {
    return this.live.size > 0 || this.cleanup?.status === 'live' || this.side?.status === 'live'
  }

  /** Work의 이벤트를 하나씩 처리한다 */
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn)
    this.queue = run.catch(() => undefined)
    return run
  }

  // ---------- 전이와 할 일 (I10, I11) ----------

  /** 이벤트를 machine에 넣고 반영한다 */
  private async feed(event: MachineEvent, opts: { quiet?: boolean } = {}) {
    const merged = relinkUnchecked(this.work, []).length
    const t = transition(this.work, event, this.ctx.config())
    const reply = await this.apply(t.work, t.effects, opts)
    // 메인이 가리키는 서브모듈의 PR이 막 머지됐으면 메인 PR을 곧 다시 읽어 머지된 커밋을 가리키는지 본다 (D481)
    if (relinkUnchecked(this.work, []).length > merged && this.work.pr && !cardDone(this.work.pr)) {
      setTimeout(() => void this.readPrNow(''), 0)
    }
    return { t, reply }
  }

  /**
   * 새 상태를 work.json에 쓰고(I11) 할 일을 차례로 실행한다. 쓰기 전에 파일이 앱이 마지막으로 쓰거나 읽은 내용과
   * 다르면 바뀐 내용을 옆에 남기고 알린 뒤 앱의 상태로 쓴다 (D124).
   * 사람이 움직여야 하는 상태로 바뀌었으면 알린다(D81). 재시작 조정은 알리지 않는다(quiet).
   * blockStop이 있으면 Stop 요청에 돌려줄 응답을 돌려준다 (D21, S2).
   * work.json을 쓰지 못하면 메모리의 상태도 바꾸지 않고 할 일도 하지 않는다. 할 일 하나가 실패하면 나머지는 하되,
   * 그 뒤의 세션 시작은 하지 않고 task를 중단됨으로 둔다 (D135).
   */
  async apply(
    work: WorkState,
    effects: readonly Effect[],
    opts: { quiet?: boolean } = {},
  ): Promise<HookReply> {
    if (this.removed || (work === this.work && effects.length === 0)) return null
    // 상태가 그대로이고 기록만 남기는 전이(세션 시각, D217)는 work.json을 다시 쓰지 않고 스냅샷도 보내지 않는다
    if (work === this.work && effects.every((e) => e.type === 'log')) {
      for (const e of effects) {
        try {
          await this.run(e)
        } catch (err) {
          this.problem(`${e.type} 실패: ${message(err)}`)
        }
      }
      return null
    }
    const before = this.work
    const at = this.ctx.at()
    let saved: Awaited<ReturnType<WorkFiles['save']>>
    try {
      saved = await this.files.save(work, {
        expected: this.workText,
        copyName: changedCopyName(at),
      })
    } catch (err) {
      this.problem(`work.json 쓰기 실패: ${message(err)}`)
      throw err
    }
    this.work = work
    // 끝난 정리 세션은 Work가 끝나면 치운다
    if (this.cleanup?.status === 'ended' && work.status !== 'active' && work.status !== 'stopped') {
      this.cleanup = null
    }
    this.workText = saved.text
    if (saved.changed) this.workJsonChanges.push({ at, copy: saved.copy })
    this.changed()
    const notice = opts.quiet ? null : humanNotice(before, work)
    if (notice) this.notify(notice)
    let reply: HookReply = null
    let failed: string | null = null
    for (const e of effects) {
      try {
        if (failed && (e.type === 'startTask' || e.type === 'resumeTask')) {
          await this.skipStart(e.taskId, failed)
          continue
        }
        reply = (await this.run(e)) ?? reply
      } catch (err) {
        failed = `${e.type} 실패: ${message(err)}`
        this.problem(failed)
      }
    }
    // 바라 둔 자동 대응을 막던 것(도는 대응 task, 진행 중 작업, 닫힌 PR)이 이 전이로 풀렸을 수 있다 (D170, D210)
    for (const lane of this.laneStates.keys()) this.autoRespondSoon(lane)
    return reply
  }

  /** 앞선 할 일이 실패해 세션을 띄우지 않았다. 띄우다 실패한 것과 같이 중단됨으로 둔다 (D135) */
  private async skipStart(taskId: string, failed: string): Promise<void> {
    const check = await this.checkNow(taskId)
    await this.feed({
      type: 'session.failed',
      taskId,
      at: this.ctx.at(),
      error: `앞선 처리가 실패해 시작하지 않음: ${failed}`,
      ...(check ? { check } : {}),
    })
  }

  private async run(e: Effect): Promise<HookReply | undefined> {
    switch (e.type) {
      case 'log':
        await this.files.appendEvent(e.event)
        return
      case 'blockStop':
        return { decision: 'block', reason: e.reason }
      case 'endSession':
        await this.endSession(e.taskId)
        return
      case 'appendDecisions': {
        const written = await this.files.appendDecisions(
          decisionsBlock({
            taskId: e.taskId,
            node: e.node,
            ...(e.step !== undefined ? { step: e.step } : {}),
            at: e.at,
            by: e.by,
            decisions: e.decisions,
          }),
        )
        await this.ownedWritten('decisions.md', written)
        return
      }
      case 'confirmIntent':
        await this.confirmIntent(e.taskId, e.version)
        return
      case 'startTask':
        await this.requestSession(e.taskId)
        return
      case 'resumeTask':
        this.resumeInput.set(e.taskId, e.input)
        await this.requestSession(e.taskId)
        return
      case 'startReview':
        this.startReview(e.taskId, e.codeReview, e.endSession)
        return
      case 'cancelReview':
        this.reviews.get(e.taskId)?.abort()
        return
      case 'dequeue':
        this.ctx.pool.remove(this.slotKey(e.taskId))
        return
      case 'deliver':
        await this.deliverCode(e)
        return
      case 'openCleanup':
        await this.startCleanup(e.choice)
        return
      case 'clean':
        await this.cleanCode(e)
        return
      case 'startCountdown':
        this.startCountdown(e)
        return
      case 'stopCountdown':
        this.stopCountdown(e.taskId)
        return
      case 'merge':
        await this.mergeCode(this.opLane(), e)
        return
      case 'respond':
        await this.respondCode(this.opLane(), e)
        return
      case 'publishIssue':
        this.publishIssueSoon()
        return
    }
  }

  private task(taskId: string): TaskRecord | undefined {
    return this.work.tasks.find((t) => t.id === taskId)
  }

  private check(
    task: TaskRecord,
    files: Readonly<Record<string, string>>,
    knowledge?: KnowledgeCheck,
    bundleDrafts?: TaskCheckInput['bundleDrafts'],
  ): TaskCheck {
    const step = customStep(this.work, task)
    return checkTask({
      node: task.node,
      type: workType(this.work),
      checkMethod: checkMethodOn(this.work),
      target: typeTarget(this.work),
      files,
      config: this.ctx.config(),
      formatVersion: task.format_version,
      // PR 대응 task는 이번 라운드의 코멘트 항목마다 replies.md의 절을 본다 (D190)
      ...(task.respond ? { replyItems: replyItemIds(task.respond.items) } : {}),
      ...(knowledge ? { knowledgeIssues: knowledge.errors } : {}),
      ...(knowledge?.warnings.length ? { knowledgeWarnings: knowledge.warnings } : {}),
      ...(step ? { customStep: { id: step.id, sections: customSections(step) } } : {}),
      ...(bundleDrafts ? { bundleDrafts } : {}),
      // 마무리 단계는 리뷰 요청 때와 마무리 때의 필수 산출물이 다르다 (D494)
      ...(finishesWork(this.work, task)
        ? { finishing: { requested: task.review !== undefined } }
        : {}),
    })
  }

  /**
   * 묶음 Work의 Work 완료 task(마무리 단계, 옛 Work의 verify)가 쓸 PR 초안 (D476, D500): 기준 커밋 뒤에 커밋이 있는 서브모듈마다
   * pr/<경로>.md의 내용(없으면 null)과, 메인을 고쳤는지. 커밋을 세지 못한 레포는 커밋이 있는 것으로 본다. Work 완료 task가
   * 아니거나 묶음 Work가 아니면 undefined
   */
  private async bundleDrafts(task: TaskRecord): Promise<TaskCheckInput['bundleDrafts']> {
    if (!completesWork(this.work, task) || !isBundle(this.work)) return undefined
    const drafts: { file: string; text: string | null }[] = []
    for (const r of workRepos(this.work)) {
      const ahead = await countCommits(this.repoTree(r.path), r.base_commit, 'HEAD', {
        env: this.ctx.env,
      }).catch(() => 1)
      if (ahead === 0) continue
      const file = repoDraftFile(r.path)
      drafts.push({ file, text: await this.files.taskFile(task, file) })
    }
    return { drafts, main: mainEditable(this.work) }
  }

  /**
   * 형식 검사 (5.2.1)에 verify의 지식 확인(D291, D293, D294, D296, D297)과 지식 검토(D300)를 더한 것. files가 없으면 task
   * 파일을 읽는다. 검토 호출은 Stop에서만 하고(stop), 다른 곳(승인 화면 등)은 같은 입력의 기록이 있으면 그 결과만 쓴다
   */
  private async checkOf(
    task: TaskRecord,
    files?: Readonly<Record<string, string>>,
    opts: { stop?: boolean } = {},
  ): Promise<TaskCheck> {
    const f = files ?? (await this.files.taskFiles(task))
    return this.check(
      task,
      f,
      await this.knowledgeCheck(task, f, opts),
      await this.bundleDrafts(task),
    )
  }

  /**
   * verify의 지식 확인 입력 (D291, D293, D294, D296, D297): 이 Work가 더하거나 고치거나 지운 지식, 바꾼 코드, 앞에 있던 지식
   * 경로, 지금 보이는 지식. 서로 기대지 않는 읽기는 함께 한다. 지식 관리를 끄거나 verify가 아니면 null, 읽지 못하면 undefined
   */
  private async knowledgeCheckInput(
    task: TaskRecord,
    files: Readonly<Record<string, string>>,
  ): Promise<Parameters<typeof knowledgeIssues>[0] | null | undefined> {
    const { env } = this.ctx
    if (!knowledgeEnabled(env) || !completesWork(this.work, task)) return null
    const handoff = files[HANDOFF_FILE] ?? ''
    const base = this.work.base_commit
    try {
      const sources = this.ctx.knowledgeSources(this.project.project_id, this.work.work_id)
      const [changed, removed, codeChanged, pending, atBase, repo] = await Promise.all([
        changedKnowledge(this.worktree, base, { env }),
        removedKnowledge(this.worktree, base, { env }),
        changedCodePaths(this.worktree, base, { env }),
        readPendingKnowledge(this.project.repo_path, base, sources, { env }),
        knowledgePathsAt(this.worktree, base, { env }),
        readRepoKnowledge(this.worktree),
      ])
      const existing = new Set([...atBase, ...pending.filter((e) => !e.removed).map((e) => e.path)])
      // 앞 Work가 지운 항목은 이 Work가 다시 쓰지 않았으면 없는 것으로 본다 (D297)
      const current = new Map<string, string>()
      for (const e of repo) current.set(e.path, e.text)
      const mine = new Set([...changed.map((c) => c.path), ...removed])
      for (const e of pending) {
        if (mine.has(e.path)) continue
        if (e.removed) current.delete(e.path)
        else current.set(e.path, e.text)
      }
      return { handoff, changed, existing, current, removed, codeChanged }
    } catch (e) {
      console.error(`[${this.key}] 지식을 확인하지 못함: ${message(e)}`)
      return undefined
    }
  }

  /**
   * verify의 지식 확인 (D291, D293, D294, D296, D297)과 지식 검토(D300)의 결과. 검토 호출은 여기서 하지 않는다: Stop 훅이 Work
   * 줄에 들어가기 전에 부른 결과(prepareKnowledgeReview)를 기록에서 읽는다. 그 Stop에서 처음 찾은 문제만 되돌리고(task마다
   * 한 번), 기록에서 다시 읽은 것은 늘 경고다. 지식 관리를 끄거나 verify가 아니면 undefined
   */
  private async knowledgeCheck(
    task: TaskRecord,
    files: Readonly<Record<string, string>>,
    opts: { stop?: boolean } = {},
  ): Promise<KnowledgeCheck | undefined> {
    const input = await this.knowledgeCheckInput(task, files)
    if (input === null) return undefined
    if (input === undefined)
      return { errors: knowledgeLineIssues(files[HANDOFF_FILE] ?? ''), warnings: [] }
    const errors = knowledgeIssues(input)
    if (!this.wantsReview(input, errors)) return { errors, warnings: [] }
    const review = await this.knowledgeReviewResult(task, input, opts.stop === true)
    return review.bounce
      ? { errors: review.issues, warnings: [] }
      : { errors, warnings: review.issues }
  }

  /**
   * 뜻을 검토할 때 (D300): 검토를 켰고, 기계적 확인을 지났고, 지식을 바꿨고, verify가 승인 대기로 끝냈다(형식 검사가 지식
   * 오류를 그때만 보므로, 다른 상태에서 되돌릴 기회를 쓰지 않는다)
   */
  private wantsReview(
    input: Parameters<typeof knowledgeIssues>[0],
    errors: readonly FormatIssue[],
  ): boolean {
    const fm = parseFrontMatter(input.handoff)
    return (
      reviewEnabled(this.ctx.env) &&
      errors.length === 0 &&
      (input.changed.length > 0 || (input.removed?.length ?? 0) > 0) &&
      fm.ok &&
      fm.data['status'] === 'awaiting_approval'
    )
  }

  /** 검토에 넣을 것과 그 해시 (D300). 같은 입력이면 같은 해시다 */
  private async reviewRequest(
    task: TaskRecord,
    check: Parameters<typeof knowledgeIssues>[0],
  ): Promise<{ prompt: string; hash: string; known: Set<string>; related: number }> {
    const [request, intent, decisions] = await Promise.all([
      this.files.readOwned('request.md'),
      this.files.readOwned('intent.md'),
      this.files.readOwned('decisions.md'),
    ])
    const candidates: string[] = []
    for (const t of this.work.tasks) {
      if (t.id === task.id || t.status === 'discarded') continue
      candidates.push(...candidatesOf((await this.handoffOf(t)) ?? ''))
    }
    const reviewInput: ReviewInput = {
      changed: check.changed,
      removed: check.removed ?? [],
      related: relatedEntries(check.current, check.changed, request?.text ?? ''),
      request: request?.text ?? '',
      intent: intent?.text ?? null,
      humanDecisions: humanDecisionLines(decisions?.text ?? ''),
      candidates,
    }
    const prompt = reviewPrompt(reviewInput)
    return {
      prompt,
      hash: sha256(prompt),
      known: new Set([
        ...check.changed.map((c) => c.path),
        ...reviewInput.related.map((r) => r.path),
      ]),
      related: reviewInput.related.length,
    }
  }

  private async readReviewRecord(task: TaskRecord): Promise<ReviewRecord> {
    const text = await readText(path.join(this.files.taskDir(task), REVIEW_FILE))
    try {
      return text ? (JSON.parse(text) as ReviewRecord) : { calls: [] }
    } catch {
      return { calls: [] }
    }
  }

  private async writeReviewRecord(task: TaskRecord, record: ReviewRecord): Promise<void> {
    try {
      await writeFileAtomic(
        path.join(this.files.taskDir(task), REVIEW_FILE),
        `${JSON.stringify(record, null, 2)}\n`,
      )
    } catch (e) {
      console.error(`[${this.key}] 지식 검토 기록을 쓰지 못함: ${message(e)}`)
    }
  }

  // ---------- 독립 리뷰 (D494~D497) ----------

  /**
   * 마무리 단계의 독립 리뷰를 시작한다 (D495, D496). endSession이면 Stop 훅에 답한 뒤 리뷰를 요청한 그 세션을 끝낸다: 처리 줄
   * 안에서 끝내면 답을 기다리는 CLI를 죽이게 된다. 리뷰는 그 세션이 끝난 뒤 처리 줄 밖에서 돌고, 끝나면 review.finished를
   * 넣는다: 리뷰가 먼저 끝나 다시 연 세션을 늦게 온 종료가 끝내지 않는다. 이미 돌고 있으면 그대로다
   */
  private startReview(taskId: string, codeReview: boolean, endSession: boolean): void {
    const session = endSession ? this.live.get(taskId) : undefined
    const ended = session
      ? sleep(REVIEW_END_DELAY_MS)
          .then(() =>
            this.enqueue(async () => {
              if (this.live.get(taskId) === session) await this.endSession(taskId)
            }),
          )
          .catch((e: unknown) => this.problem(`리뷰 전에 세션을 끝내지 못함: ${message(e)}`))
      : Promise.resolve()
    if (this.reviews.has(taskId) || this.closing) return
    const controller = new AbortController()
    this.reviews.set(taskId, controller)
    const started = Date.now()
    const run = ended
      .then(() =>
        controller.signal.aborted
          ? undefined
          : this.runReview(taskId, codeReview, controller.signal),
      )
      .catch(async (e: unknown) => {
        // 리뷰를 돌리지 못해도(지침을 읽지 못함, 변경 파일을 쓰지 못함 등) 끝난 것으로 넣는다: 독립 리뷰 중에 머물지 않고
        // 실패한 결과 글로 같은 대화를 다시 연다 (D495의 "실패하면 결과 글에 까닭을 쓰고 이어 간다")
        const error = `독립 리뷰를 하지 못함: ${message(e)}`
        this.problem(error)
        await this.failReview(taskId, codeReview, error, started, controller.signal)
      })
      .catch((e: unknown) => this.problem(`독립 리뷰의 실패를 넣지 못함: ${message(e)}`))
      .finally(() => {
        if (this.reviews.get(taskId) === controller) this.reviews.delete(taskId)
        this.reviewProgress.delete(taskId)
        // 아직 독립 리뷰 중이면 남은 진행 표시를 지운다: 상태가 바뀌지 않아 스냅샷이 지우지 않는다. 바뀌었으면(다시 엶,
        // 중단됨) 그 스냅샷이 지운다
        const t = this.task(taskId)
        if (t?.status === 'reviewing')
          this.ctx.ui.activity({ workKey: this.key, taskId, activity: this.activityOf(t) })
        if (this.reviewRuns.get(taskId) === run) this.reviewRuns.delete(taskId)
      })
    this.reviewRuns.set(taskId, run)
  }

  /**
   * 끊은 독립 리뷰들이 끝나기를 기다린다: 호출 프로세스가 worktree를 cwd로 잡고 있어, 앞서 끝내지 않으면 Windows에서
   * worktree를 지우지 못한다(EBUSY). 처리 줄 밖에서 기다린다: 리뷰의 마지막 넣기가 처리 줄에 들어가 있다. KILL_WAIT_MS까지만
   */
  private async reviewsIdle(): Promise<void> {
    const runs = [...this.reviewRuns.values()]
    if (runs.length) await Promise.race([Promise.all(runs), sleep(KILL_WAIT_MS)])
  }

  /** 돌리지 못한 독립 리뷰를 실패한 결과로 끝낸다 (D495): 결과 글에 까닭을 쓰고 review.finished를 넣는다 */
  private async failReview(
    taskId: string,
    codeReview: boolean,
    error: string,
    started: number,
    signal: AbortSignal,
  ): Promise<void> {
    const task = this.task(taskId)
    if (!task || signal.aborted || this.closing) return
    const result: ReviewResult = {
      codeReview,
      findError: codeReview ? error : null,
      checkError: error,
      findings: [],
      later: [],
      objections: [],
    }
    try {
      await writeFileAtomic(
        path.join(this.files.taskDir(task), REVIEW_RESULT_FILE),
        reviewMarkdown(result),
      )
    } catch (e) {
      this.problem(`독립 리뷰 결과 글을 쓰지 못함: ${message(e)}`)
    }
    await this.feedReviewFinished(taskId, signal, {
      error,
      findings: 0,
      objections: 0,
      ms: Date.now() - started,
    })
  }

  /**
   * review.finished를 넣는다. 그사이 [Work 포기]나 앱 종료로 끊겼으면 넣지 않는다: 끝내는 앱이 같은 대화를 다시 열지 않는다
   * (D496. 다음 실행 때 처음부터 다시 돌린다)
   */
  private feedReviewFinished(
    taskId: string,
    signal: AbortSignal,
    r: { error?: string; findings: number; objections: number; ms: number },
  ): Promise<void> {
    return this.enqueue(async () => {
      if (signal.aborted || this.closing) return
      await this.feed({
        type: 'review.finished',
        taskId,
        at: this.ctx.at(),
        ...(r.error ? { error: r.error } : {}),
        findings: r.findings,
        objections: r.objections,
        ms: r.ms,
      })
    })
  }

  /**
   * 독립 리뷰 (D495): 변경 파일을 만들고, 찾기(codeReview일 때)와 확인을 차례로 부르고, 결과 글과 기록을 쓴 뒤
   * review.finished를 넣는다. 호출이 실패해도 결과 글에 까닭을 적고 이어 간다. [Work 포기]로 끊기면 아무것도 넣지 않는다
   */
  private async runReview(taskId: string, codeReview: boolean, signal: AbortSignal): Promise<void> {
    const task = this.task(taskId)
    if (!task) return
    const started = Date.now()
    const { env } = this.ctx
    const dir = this.files.taskDir(task)
    const brief = await this.reviewBrief(task, dir)
    const guide = selectFlags(
      await fsp.readFile(path.join(this.ctx.skills, REVIEW_GUIDE_FILE), 'utf8'),
      assemblyFlags(this.work),
    )
    const engine = taskEngine(task)
    const bin = engine === 'codex' ? findCodex({ env }) : findClaude({ env })
    const calls: CallRecord[] = []
    const progress = (next: ReviewProgress | null) => {
      if (next) this.reviewProgress.set(taskId, next)
      else this.reviewProgress.delete(taskId)
      const t = this.task(taskId)
      if (t) this.ctx.ui.activity({ workKey: this.key, taskId, activity: this.activityOf(t) })
    }
    const call = async (kind: CallRecord['kind'], prompt: string, schema: object) => {
      // 진행 기록 (D502): 호출마다 independent-review/<kind>.log에 도구와 모델의 글을 시각과 함께 줄마다 쓴다
      const log = path.join(dir, REVIEW_INPUT_DIR, reviewLogFile(kind))
      const clock = () => new Date().toTimeString().slice(0, 8)
      // 기록을 쓰지 못해도 리뷰는 이어 간다
      let writing: Promise<void> = fsp
        .writeFile(
          log,
          `${clock()} ${REVIEW_PHASE[kind]} 시작 (${AGENT_LABELS[engine]}${task.model ? `, 모델 ${task.model}` : ''})\n`,
        )
        .catch(() => undefined)
      const write = (text: string) => {
        writing = writing.then(() => fsp.appendFile(log, `${text}\n`)).catch(() => undefined)
      }
      let state: ReviewProgress = { call: kind, since: Date.now(), tool: null, recent: [] }
      progress(state)
      const onEvent = (e: Record<string, unknown>) => {
        for (const step of reviewSteps(e, this.worktree)) {
          const line = reviewLogLine(step, clock())
          if (line) write(line)
          const now = Date.now()
          if (step.kind === 'tool') {
            const recent = state.tool
              ? [...state.recent, state.tool.label].slice(-REVIEW_RECENT)
              : state.recent
            state = {
              ...state,
              recent,
              tool: { id: step.id, label: step.label, startedAt: now, endedAt: null },
            }
          } else if (
            step.kind === 'done' &&
            state.tool?.id === step.id &&
            state.tool.endedAt === null
          ) {
            state = { ...state, tool: { ...state.tool, endedAt: now } }
          } else continue
          if (this.reviewProgress.get(taskId)?.call === kind) progress(state)
        }
      }
      const input = {
        env,
        cwd: this.worktree,
        model: task.model ?? '',
        system: INDEPENDENT_REVIEW_SYSTEM,
        prompt,
        schema,
        timeoutMs: REVIEW_CALL_TIMEOUT_MS,
        tools: REVIEW_TOOLS,
        addDirs: [
          this.files.dir,
          ...brief.diffs.map((d) => d.dir).filter((d) => d !== this.worktree),
        ],
        signal,
      }
      const r = !bin
        ? {
            data: null,
            ms: 0,
            costUsd: null,
            usage: null,
            error: `${AGENT_LABELS[engine]}를 찾지 못함`,
          }
        : engine === 'codex'
          ? await codexJson({ ...input, bin })
          : await claudeJson({
              ...input,
              bin,
              ...(task.effort ? { effort: task.effort } : {}),
              onEvent,
            })
      calls.push({ kind, ms: r.ms, cost_usd: r.costUsd, usage: r.usage, error: r.error })
      if (engine === 'codex') write('(Codex는 도는 동안의 도구를 받지 않는다)')
      write(
        `${clock()} ${REVIEW_PHASE[kind]} 끝 (${Math.round(r.ms / 1000)}초)${r.error ? `: ${r.error}` : ''}`,
      )
      await writing
      return r
    }
    let found: ReturnType<typeof readFind> = { candidates: [], later: [] }
    let findError: string | null = null
    if (codeReview) {
      const r = await call('find', findPrompt(reviewPart(guide, 'Finder'), brief), FIND_SCHEMA)
      found = r.error ? null : readFind(r.data)
      findError = r.error ?? (found ? null : '구조화된 출력을 읽지 못함')
      const last = calls[calls.length - 1]
      if (last) last.count = found?.candidates.length ?? 0
    }
    if (signal.aborted) return
    const candidates = found?.candidates ?? []
    const verification = path.join(dir, VERIFICATION_FILE)
    const verificationText = (await readText(verification)) ?? ''
    const r = await call(
      'check',
      checkPrompt(reviewPart(guide, 'Checker'), brief, candidates, {
        path: verification,
        text: verificationText,
      }),
      CHECK_SCHEMA,
    )
    if (signal.aborted) return
    const checked = r.error ? null : readCheck(r.data, candidates)
    const checkError = r.error ?? (checked ? null : '구조화된 출력을 읽지 못함')
    const last = calls[calls.length - 1]
    if (last) last.count = checked?.findings.length ?? 0
    // 확인이 실패하면 찾기의 후보를 확인하지 않은 채(가능성) 남긴다: 실제 결함을 버리지 않는다 (D486)
    const result: ReviewResult = {
      codeReview,
      findError,
      checkError,
      findings:
        checked?.findings ??
        sortFindings(candidates.map((c) => ({ ...c, check: 'plausible' as const, evidence: '' }))),
      later: found?.later ?? [],
      objections: checked?.objections ?? [],
    }
    await writeFileAtomic(path.join(dir, REVIEW_RESULT_FILE), reviewMarkdown(result))
    await writeFileAtomic(
      path.join(dir, REVIEW_RECORD_FILE),
      `${JSON.stringify({ engine, code_review: codeReview, calls }, null, 2)}\n`,
    )
    const error = reviewError(result)
    await this.feedReviewFinished(taskId, signal, {
      ...(error ? { error } : {}),
      findings: result.findings.length,
      objections: result.objections.length,
      ms: Date.now() - started,
    })
  }

  /**
   * 독립 리뷰의 브리프 재료 (D495): 기준 커밋부터의 변경 파일(레포마다, 추적하지 않는 새 파일 목록과 함께), intent, 앞 단계들과
   * 이 task의 산출물 경로, 커스텀 유형의 리뷰 관점. 변경 파일은 task 디렉터리의 independent-review/에 쓴다
   */
  private async reviewBrief(task: TaskRecord, dir: string): Promise<ReviewBrief> {
    const env = this.ctx.env
    const inputDir = path.join(dir, REVIEW_INPUT_DIR)
    await fsp.rm(inputDir, { recursive: true, force: true })
    await fsp.mkdir(inputDir, { recursive: true })
    const sources: { repo: string; dir: string; base: string }[] = [
      ...(mainEditable(this.work)
        ? [{ repo: '', dir: this.worktree, base: this.work.base_commit }]
        : []),
      ...workRepos(this.work).map((r) => ({
        repo: r.path,
        dir: this.repoTree(r.path),
        base: r.base_commit,
      })),
    ]
    const diffs: ReviewDiff[] = []
    for (const s of sources) {
      const file = path.join(
        inputDir,
        s.repo ? `${s.repo.replaceAll('/', '__')}.patch` : 'diff.patch',
      )
      const [diff, untracked] = await Promise.all([
        diffFrom(s.dir, s.base, null, { env }).catch(
          (e: unknown) => `(변경을 읽지 못함: ${message(e)})`,
        ),
        untrackedPaths(s.dir, { env }).catch(() => []),
      ])
      await writeFileAtomic(file, diff)
      diffs.push({ ...s, file, untracked })
    }
    const artifacts: { title: string; path: string }[] = []
    for (const t of this.work.tasks) {
      if (t.status === 'discarded' || !isPipelineNode(t.node) || t.seq > task.seq) continue
      for (const f of await this.files.artifacts(t)) {
        if (path.basename(f) === REVIEW_RESULT_FILE) continue
        artifacts.push({ title: `${taskTitle(this.work, t)} (${t.id})`, path: f })
      }
    }
    const intent = await this.files.readOwned('intent.md')
    // 유형의 리뷰 관점 (D507): 커스텀은 복사한 유형 폴더, 기본 유형은 앱의 skills/types/<유형>/의 verify.md
    const type = workType(this.work)
    const typeDir =
      type === 'custom' ? this.files.customType : builtinTypeDir(this.ctx.skills, type)
    const points = (await readText(path.join(typeDir, VERIFY_NOTES_FILE))) ?? ''
    return {
      type: workType(this.work),
      worktree: this.worktree,
      intent: intent?.text ?? null,
      contextPath: path.join(dir, CONTEXT_FILE),
      artifacts,
      diffs,
      reviewPoints: points,
    }
  }

  /**
   * 지식 검토 호출 (D300). verify의 Stop 훅이 Work 줄에 들어가기 전에 부른다: 모델을 기다리는 동안(최대 REVIEW_TIMEOUT_MS)
   * 이 Work의 다른 명령([즉시 중단], 승인 등)이 막히지 않는다. 같은 입력의 기록이 있거나 task마다 REVIEW_CALL_LIMIT번을
   * 불렀으면 부르지 않는다. 결과는 기록(REVIEW_FILE)에 남기고, 줄 안의 Stop 확인이 읽어 되돌릴지 정한다
   */
  private async prepareKnowledgeReview(taskId: string): Promise<void> {
    const task = this.task(taskId)
    if (!task || !completesWork(this.work, task) || !knowledgeEnabled(this.ctx.env)) return
    const input = await this.knowledgeCheckInput(task, await this.files.taskFiles(task))
    if (!input || !this.wantsReview(input, knowledgeIssues(input))) return
    const req = await this.reviewRequest(task, input)
    const before = await this.readReviewRecord(task)
    if (before.calls.some((c) => c.hash === req.hash)) return
    if (before.calls.length >= REVIEW_CALL_LIMIT) return
    const { env } = this.ctx
    // 설정에서 고른 CLI와 모델로 부른다 (D334). 찾지 못하면 부르지 않고 그 까닭을 기록해 경고로 보인다
    const { engine, model } = reviewTarget(this.ctx.config(), env)
    const bin = engine === 'codex' ? findCodex({ env }) : findClaude({ env })
    const call = {
      env,
      cwd: this.worktree,
      model,
      system: REVIEW_SYSTEM,
      prompt: req.prompt,
      schema: REVIEW_SCHEMA,
      timeoutMs: REVIEW_TIMEOUT_MS,
    }
    const result = !bin
      ? {
          data: null,
          ms: 0,
          costUsd: null,
          usage: null,
          error: `${AGENT_LABELS[engine]}를 찾지 못함`,
        }
      : engine === 'codex'
        ? await codexJson({ ...call, bin })
        : await claudeJson({ ...call, bin, effort: 'low' })
    // 기다리는 동안 다른 호출이 기록을 썼을 수 있으니 다시 읽고 더한다
    const record = await this.readReviewRecord(task)
    if (record.calls.some((c) => c.hash === req.hash)) return
    record.calls.push({
      at: this.ctx.at(),
      hash: req.hash,
      engine,
      model: model || `${engine} 기본`,
      ms: result.ms,
      costUsd: result.costUsd,
      usage: result.usage,
      related: req.related,
      promptChars: req.prompt.length,
      issues: reviewIssues(result.data, req.known),
      bounced: false,
      error: result.error,
    })
    await this.writeReviewRecord(task, record)
    this.freshReview.set(task.id, req.hash)
  }

  /**
   * 지식 검토의 결과 (D300): 같은 입력의 기록이 없으면 문제 없음. 그 Stop 직전에 새로 부른 결과(freshReview)이고 이 task에서
   * 아직 되돌린 적이 없으면 되돌리고 기록에 남긴다. 그 밖(승인 화면, 같은 입력으로 다시 Stop 등)은 경고로만 보인다
   */
  private async knowledgeReviewResult(
    task: TaskRecord,
    check: Parameters<typeof knowledgeIssues>[0],
    stop: boolean,
  ): Promise<{ issues: FormatIssue[]; bounce: boolean }> {
    const req = await this.reviewRequest(task, check)
    const record = await this.readReviewRecord(task)
    const done = record.calls.find((c) => c.hash === req.hash)
    if (!done) return { issues: [], bounce: false }
    const fresh = stop && this.freshReview.get(task.id) === req.hash
    if (fresh && done.issues.length > 0 && !record.calls.some((c) => c.bounced)) {
      // 되돌릴지는 core가 정한다(바뀐 것이 없거나 되돌림 상한이면 되돌리지 않음). 실제로 되돌렸을 때만 기록한다 (D328)
      this.reviewBounce.set(task.id, req.hash)
      return { issues: done.issues, bounce: true }
    }
    if (fresh) this.freshReview.delete(task.id)
    // 부르지 못했으면 문제 없음으로 보되(D300) 경고로 알린다 (D334)
    return { issues: done.error ? [reviewFailedIssue(done.error)] : done.issues, bounce: false }
  }

  /**
   * 검토의 되돌림을 마무리한다 (D328): core가 이 Stop을 되돌렸으면 그 호출을 "되돌림"으로 기록하고, 아니면 다음에 다시
   * 마무리를 시도하는 Stop에서 되돌릴 수 있게 그대로 둔다
   */
  private async settleReviewBounce(task: TaskRecord, blocked: boolean): Promise<void> {
    const hash = this.reviewBounce.get(task.id)
    this.reviewBounce.delete(task.id)
    if (hash === undefined || !blocked) return
    this.freshReview.delete(task.id)
    const record = await this.readReviewRecord(task)
    const call = record.calls.find((c) => c.hash === hash)
    if (!call) return
    call.bounced = true
    await this.writeReviewRecord(task, record)
  }

  /** handoffChanged를 정할 때의 이번 턴 상태 (D21, D328). verify는 레포의 지식 파일도 본다 */
  private async turnState(
    task: TaskRecord,
    files: Readonly<Record<string, string>>,
  ): Promise<string> {
    if (!completesWork(this.work, task) || !knowledgeEnabled(this.ctx.env))
      return turnSnapshot(task, files)
    try {
      const entries = await readRepoKnowledge(this.worktree)
      // 바뀌었는지만 보면 되므로 경로와 해시만 든다
      return turnSnapshot(task, files, JSON.stringify(entries.map((e) => [e.path, sha256(e.text)])))
    } catch {
      return turnSnapshot(task, files)
    }
  }

  private notify(body: string): void {
    this.ctx.ui.notify({ workKey: this.key, title: `relay: ${this.title}`, body })
  }

  // ---------- 세션 상한과 대기열 (D18) ----------

  private slotKey(taskId: string): string {
    return `${this.key}/${taskId}`
  }

  /**
   * 세션을 띄울 자리를 잡는다. 자리가 있으면 바로 띄우고, 없으면 대기열에 넣는다.
   * 세션이 있던 task는 --resume으로 다시 열고, 없던 task는 새 세션으로 시작한다.
   */
  private async requestSession(taskId: string): Promise<void> {
    // SessionEnd 훅으로 세션이 끝났다고 본 뒤에도 PTY가 아직 끝나지 않았을 수 있다. 다시 열기 전에 끝내고
    // 자리를 돌려받는다. 앞 세션의 늦은 출력과 훅이 다시 연 세션에 섞이지 않는다
    if (this.live.has(taskId)) await this.endSession(taskId)
    if (this.ctx.pool.tryAcquire()) {
      await this.launchTask(taskId)
      return
    }
    await this.feed({ type: 'task.queued', taskId, at: this.ctx.at() })
    if (this.task(taskId)?.status !== 'queued') return
    this.ctx.pool.enqueue(this.slotKey(taskId), () => {
      void this.enqueue(() => this.startQueued(taskId))
    })
  }

  /** 대기열에서 자리가 났다. 풀이 잡아 둔 자리를 쓰거나, 더 기다리지 않는 task면 돌려준다 */
  private async startQueued(taskId: string): Promise<void> {
    const task = this.task(taskId)
    if (!task || task.status !== 'queued' || task !== currentTask(this.work)) {
      this.ctx.pool.release()
      return
    }
    if (await this.launchTask(taskId)) {
      // 대기열에서 자동으로 시작했으면 알린다 (시나리오 2-6, D81)
      this.notify(`${taskLabel(task)}: 대기열에서 자동 시작`)
    }
  }

  /** 잡은 자리로 세션을 띄운다. 띄우지 못하면 자리를 돌려준다 */
  private async launchTask(taskId: string): Promise<boolean> {
    const task = this.task(taskId)
    if (!task) {
      this.ctx.pool.release()
      return false
    }
    this.launchedAt.set(taskId, Date.now())
    return task.session ? this.resumeSession(task) : this.startSession(task)
  }

  /**
   * 띄우다 실패했다. 세션을 걸었으면 끝내고(자리도 돌려줌), 아니면 자리만 돌려준다.
   * 유효한 handoff가 있으면 승인 대기나 막힘으로 남도록 그때의 검사를 넘긴다 (3.3).
   */
  private async launchFailed(taskId: string, err: unknown): Promise<false> {
    if (this.live.has(taskId)) await this.endSession(taskId)
    else this.ctx.pool.release()
    const check = await this.checkNow(taskId)
    await this.feed({
      type: 'session.failed',
      taskId,
      at: this.ctx.at(),
      error: message(err),
      ...(check ? { check } : {}),
    })
    return false
  }

  /** task 파일을 다시 읽어 한 형식 검사. 읽지 못하면 undefined */
  private async checkNow(taskId: string): Promise<TaskCheck | undefined> {
    const task = this.task(taskId)
    if (!task) return undefined
    try {
      return await this.checkOf(task)
    } catch {
      return undefined
    }
  }

  // ---------- task 시작 (시나리오 2) ----------

  /**
   * task 디렉터리와 시작 커밋, 스킬 배포, 설정 파일, context.md, PTY 실행 (시나리오 2).
   * PTY를 띄운 직후 첫 훅보다 먼저 session.started를 넣는다. 훅은 이 처리가 끝날 때까지 줄에서 기다린다.
   */
  private async startSession(task: TaskRecord): Promise<boolean> {
    const { env } = this.ctx
    try {
      const dir = this.files.taskDir(task)
      await fsp.mkdir(dir, { recursive: true })
      // 한 번 시작했던 task를 새 세션으로 다시 시작한다(대화 ID를 받지 못한 Codex, D423, I154). 앞 세션이 남긴
      // handoff.md가 새 세션의 턴 끝 검사에 읽히지 않게 지운다. 산출물은 새 세션이 다시 쓴다
      if (task.start_commit) await fsp.rm(path.join(dir, HANDOFF_FILE), { force: true })
      const startCommit = await headCommit(this.worktree, { env })
      const repoStarts = await this.repoHeads()
      const driver = agentRuntime(taskEngine(task))
      const bin = driver.find(env)
      if (!bin) throw new Error(driver.installGuide)
      const skill = NODE_INFO[task.node].skill
      const contextPath = path.join(dir, CONTEXT_FILE)
      const deployed = await driver.deploySkill({
        source: this.ctx.skills,
        workDir: this.files.dir,
        taskDir: dir,
        contextPath,
        skill,
        type: workType(this.work),
        ...this.typeSource(task),
        finishing: finishesWork(this.work, task),
      })
      const version = await driver.version(bin, env)

      // Work 완료 화면이 되는 task의 마무리 안내 문구(D104)와 전달 버튼이 쓸 점검을 새로 한다 (D118, D500)
      if (completesWork(this.work, task)) await this.recheckProject()
      const settingsPath = await this.writeSettings(task)
      await writeFileAtomic(contextPath, await this.context(task, dir, this.approvedBefore(task)))

      // Codex의 id는 SessionStart/턴 훅에서 받는다. 임의의 UUID로 재개하지 않는다.
      const sessionId = driver.engine === 'claude' ? randomUUID() : ''
      const token = randomBytes(32).toString('hex')
      const args = await driver.launchArgs({
        sessionId,
        workDir: this.files.dir,
        ...this.extraDirs(),
        settingsPath,
        // 배포한 절차 파일. Claude는 시스템 프롬프트에 덧붙이고(D440), Codex는 설정의 skillPath를 쓴다
        instructionsPath: deployed.file,
        skill,
        contextPath,
        ...pinnedAgent(task),
      })
      const session = this.launch(task, bin, token, args, turnSnapshot(task, {}), startMark(task))
      const processStartedAt = await processStartTime(session.pty.pid)
      await this.feed({
        type: 'session.started',
        taskId: task.id,
        at: this.ctx.at(),
        sessionId,
        pid: session.pty.pid,
        ...(processStartedAt ? { processStartedAt } : {}),
        startCommit,
        ...(Object.keys(repoStarts).length ? { repoStarts } : {}),
        skillHash: deployed.hash,
        engineVersion: version,
      })
      if (driver.engine === 'codex')
        await this.feed({ type: 'input.required', taskId: task.id, at: this.ctx.at() })
      return true
    } catch (err) {
      return this.launchFailed(task.id, err)
    }
  }

  /**
   * 끝난 세션을 같은 옵션과 --resume <세션 id>로 다시 연다 (시나리오 3-4, 3-5, 6절).
   * 설정 파일은 새로 쓴다(훅 서버의 포트와 토큰이 바뀔 수 있음, I13). 단계 절차와 context.md는 그대로 둔다:
   * Claude는 task를 시작할 때 쓴 instructions.md를 같은 플래그로 다시 준다 (D441). 그 파일이 없으면(이 변경 전에 스킬로
   * 시작한 task, 지워진 파일) 지금 원본으로 조립해 쓴다: 빼면 압축 뒤 절차가 사라진다(스파이크 S8).
   * 탭에는 이전 화면을 먼저 보이고 그 뒤에 다시 연 세션의 출력을 잇는다.
   */
  private async resumeSession(task: TaskRecord): Promise<boolean> {
    const { env } = this.ctx
    const sessionId = task.session?.id
    try {
      if (!sessionId) throw new Error('다시 열 세션이 없음')
      const driver = agentRuntime(taskEngine(task))
      const bin = driver.find(env)
      if (!bin) throw new Error(driver.installGuide)
      const version = await driver.version(bin, env)
      const settingsPath = await this.writeSettings(task)
      const files = await this.files.taskFiles(task)
      // 이전 화면을 먼저 보인다. 이 앱에서 돌던 task면 버퍼가 남아 있고, 아니면 pty.log에서 읽는다
      await this.terminalBuffer(task)
      const token = randomBytes(32).toString('hex')
      // 중단됨의 [재개]는 이어서 하라고 알리고(D218), 독립 리뷰가 끝난 세션은 결과를 읽고 이어 하라고 알린다 (D496)
      const input = this.resumeInput.get(task.id)
      const prompt =
        input === 'review'
          ? reviewResumePrompt(path.join(this.files.taskDir(task), REVIEW_RESULT_FILE))
          : input === 'continue'
            ? continuePrompt(task.session?.app_ended !== undefined)
            : undefined
      this.resumeInput.delete(task.id)
      const instructionsPath =
        driver.engine === 'claude' ? await this.instructionsFor(task) : undefined
      const args = await driver.resumeArgs({
        sessionId,
        workDir: this.files.dir,
        ...this.extraDirs(),
        settingsPath,
        ...(instructionsPath ? { instructionsPath } : {}),
        ...pinnedAgent(task),
        ...(prompt ? { prompt } : {}),
      })
      const session = this.launch(
        task,
        bin,
        token,
        args,
        await this.turnState(task, files),
        RESUME_MARK,
      )
      const processStartedAt = await processStartTime(session.pty.pid)
      await this.feed({
        type: 'session.resumed',
        taskId: task.id,
        at: this.ctx.at(),
        pid: session.pty.pid,
        ...(processStartedAt ? { processStartedAt } : {}),
        engineVersion: version,
        check: await this.checkOf(task, files),
      })
      return true
    } catch (err) {
      return this.launchFailed(task.id, err)
    }
  }

  /**
   * 재개할 Claude task의 단계 절차 (D441). 시작할 때 쓴 instructions.md가 있으면 그대로 쓰고, 없으면 지금 원본으로 조립한다.
   * 다시 조립한 절차의 해시는 적지 않는다(work.json의 skill_hash는 시작할 때의 것)
   */
  private async instructionsFor(task: TaskRecord): Promise<string> {
    const dir = this.files.taskDir(task)
    const file = path.join(dir, INSTRUCTIONS_FILE)
    if (await exists(file)) return file
    console.error(`[${this.key}] ${task.id}의 ${INSTRUCTIONS_FILE}가 없어 지금 원본으로 조립한다`)
    const deployed = await agentRuntime('claude').deploySkill({
      source: this.ctx.skills,
      workDir: this.files.dir,
      taskDir: dir,
      contextPath: path.join(dir, CONTEXT_FILE),
      skill: NODE_INFO[task.node].skill,
      type: workType(this.work),
      ...this.typeSource(task),
      finishing: finishesWork(this.work, task),
    })
    return deployed.file
  }

  /**
   * 이번 task의 유형 재료 (5.6.15, D452, D456, D506): 기본 유형은 앱의 skills/types/<유형>/, 커스텀은 복사한 유형 폴더다.
   * 단계 task면 단계 id(기본 유형은 노드 이름)와, 커스텀 단계면 공통 바탕을 붙이는지(step_base)를 넣는다
   */
  private typeSource(task: TaskRecord): { typeSource: TypeSource } {
    const type = workType(this.work)
    const step = task.node === 'custom' ? task.step : isStepNode(task.node) ? task.node : undefined
    const def = customStep(this.work, task)
    return {
      typeSource: {
        dir: type === 'custom' ? this.files.customType : builtinTypeDir(this.ctx.skills, type),
        ...(step ? { step } : {}),
        flags: assemblyFlags(this.work),
        ...(def ? { stepBase: def.step_base !== false } : {}),
      },
    }
  }

  /**
   * 이 task보다 앞의 승인된 task. context.md의 입력이다 (시나리오 2-4). 폐기된 task(6.2)와 새 세션으로
   * 다시 한 앞 task(D114)는 승인됨이 아니라 들어가지 않는다.
   */
  private approvedBefore(task: TaskRecord): TaskRecord[] {
    return this.work.tasks.filter((t) => t.seq < task.seq && t.status === 'approved')
  }

  /**
   * task 설정 파일을 쓴다 (시나리오 2-3, D113). deny 규칙은 이전 task 디렉터리를 모두 막는다.
   * 폐기된 task와 세션 종료로 남은 task의 파일도 기록이라 고치지 않는다 (6.2).
   */
  private async writeSettings(task: TaskRecord): Promise<string> {
    const settingsPath = path.join(this.files.taskDir(task), SETTINGS_FILE)
    const earlier = this.work.tasks.filter((t) => t.seq < task.seq)
    await writeJson(
      settingsPath,
      agentRuntime(taskEngine(task)).settings({
        port: this.ctx.hooks.port,
        taskId: task.id,
        taskDir: this.files.taskDir(task),
        skill: NODE_INFO[task.node].skill,
        workDir: this.files.dir,
        previousTaskDirs: earlier.map((t) => this.files.taskDir(t)),
        ...pinnedAgent(task),
      }),
    )
    return settingsPath
  }

  /** task의 handoff.md. 없으면 undefined */
  private async handoffOf(task: TaskRecord): Promise<string | undefined> {
    return (await readText(path.join(this.files.taskDir(task), HANDOFF_FILE))) ?? undefined
  }

  /**
   * context.md의 내용 (시나리오 2-4). 폐기된 task(D418 전 기록)는 입력에서 빠진다: 결정 로그의 항목(5.4)과,
   * 승인됨이 아니라 기각 목록, 직전 handoff, 산출물에서도 빠진다 (D424).
   */
  private async context(
    task: TaskRecord,
    dir: string,
    previous: readonly TaskRecord[],
  ): Promise<string> {
    const earlier: PreviousTask[] = []
    for (const t of previous) {
      const handoff = await this.handoffOf(t)
      earlier.push({
        taskId: t.id,
        node: t.node,
        ...(t.step !== undefined ? { step: t.step } : {}),
        ...(handoff === undefined ? {} : { handoff }),
        artifacts: await this.files.artifacts(t),
      })
    }
    const discarded = this.work.tasks.filter((t) => t.status === 'discarded').map((t) => t.id)
    const submodules = await submodulePaths(this.worktree, { env: this.ctx.env }).catch(() => [])
    // task가 초안을 쓸 폴더를 (다시) 만들고 본다 (D421)
    await this.watchDrafts().catch(() => undefined)
    // 읽은 앱 소유 파일을 적힌 해시와 비교한다. 다르면 알리고 그 내용을 쓴다 (D124)
    const request = await this.files.readOwned('request.md')
    const intent = await this.files.readOwned('intent.md')
    const decisions = await this.files.readOwned('decisions.md')
    this.compareOwned({
      'request.md': request?.hash ?? null,
      'intent.md': intent?.hash ?? null,
      'decisions.md': decisions?.hash ?? null,
    })
    const knowledge = await this.knowledgeInput(task, earlier, {
      request: request?.text ?? '',
      intent: intent?.text ?? null,
    })
    if (knowledge)
      await writeFileAtomic(
        path.join(dir, INJECTED_FILE),
        injectedText(knowledge.entries, knowledge.query),
      )
    return buildContext({
      knowledge,
      work: this.work,
      task,
      config: this.ctx.config(),
      taskDir: dir,
      draftsDir: this.draftsDir,
      projectId: this.project.project_id,
      request: { path: this.files.request, text: request?.text ?? '' },
      intent: intent?.text ?? null,
      decisionLog: decisionsWithout(decisions?.text ?? '', discarded),
      ...previousInputs(earlier),
      ...(completesWork(this.work, task) ? { delivery: closingButtons(this.checks()) } : {}),
      respond: await this.respondInput(task),
      // 서브모듈을 읽지 못하면 안내 없이 간다 (D383)
      submodules,
      target: this.targetInput(),
      bundle: this.bundleInput(task, submodules),
    })
  }

  /** context.md의 레포 절 (D474). 묶음 Work가 아니면 null */
  private bundleInput(task: TaskRecord, submodules: readonly string[]): BundleInput | null {
    if (!isBundle(this.work)) return null
    const repos = workRepos(this.work)
    const picked = new Set(repos.map((r) => r.path))
    const verify = completesWork(this.work, task)
    return {
      main: projectName(this.project),
      mainEditable: mainEditable(this.work),
      root: this.worktree,
      repos: repos.map((r) => ({
        path: r.path,
        baseBranch: r.base_branch,
        baseCommit: r.base_commit,
        ...(r.target_branch ? { targetBranch: r.target_branch } : {}),
        ...(verify ? { draft: repoDraftFile(r.path) } : {}),
      })),
      others: submodules.filter((p) => !picked.has(p)),
      ...(verify && mainEditable(this.work) ? { mainDraft: PR_FILE } : {}),
    }
  }

  /** context.md의 서브모듈 Work 절 (D413, D414). 메인 레포의 Work면 null */
  private targetInput(): SubmoduleTarget | null {
    const parent = this.project.parent
    if (!parent) return null
    const main = this.mainProject()
    const root = this.integrationRoot
    const g = this.work.integration
    return {
      main: main ? projectName(main) : parent.project_id,
      path: parent.path,
      integration:
        root && g ? { root, baseBranch: g.base_branch, baseCommit: g.base_commit } : null,
    }
  }

  /**
   * 승인 화면의 메인 통합 검증 worktree 사실 (D414, D415): 서브모듈 worktree의 브랜치와 메인 쪽 변경을 읽는다. 읽기만
   * 한다: 서브모듈 설정 되돌리기는 Work의 처리 줄(턴 끝, 정리, 앱 시작)에서 한다. 메인 통합 검증 worktree가 없으면
   * null. git이 실패해 브랜치를 모르면 브랜치는 알리지 않는다
   */
  private async integrationFacts(taskId: string): Promise<IntegrationFacts | null> {
    const parent = this.project.parent
    if (this.integrationRoot === null || !parent) return null
    const workBranchName = workBranch(this.work)
    const [mainChanges, branch] = await Promise.all([
      this.mainChanges(),
      headBranch(this.worktree, { env: this.ctx.env }).catch(() => workBranchName),
    ])
    return {
      mainChanges,
      branch,
      workBranch: workBranchName,
      repaired: this.submoduleRepaired.has(taskId),
    }
  }

  /**
   * 메인 통합 검증 worktree의 메인 쪽 변경 (D414, D416): 커밋 안 된 변경에서 서브모듈 자리를 빼고, 받아 둔 다른 서브모듈
   * 안의 변경을 더한다. 승인 화면과 정리 요약이 같은 목록을 보인다. 읽지 못한 것은 비워 둔다
   */
  private async mainChanges(): Promise<string[]> {
    const root = this.integrationRoot
    const parent = this.project.parent
    if (root === null || !parent) return []
    const opts = { env: this.ctx.env }
    const [lines, dirty] = await Promise.all([
      statusLines(root, opts).catch(() => []),
      dirtySubmodules(root, opts).catch(() => []),
    ])
    return [
      ...mainSideChanges(lines, parent.path),
      ...dirty.filter((p) => p !== parent.path).map((p) => `서브모듈 ${p} 안의 변경`),
    ]
  }

  /**
   * context.md의 지식 (core/knowledge): 이 worktree의 `docs/knowledge/`와, 같은 프로젝트에서 완료했지만 기준 브랜치에 아직
   * 없는 앞 Work의 지식, 앞 task들의 지식 후보. 지식 관리를 끄면(RELAY_KNOWLEDGE=off) null이다. 읽지 못하면 빈 지식으로 간다
   */
  private async knowledgeInput(
    task: TaskRecord,
    earlier: readonly PreviousTask[],
    hint: { request: string; intent: string | null },
  ): Promise<KnowledgeInput | null> {
    const { env } = this.ctx
    if (!knowledgeEnabled(env)) return null
    let entries: KnowledgeInput['entries'] = []
    let removed: { path: string; from: string }[] = []
    try {
      const repo = await readRepoKnowledge(this.worktree)
      const head = await headCommit(this.worktree, { env })
      const sources = this.ctx.knowledgeSources(this.project.project_id, this.work.work_id)
      const [all, changed, gone] = await Promise.all([
        readPendingKnowledge(this.project.repo_path, head, sources, { env }),
        changedKnowledge(this.worktree, this.work.base_commit, { env }),
        removedKnowledge(this.worktree, this.work.base_commit, { env }),
      ])
      // 이 Work가 기준 커밋 뒤에 더하거나 고치거나 지운 경로는 이 Work의 것이 이긴다: 머지 전 앞 Work의 글로 덮지 않는다
      const mine = new Set([...changed.map((c) => c.path), ...gone])
      const pending = all.filter((e) => !mine.has(e.path))
      entries = mergeEntries(repo, pending)
      const present = new Set(entries.map((e) => e.path))
      removed = pending
        .filter((e) => e.removed && !present.has(e.path) && repo.some((r) => r.path === e.path))
        .map((e) => ({ path: e.path, from: e.pendingFrom ?? '' }))
    } catch (e) {
      console.error(`[${this.key}] 지식을 읽지 못함: ${message(e)}`)
    }
    const candidates = earlier
      .map((p) => ({ taskId: p.taskId, node: p.node, items: candidatesOf(p.handoff ?? '') }))
      .filter((c) => c.items.length > 0)
    const size = entries.reduce((n, e) => n + e.text.length, 0)
    return {
      entries,
      candidates,
      work_id: this.work.work_id,
      date: this.ctx.at().slice(0, 10),
      ...(removed.length ? { removed } : {}),
      // 지식이 상한을 넘을 때만 관련 항목을 고를 단서를 만든다 (D295)
      ...(size > INJECT_LIMIT ? { query: await this.knowledgeQuery(task, hint, candidates) } : {}),
    }
  }

  /**
   * 관련 지식을 고르는 단서 (D295): 요청과 intent, 지식 후보, 이 Work의 diff(바꾼 파일과 코드 이름), verify는 이 Work가 쓰거나
   * 고친 지식. diff를 읽지 못하면 글만 쓴다
   */
  private async knowledgeQuery(
    task: TaskRecord,
    hint: { request: string; intent: string | null },
    candidates: readonly { items: readonly string[] }[],
  ): Promise<KnowledgeQuery> {
    const { env } = this.ctx
    const parts = [hint.request, hint.intent ?? '', ...candidates.flatMap((c) => c.items)]
    const paths = new Set<string>()
    const identifiers = new Set<string>()
    if (task.node !== 'intake') {
      try {
        const diff = (await diffFrom(this.worktree, this.work.base_commit, null, { env })).slice(
          0,
          200_000,
        )
        for (const m of diff.matchAll(/^\+\+\+ b\/(.+)$/gm)) if (m[1]) paths.add(m[1])
        const changedLines = diff
          .split('\n')
          .filter((l) => /^[+-][^+-]/.test(l))
          .join('\n')
        for (const id of identifiersIn(changedLines)) identifiers.add(id)
        if (completesWork(this.work, task)) {
          for (const c of await changedKnowledge(this.worktree, this.work.base_commit, { env }))
            parts.push(c.text)
        }
      } catch (e) {
        console.error(`[${this.key}] diff를 읽지 못함: ${message(e)}`)
      }
    }
    const text = parts.join('\n')
    for (const p of pathsIn(text)) paths.add(p)
    for (const id of identifiersIn(text)) identifiers.add(id)
    return { text, paths: [...paths], identifiers }
  }

  /**
   * PR 대응 task의 입력 (D192, 시나리오 10-4): 이번 라운드의 항목, 사람 지시, PR 정보와 앱이 fetch한 원격 브랜치의 커밋,
   * 앞 대응 라운드의 handoff 요약. 대응 task가 아니면 null
   */
  private async respondInput(task: TaskRecord): Promise<RespondInput | null> {
    const r = task.respond
    const lane = laneOf(task)
    const w = this.laneWork(lane)
    const pr = w.pr
    if (task.node !== RESPOND || !r || !pr) return null
    const file = await this.prItems(lane)
    const items = r.items
      .map((id) => file.items.find((i) => i.id === id))
      .filter((i): i is PrItem => i !== undefined)
    const previous: PreviousRound[] = []
    for (const t of respondTasks(w)) {
      if (t.seq >= task.seq || t.status !== 'approved') continue
      const handoff = await this.handoffOf(t)
      previous.push({
        taskId: t.id,
        round: t.respond.round,
        items: t.respond.items,
        instruction: t.respond.instruction,
        summary: handoff === undefined ? null : handoffSummary(handoff),
      })
    }
    const opts = { env: this.ctx.env }
    const repo = this.laneRepo(lane)
    const branch = workBranch(this.work)
    return {
      round: r.round,
      ...(task.reason === 'auto_respond' ? { auto: true } : {}),
      instruction: r.instruction,
      pr: { number: pr.number, url: pr.url, head: pr.head },
      branch,
      remote: {
        base: await refCommit(repo, `refs/remotes/origin/${targetBranch(w)}`, opts),
        branch: await refCommit(repo, `refs/remotes/origin/${branch}`, opts),
      },
      items,
      previous,
      ...(lane ? { repo: { path: lane, base: targetBranch(w) } } : {}),
    }
  }

  // ---------- 등록 점검 (D67, D118) ----------

  /** 이 프로젝트의 origin·gh 점검 결과 */
  private checks(): ProjectChecks {
    return this.ctx.checks(this.project.project_id) ?? this.project.checks
  }

  /** origin·gh를 다시 점검한다 (D118). 실패하면 앞의 결과를 쓴다 */
  private async recheckProject(): Promise<void> {
    try {
      await this.ctx.recheck(this.project.project_id)
    } catch (e) {
      this.problem(`origin·gh 점검 실패: ${message(e)}`)
    }
    // 묶음 Work는 서브모듈마다 점검한다 (D477)
    for (const r of workRepos(this.work)) {
      try {
        this.repoCheckMap.set(r.path, await this.ctx.repoChecks(this.repoDir(r.path)))
      } catch (e) {
        this.repoCheckMap.delete(r.path)
        this.problem(`${r.path}의 origin·gh 점검 실패: ${message(e)}`)
      }
    }
  }

  /** Work 완료 화면의 [다시 점검] (D118). 전달 버튼과 이유가 바뀐다 */
  recheck(): Promise<CommandResult> {
    return this.enqueue(async () => {
      await this.recheckProject()
      this.changed()
      return { ok: true }
    })
  }

  /** 프로젝트의 점검이 바뀌었다. 승인 화면을 다시 읽게 스냅샷을 보낸다 */
  touch(): void {
    this.changed()
  }

  /**
   * PTY로 claude를 띄우고 훅 토큰, 감시, pty.log를 건다 (시나리오 2-5, I13, I15).
   * 잡은 세션 자리는 세션이 끝날 때(release) 돌려준다. mark가 있으면 새 출력 앞에 넣는다.
   */
  private launch(
    task: TaskRecord,
    bin: string,
    token: string,
    args: string[],
    turnFiles: string,
    mark?: string,
  ): LiveSession {
    const { cols, rows } = this.ctx.size()
    const pty = startPty({
      bin,
      args,
      cwd: this.worktree,
      env: {
        ...this.agentEnv(),
        ...agentRuntime(taskEngine(task)).launchEnv(token, this.ctx.hooks.port, task.id),
      },
      cols,
      rows,
      answerQueries: true,
    })
    // 출력 구독은 같은 틱에 건다. PTY를 띄우지 못하면 로그를 열지 않는다
    const log = this.files.openPtyLog(task)
    const buffer = this.terminals.get(task.id) ?? new TerminalBuffer()
    buffer.start({ cols, rows })
    this.terminals.set(task.id, buffer)
    const key = this.terminalKey(task.id)
    let exited!: () => void
    const session: LiveSession = {
      pty,
      log,
      unregister: () => {},
      unwatch: () => {},
      exited: new Promise((r) => (exited = r)),
      turnFiles,
      stopped: false,
      ending: false,
      hooksReady: false,
      spawnedAt: Date.now(),
      sawOutput: false,
      sawHook: false,
      turnStartedAt: null,
      tool: null,
    }
    const write = (data: string) => {
      log.write(data)
      this.ctx.ui.terminal(key, buffer.push(data))
    }
    if (mark) write(mark)
    pty.onData((data) => {
      // 끝낸 세션의 늦은 출력은 다시 연 세션의 화면에 섞지 않는다
      if (session.stopped) return
      write(data)
      // 첫 출력은 보이는 글자로 잰다. Windows에서는 CLI의 첫 화면보다 ConPTY의 제어 문자가 먼저 온다 (D217)
      if (!session.sawOutput && hasVisibleText(data)) {
        session.sawOutput = true
        this.timing(task.id, session, 'output')
      }
    })
    pty.onExit(() => {
      exited()
      void this.enqueue(() => this.onExit(task.id, session))
    })
    session.unregister = this.ctx.hooks.register(
      token,
      task.id,
      (req) => this.hookArrived(task.id, req, session),
      taskEngine(task) === 'codex'
        ? {
            failClosed: true,
            question: (body, signal) => this.askHuman(task.id, session, body, signal),
          }
        : {},
    )
    session.unwatch = watchDir(this.files.taskDir(task), () => {
      void this.enqueue(() => this.onWatch(task.id))
    })
    this.live.set(task.id, session)
    return session
  }

  // ---------- 세션 동안 (시나리오 3) ----------

  /** 답변 Promise를 처리 줄 밖에서 기다린다. 기다리는 동안 중단/IPC/다른 훅을 받을 수 있다. */
  private async askHuman(
    taskId: string,
    owner: LiveSession | CleanupSession,
    body: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<HookReply> {
    const result = await this.enqueue(async () => {
      const active =
        taskId === CLEANUP_ID
          ? this.cleanup === owner && this.cleanup.status === 'live'
          : this.live.get(taskId) === owner && this.task(taskId)?.session?.alive === true
      if (!active || signal.aborted)
        return { reply: { cancelled: true, reason: '세션이 끝났습니다.' } }
      if (owner.question)
        return { reply: { cancelled: true, reason: '앞 질문의 답변을 먼저 기다리세요.' } }
      const questions = humanQuestions(body['questions'])
      let resolve!: (reply: HumanAnswerReply) => void
      const waiting = new Promise<HumanAnswerReply>((r) => {
        resolve = r
      })
      const pending: PendingHumanQuestion = { view: { id: randomUUID(), questions }, resolve }
      owner.question = pending
      const aborted = () => {
        void this.enqueue(() =>
          this.finishQuestion(taskId, owner, pending, {
            cancelled: true,
            reason: '질문 호출이 취소되었습니다.',
          }),
        ).catch(() => this.cancelQuestion(owner, '질문 호출이 취소되었습니다.'))
      }
      signal.addEventListener('abort', aborted, { once: true })
      try {
        if (taskId !== CLEANUP_ID)
          await this.feed({ type: 'question.started', taskId, at: this.ctx.at() })
        else {
          if (owner === this.cleanup) this.cleanup.clean = false
          this.changed()
          this.notify('정리 세션에서 답변을 기다립니다.')
        }
      } catch (e) {
        this.cancelQuestion(owner, '질문 상태를 저장하지 못했습니다.')
        signal.removeEventListener('abort', aborted)
        throw e
      }
      if (signal.aborted) aborted()
      return { waiting: waiting.finally(() => signal.removeEventListener('abort', aborted)) }
    })
    if (result.waiting) return { ...(await result.waiting) }
    return result.reply ?? null
  }

  private cancelQuestion(owner: LiveSession | CleanupSession, reason: string): void {
    const pending = owner.question
    delete owner.question
    pending?.resolve({ cancelled: true, reason })
  }

  private async finishQuestion(
    taskId: string,
    owner: LiveSession | CleanupSession,
    pending: PendingHumanQuestion,
    reply: HumanAnswerReply,
  ): Promise<void> {
    if (owner.question !== pending) return
    delete owner.question
    try {
      if (
        taskId !== CLEANUP_ID &&
        this.live.get(taskId) === owner &&
        this.task(taskId)?.session?.alive
      ) {
        await this.feed({ type: 'question.finished', taskId, at: this.ctx.at() })
      } else this.changed()
      pending.resolve(reply)
    } catch (e) {
      pending.resolve({ cancelled: true, reason: '질문 상태를 저장하지 못했습니다.' })
      throw e
    }
  }

  /** question id로 앞 대화/앞 질문의 늦은 답변과 중복 제출을 거절한다. null은 취소다. */
  answerQuestion(taskId: string, questionId: string, answers: unknown): Promise<CommandResult> {
    return this.enqueue(async () => {
      const owner = taskId === CLEANUP_ID ? this.cleanup : this.live.get(taskId)
      const pending = owner?.question
      if (!owner || !pending || pending.view.id !== questionId)
        return { ok: false, error: '이미 끝났거나 바뀐 질문입니다.' }
      try {
        const reply: HumanAnswerReply =
          answers === null
            ? {
                cancelled: true,
                reason: '사람이 질문을 취소했습니다. 취소는 답변이나 동의가 아닙니다.',
              }
            : { cancelled: false, answers: humanAnswers(pending.view.questions, answers) }
        await this.finishQuestion(taskId, owner, pending, reply)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: message(e) }
      }
    })
  }

  /**
   * 세션의 첫 PTY 출력과 첫 훅까지 걸린 시간을 events.jsonl에 남긴다 (D217). 줄에 넣으므로 세션을 띄우는 처리
   * (session.started)가 끝난 뒤에 core에 간다
   */
  private timing(taskId: string, session: LiveSession, first: 'output' | 'hook', hook?: string) {
    const ms = Date.now() - session.spawnedAt
    const pid = session.pty.pid
    void this.enqueue(() =>
      this.feed({
        type: 'session.timing',
        taskId,
        at: this.ctx.at(),
        pid,
        first,
        ...(hook === undefined ? {} : { hook }),
        ms,
      }),
    )
  }

  /** Codex의 도구 보호는 진행 표시의 빠른 응답 경로에서도 먼저 판정한다. */
  private codexToolReply(req: HookRequest, task?: TaskRecord, allowPush = false): HookReply {
    const b = req.body
    const toolName = str(b['tool_name']) ?? ''
    const args = b['tool_input']
    const reason = codexToolDenial(
      {
        workDir: this.files.dir,
        ...(str(b['cwd']) ? { cwd: str(b['cwd']) } : {}),
        worktree: this.worktree,
        ...(task ? { taskDir: this.files.taskDir(task) } : {}),
        previousTaskDirs: this.work.tasks
          .filter((t) => !task || t.seq < task.seq)
          .map((t) => this.files.taskDir(t)),
        ...(allowPush ? { allowPush } : {}),
      },
      toolName,
      typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {},
    )
    if (reason)
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: reason,
        },
      }
    return null
  }

  /**
   * 훅을 받았다. 진행 표시(D216)를 먼저 바꾸고, 질문 도구가 아닌 도구의 훅은 줄에 넣지 않고 바로 답한다: 도구를 쓸
   * 때마다 오므로 앞선 처리(PR 읽기 등)를 기다리게 하면 에이전트가 늦어진다. core는 이 훅으로 상태를 바꾸지 않는다
   */
  private hookArrived(taskId: string, req: HookRequest, session: LiveSession): Promise<HookReply> {
    // 앱이 끝내는 중인 세션의 훅(SessionEnd 등)은 기다리지 않고 답한다 (D231)
    if (this.live.get(taskId) !== session || session.ending) return Promise.resolve(null)
    if (!session.sawHook) {
      session.sawHook = true
      this.timing(taskId, session, 'hook', req.event)
    }
    const b = req.body
    const now = Date.now()
    if (req.event === 'UserPromptSubmit' && str(b['agent_id']) === undefined) {
      session.turnStartedAt = now
      session.tool = null
    }
    if (TOOL_HOOKS.includes(req.event)) {
      const task = this.task(taskId)
      const denial =
        task?.engine === 'codex' && req.event === 'PreToolUse'
          ? this.codexToolReply(req, task)
          : null
      const name = str(b['tool_name']) ?? ''
      const id = str(b['tool_use_id'])
      const before = session.tool
      // 서브에이전트 안의 도구(agent_id가 있음)는 바깥 도구(Task 등)가 도는 동안이다. 바깥 도구를 덮지 않는다
      if (str(b['agent_id']) === undefined) {
        if (req.event === 'PreToolUse') {
          const label = toolLabel(name, b['tool_input'], str(b['cwd']))
          session.tool = {
            name,
            label,
            startedAt: now,
            endedAt: denial ? now : null,
            ...(id ? { id } : {}),
          }
        } else if (
          session.tool?.endedAt === null &&
          (id ? session.tool.id === id : session.tool.name === name)
        ) {
          session.tool = { ...session.tool, endedAt: now }
        }
      }
      if (name !== ASK_TOOL) {
        if (session.tool !== before && this.live.get(taskId) === session) {
          const task = this.task(taskId)
          if (task)
            this.ctx.ui.activity({ workKey: this.key, taskId, activity: this.activityOf(task) })
        }
        return Promise.resolve(denial)
      }
    }
    // verify의 지식 검토 호출(D300)은 줄 밖에서 기다린다: 모델을 기다리는 동안 이 Work의 다른 명령이 막히지 않는다
    if (req.event === 'Stop')
      return this.prepareKnowledgeReview(taskId)
        .catch((e: unknown) => console.error(`[${this.key}] 지식 검토를 하지 못함: ${message(e)}`))
        .then(() => this.enqueue(() => this.onHook(taskId, req, session)))
    return this.enqueue(() => this.onHook(taskId, req, session))
  }

  /** 훅 신호 (시나리오 3의 표). Stop이면 파일을 다시 읽어 검사한다 (I15) */
  private async onHook(taskId: string, req: HookRequest, from: LiveSession): Promise<HookReply> {
    const task = this.task(taskId)
    const session = this.live.get(taskId)
    if (!task) return null
    // 토큰 확인을 지나 처리 줄에서 기다린 앞 프로세스의 요청은 다시 연 세션에 적용하지 않는다 (D144)
    if (session !== from) return null
    const b = req.body
    const engine = taskEngine(task)
    // 훅 본문의 세션 id. /clear 등으로 CLI가 다른 대화로 옮기면 core가 따른다 (D110)
    const sessionId = str(b['session_id'])
    const agentId = str(b['agent_id'])
    // 자식의 상태 신호는 task를 끝내지 않지만 도구 보호는 자식에도 적용한다.
    if (engine === 'codex' && agentId !== undefined && req.event !== 'PreToolUse') return null
    if (engine === 'codex' && !session.hooksReady) {
      session.hooksReady = true
      this.changed()
    }
    const base = {
      taskId,
      at: this.ctx.at(),
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(agentId === undefined ? {} : { agentId }),
    }
    switch (req.event) {
      case 'SessionStart': {
        if (engine !== 'codex') return null
        // SessionStart의 compact source도 지시를 재주입한다. PostCompact는 additionalContext를 지원하지 않는다.
        if (sessionId && sessionId !== task.session?.id && session.question)
          await this.finishQuestion(taskId, session, session.question, {
            cancelled: true,
            reason: '대화가 바뀌었습니다.',
          })
        await this.feed({ type: 'session.identified', ...base })
        const instructions = await readText(
          codexSkillPath(this.files.taskDir(task), NODE_INFO[task.node].skill),
        )
        return {
          hookSpecificOutput: {
            hookEventName: req.event,
            additionalContext: `이번 relay task의 스킬입니다. 이 절차만 따르세요. 컨텍스트: ${path.join(this.files.taskDir(task), CONTEXT_FILE)}\n${instructions ?? ''}`,
          },
        }
      }
      case 'PermissionRequest':
        return (await this.feed({ type: 'input.required', ...base })).reply
      case 'Interrupt': {
        this.cancelQuestion(session, '턴을 중단했습니다.')
        return (
          await this.feed({
            type: 'turn.interrupted',
            ...base,
            check: await this.checkOf(task),
          })
        ).reply
      }
      case 'UserPromptSubmit': {
        if (engine === 'codex' && session.question)
          await this.finishQuestion(taskId, session, session.question, {
            cancelled: true,
            reason: '새 요청을 보냈습니다.',
          })
        if (session)
          session.turnFiles = await this.turnState(task, await this.files.taskFiles(task))
        const mode = str(b['permission_mode'])
        return (
          await this.feed({
            type: 'turn.started',
            ...base,
            ...(mode === undefined ? {} : { permissionMode: mode }),
          })
        ).reply
      }
      // 질문 도구만 온다. 나머지 도구는 hookArrived가 진행 표시만 바꾸고 답했다 (D216)
      case 'PreToolUse':
      case 'PostToolUse':
      case 'PostToolUseFailure': {
        const toolName = str(b['tool_name']) ?? ''
        if (engine === 'claude' && toolName === ASK_TOOL) {
          return (
            await this.feed({
              type: req.event === 'PreToolUse' ? 'question.started' : 'question.finished',
              ...base,
            })
          ).reply
        }
        return null
      }
      case 'Notification': {
        const kind = str(b['notification_type'])
        return (
          await this.feed({
            type: 'Notification',
            ...base,
            ...(kind === undefined ? {} : { notificationType: kind }),
          })
        ).reply
      }
      case 'Stop': {
        if (session.question)
          return {
            decision: 'block',
            reason: '앱 질문창의 답변을 기다리세요. 취소를 답변이나 동의로 해석하지 마세요.',
          }
        // 턴 안에서 한 git submodule update가 바꾼 서브모듈 설정을 바로 되돌린다 (D415)
        await this.guardSubmodule(taskId)
        const files = await this.files.taskFiles(task)
        const snapshot = await this.turnState(task, files)
        const changed = session !== undefined && snapshot !== session.turnFiles
        if (session) session.turnFiles = snapshot
        this.reviewBounce.delete(taskId)
        const reply = (
          await this.feed({
            type: 'turn.completed',
            ...base,
            stopHookActive: b['stop_hook_active'] === true,
            handoffChanged: changed,
            check: await this.checkOf(task, files, { stop: true }),
            // 백그라운드 작업이나 예약된 깨우기를 기다리며 쉬는 중이면 자동 승인하지 않는다 (D129)
            pending: engine === 'codex' ? 'unknown' : pendingBackground(b) ? 'pending' : 'none',
          })
        ).reply
        await this.settleReviewBounce(task, reply?.decision === 'block')
        return reply
      }
      case 'SessionEnd': {
        // Codex의 내부 대화 전환도 SessionEnd(other)를 보낸다. 프로세스 종료는 PTY로 확인한다.
        if (engine === 'codex') return null
        const reason = str(b['reason'])
        // Stop 없이 끝났어도 유효한 handoff가 있으면 승인 대기나 막힘이다 (3.3, D146)
        const check = await this.checkNow(taskId)
        return (
          await this.feed({
            type: 'session.ended',
            ...base,
            ...(reason === undefined ? {} : { reason }),
            ...(check ? { check } : {}),
          })
        ).reply
      }
    }
  }

  /** 감시(I15): 파일이 바뀌면 다시 검사해 패널 표시만 바꾼다 */
  private async onWatch(taskId: string): Promise<void> {
    const task = this.task(taskId)
    if (!task || !this.live.has(taskId)) return
    const check = await this.checkOf(task)
    await this.feed({ type: 'check.updated', taskId, at: this.ctx.at(), check })
  }

  private async onExit(taskId: string, session: LiveSession): Promise<void> {
    await this.release(taskId, session)
    const at = this.ctx.at()
    // Stop 없이 끝났어도 유효한 handoff가 있으면 승인 대기나 막힘이다 (3.3, D146). 이미 끝낸 세션(승인,
    // [즉시 중단] 등)의 PTY 종료는 core가 무시하므로 파일을 읽지 않는다
    const check = this.task(taskId)?.session?.alive ? await this.checkNow(taskId) : undefined
    await this.feed({
      type: 'pty.exit',
      taskId,
      at,
      pid: session.pty.pid,
      ...(check ? { check } : {}),
    })
  }

  /**
   * 세션에 걸어 둔 것을 푼다: 훅 토큰, 감시, pty.log, 세션 자리.
   * session을 주면 그 세션일 때만 푼다. 다시 연 세션을 앞 세션의 늦은 종료가 풀지 않게 한다.
   */
  private async release(taskId: string, expected?: LiveSession): Promise<void> {
    const session = this.live.get(taskId)
    if (!session || session.stopped || (expected && session !== expected)) return
    session.stopped = true
    this.cancelQuestion(session, '세션을 종료했습니다.')
    session.unregister()
    session.unwatch()
    this.live.delete(taskId)
    const buffer = this.terminals.get(taskId)
    if (buffer) buffer.live = false
    // 앱을 끄며 끝낸 세션은 pty.log 끝에 표시 줄을 남긴다 (D219)
    if (this.closing) session.log.write(APP_END_MARK)
    await session.log.close()
    this.ctx.pool.release()
    this.changed()
  }

  /**
   * 세션의 프로세스 트리를 끝내고 pty.log를 닫는다 (시나리오 5-1, 7절). 이 일은 처리 줄 안에서 돈다. Linux와 macOS에서
   * claude는 SIGHUP을 받으면 SessionEnd 훅의 응답을 기다린 뒤 끝나므로, 끝내는 중인 세션의 훅은 줄에 넣지 않고 바로
   * 답한다. 줄에 넣으면 서로 기다려 KILL_WAIT_MS를 다 쓴다 (D231)
   */
  private async endSession(taskId: string): Promise<void> {
    const session = this.live.get(taskId)
    if (!session) return
    session.ending = true
    await session.pty.killTree()
    await Promise.race([session.exited, sleep(KILL_WAIT_MS)])
    await this.release(taskId, session)
  }

  // ---------- 승인 (시나리오 4, 5) ----------

  /** intent 초안으로 intent.md를 확정한다 (4.1, 5.3). 머리글에 Work의 업무 유형을 붙인다 (D236) */
  private async confirmIntent(taskId: string, version: number): Promise<void> {
    const task = this.task(taskId)
    if (!task) throw new Error(`${taskId} 없음`)
    const draft = await readText(path.join(this.files.taskDir(task), INTENT_DRAFT_FILE))
    if (draft === null) throw new Error('intent 초안이 없음')
    const written = await this.files.writeIntent(
      confirmedIntent(draft, { version, type: workType(this.work) }),
      version,
    )
    await this.ownedWritten('intent.md', written)
  }

  /** [승인], [의도 승인], [완료만], [오류 무시하고 승인] (시나리오 4-3, 4.1) */
  approve(taskId: string, opts: ApproveOptions): Promise<CommandResult> {
    return this.enqueue(async () => {
      if (this.cleanupOpen()) return { ok: false, error: CLEANUP_BLOCKS }
      const task = this.task(taskId)
      if (!task) return { ok: false, error: `${taskId} 없음` }
      const check = await this.checkOf(task)
      // PR 대응 task는 승인하면 push하고 답글을 게시한다. 실패하면 그 오류를 돌려준다 (시나리오 10-6)
      this.opError = null
      const r = await this.command({
        type: 'approve',
        taskId,
        at: this.ctx.at(),
        check,
        ...(opts.force ? { force: true } : {}),
      })
      const failed = this.opError
      this.opError = null
      if (!r.ok) return r
      return failed ? { ok: false, error: failed } : { ok: true }
    })
  }

  // ---------- 자동 승인 카운트다운 (4.3, D127~D131) ----------

  /**
   * 카운트다운의 타이머를 건다. 끝나면 파일을 다시 읽어 autoApprove를 넣는다: 그때의 설정과 handoff로 core가 다시
   * 판정한다 (D128). 한 Work에서 카운트다운은 지금 task 하나뿐이라 앞 타이머는 푼다
   */
  private startCountdown(e: Extract<Effect, { type: 'startCountdown' }>): void {
    this.stopCountdown()
    const ms = e.seconds * 1000
    const timer = setTimeout(() => {
      void this.enqueue(() => this.countdownDone(e.taskId, e.startedAt))
    }, ms)
    this.countdown = { taskId: e.taskId, startedAt: e.startedAt, endsAt: Date.now() + ms, timer }
    // 스냅샷은 할 일보다 먼저 나갔다. 끝나는 때를 타이머에 맞춘 스냅샷을 다시 보낸다
    this.changed()
  }

  /** 카운트다운의 타이머를 푼다. taskId를 주면 그 task의 타이머일 때만 푼다 */
  private stopCountdown(taskId?: string): void {
    const c = this.countdown
    if (!c || (taskId !== undefined && c.taskId !== taskId)) return
    clearTimeout(c.timer)
    this.countdown = null
  }

  /** 카운트다운이 끝났다. 멈췄거나 새로 시작한 카운트다운의 늦은 타이머면 아무것도 하지 않는다 */
  private async countdownDone(taskId: string, startedAt: string): Promise<void> {
    const c = this.countdown
    if (c?.taskId === taskId && c.startedAt === startedAt) this.countdown = null
    if (this.task(taskId)?.countdown?.started_at !== startedAt) return
    const check = (await this.checkNow(taskId)) ?? null
    await this.feed({ type: 'autoApprove', taskId, at: this.ctx.at(), startedAt, check })
  }

  /** 카운트다운이 끝나는 때. 이 앱의 타이머가 있으면 그 때, 없으면 기록한 시작 시각으로 센다 */
  private countdownEnds(t: TaskRecord): number {
    const c = this.countdown
    if (c && c.taskId === t.id && c.startedAt === t.countdown?.started_at) return c.endsAt
    return Date.parse(t.countdown?.started_at ?? '') + (t.countdown?.seconds ?? 0) * 1000
  }

  /** 승인 화면의 [취소] (4.3): 카운트다운을 멈추고 사람의 승인을 기다린다 */
  cancelCountdown(taskId: string): Promise<CommandResult> {
    return this.enqueue(() => this.command({ type: 'countdown.cancel', taskId, at: this.ctx.at() }))
  }

  /**
   * 앱 설정이 바뀌었다 (D70). 카운트다운 중에 그 단계의 자동 승인을 껐으면 바로 멈춘다 (D128). 상태가 그대로여도
   * 스냅샷을 다시 보낸다. 승인 화면의 안내(자동 승인 여부)는 설정으로 정하고, 화면은 스냅샷이 바뀔 때 다시 읽는다
   */
  configChanged(): Promise<void> {
    return this.enqueue(async () => {
      const before = this.revision
      await this.feed({ type: 'config.updated', at: this.ctx.at() })
      if (this.revision === before) this.changed()
      // PR 읽기 주기(D158)를 바꿨으면 다음 읽기부터 쓴다
      for (const [lane, L] of this.laneStates) if (L.timer) this.schedulePr(lane)
    })
  }

  // ---------- 사람 조작 (시나리오 3-4, 3-5, 3-6, 4.4) ----------

  /** 명령을 넣고 받아들였는지 돌려준다 */
  private async command(event: MachineEvent): Promise<CommandResult> {
    const { t } = await this.feed(event)
    return t.rejected ? { ok: false, error: t.rejected } : { ok: true }
  }

  /** 정리 세션이 열려 있으면(대기열 포함) 받지 않는 명령 (D137) */
  private unlessCleanup(event: MachineEvent): Promise<CommandResult> {
    if (this.cleanupOpen()) return Promise.resolve({ ok: false, error: CLEANUP_BLOCKS })
    return this.command(event)
  }

  /** 정리 세션이 열려 있다(대기열 포함) */
  private cleanupOpen(): boolean {
    return !!this.cleanup && this.cleanup.status !== 'ended'
  }

  /** [즉시 중단]: 세션을 트리째 끝내고 중단됨으로 남긴다. 대기열의 task는 대기열에서 뺀다 */
  interrupt(taskId: string, reason: InterruptReason = 'human'): Promise<CommandResult> {
    return this.enqueue(async () => {
      const check = await this.checkNow(taskId)
      return this.command({
        type: 'interrupt',
        taskId,
        at: this.ctx.at(),
        reason,
        ...(check ? { check } : {}),
      })
    })
  }

  /** [재개], [세션 재개]: 같은 옵션과 --resume으로 다시 연다. 세션 상한을 넘으면 대기열에 넣는다 */
  resume(taskId: string): Promise<CommandResult> {
    return this.enqueue(() => this.unlessCleanup({ type: 'resume', taskId, at: this.ctx.at() }))
  }

  /** [이 단계 끝나면 멈춤]을 켜거나 끈다 */
  stopAfter(on: boolean): Promise<CommandResult> {
    return this.enqueue(() => this.command({ type: 'stopAfter', at: this.ctx.at(), on }))
  }

  /** 머지 대상 브랜치 (D428) */
  setTarget(branch: string): Promise<CommandResult> {
    return this.enqueue(() => this.command({ type: 'target.set', at: this.ctx.at(), branch }))
  }

  /** [아카이브로 옮기기]: 보관된 Work를 사이드바의 공통 아카이브로 옮긴다 */
  shelve(): Promise<CommandResult> {
    return this.enqueue(() => this.command({ type: 'shelve', at: this.ctx.at() }))
  }

  /** 멈춘 Work의 [재개]: 기본 다음 단계를 시작한다 */
  resumeWork(): Promise<CommandResult> {
    return this.enqueue(() => this.unlessCleanup({ type: 'resumeWork', at: this.ctx.at() }))
  }

  /**
   * [Work 포기]. 끝난 정리 세션이 남아 있으면 치운다. 열려 있으면 받지 않는다 (D137). redo는 다시 하려고 포기할 때다: 이
   * Work의 초안으로 만든 새 Work의 id와, 그 Work가 이 Work의 이슈를 이어 쓰는지 (D421)
   */
  abandon(redo?: { redoBy: string; issueKept: boolean }): Promise<CommandResult> {
    return this.enqueue(async () => {
      const r = await this.unlessCleanup({
        type: 'abandon',
        at: this.ctx.at(),
        ...(redo ? { redoBy: redo.redoBy, ...(redo.issueKept ? { issueKept: true } : {}) } : {}),
      })
      if (r.ok && this.cleanup) {
        await this.endCleanup()
        this.cleanup = null
        this.changed()
      }
      return r
    })
  }

  /**
   * [레포 추가] (D473): 메인 worktree 안의 그 자리에 서브모듈 레포의 worktree를 작업 브랜치로 만들고 묶음 Work에 더한다.
   * 에이전트가 그 자리에 서브모듈을 받아 두었으면 바뀐 것이 없을 때만 deinit하고 만든다. 바뀐 것이 있으면 막는다. 지금
   * 세션에는 알리지 않는다(1.2): 사람이 말하고, 다음 task부터 context.md의 레포 절에 들어간다
   */
  addRepo(repo: WorkRepo): Promise<CommandResult> {
    return this.enqueue(async () => {
      if (cutOperation(this.work)) return { ok: false, error: OPERATION_BLOCKS }
      const w = this.work
      if (this.project.parent || w.integration)
        return { ok: false, error: '서브모듈 Work에는 레포를 더하지 않음' }
      if (w.status !== 'active' && w.status !== 'stopped')
        return { ok: false, error: '진행 중이거나 멈춘 Work에만 레포를 더함' }
      if (w.operation) return { ok: false, error: '진행 중인 작업이 있음' }
      if (workRepos(w).some((r) => r.path === repo.path))
        return { ok: false, error: `이미 고른 레포임: ${repo.path}` }
      const opts = { env: this.ctx.env }
      const tree = this.repoTree(repo.path)
      const dir = this.repoDir(repo.path)
      const name = workBranch(w)
      try {
        if (await refCommit(dir, `refs/heads/${name}`, opts)) {
          return { ok: false, error: `${repo.path}에 작업 브랜치 ${name}가 이미 있음` }
        }
        if (await exists(path.join(tree, '.git'))) {
          // 에이전트가 받아 둔 서브모듈: 바뀐 것이 없으면(가리키는 커밋 그대로, 커밋 안 된 변경 없음) 비우고 만든다
          const changed =
            (await statusLines(tree, opts)).length > 0 ||
            (await headCommit(tree, opts)) !==
              (await gitlinkAt(this.worktree, 'HEAD', repo.path, opts))
          if (changed) {
            return {
              ok: false,
              error: `${repo.path}에 받아 둔 서브모듈이 바뀌어 있음. 그 변경을 정리하거나 옮긴 뒤 다시 누르세요`,
            }
          }
          await clearSubmodule(this.worktree, repo.path)
        }
        await addWorktree(dir, tree, name, repo.base_commit, opts)
      } catch (e) {
        return { ok: false, error: `${repo.path}의 worktree를 만들지 못함: ${message(e)}` }
      }
      const r = await this.command({ type: 'repo.added', at: this.ctx.at(), added: repo })
      if (!r.ok) {
        await removeWorktree(dir, tree, { ...opts, force: true })
          .then(() => deleteBranches(dir, [name], opts))
          .catch(() => {})
        return r
      }
      this.problem(
        `${repo.path}을 이 Work에 더했습니다. 지금 세션에는 터미널에서 알리세요. 다음에 시작하는 task부터 context.md에 들어갑니다`,
      )
      return { ok: true }
    })
  }

  /** worktree가 Work 브랜치에 있지 않으면 그 오류 (D138) */
  private async offBranch(): Promise<string | null> {
    const current = await currentBranch(this.worktree, { env: this.ctx.env })
    return offWorkBranch(workBranch(this.work), current)
  }

  // ---------- 전달 (시나리오 7) ----------

  /** 지금 task가 Work 완료 task(마무리 단계, 옛 Work의 verify)면 그 형식 검사. 전달을 시작할 수 있는지 core/delivery가 판정한다 */
  private async verifyCheck(): Promise<TaskCheck | null> {
    const task = currentTask(this.work)
    if (!task || !completesWork(this.work, task)) return null
    return await this.checkOf(task)
  }

  /**
   * [push]·[PR 생성] (7-4~7-6, D119, D120). 커밋 안 된 변경이 있으면 사람이 고르게 변경 목록을 돌려준다
   * (7-5). 고른 처리는 사람에게 보인 목록과 지금 목록이 같을 때만 받는다. 전달이 실패하면 오류를 돌려주고,
   * 실패는 Work 완료 화면에도 남는다.
   */
  deliver(input: DeliverInput): Promise<DeliverResult> {
    if (input.repos && isBundle(this.work)) {
      const repos = input.repos
      return this.enqueue(() => this.deliverBundle(repos, input.repoUncommitted ?? []))
    }
    return this.enqueue(() => this.deliverNow(input.choice, input.uncommitted))
  }

  /**
   * 묶음 Work의 [전달] (D475~D479). 레포마다 고른 전달을 확인하고(core/repos bundlePlan), 보낼 레포마다 작업 브랜치에
   * 있는지와 커밋 안 된 변경의 처리를 받는다. 보낼 레포에 커밋 안 된 변경이 있는데 처리를 고르지 않았거나 그 사이 바뀌었으면
   * 레포마다 변경 목록을 돌려준다. 보내지 않는 레포의 커밋 안 된 변경은 그대로 둔다
   */
  private async deliverBundle(
    picks: readonly RepoPick[],
    chosen: readonly RepoUncommitted[],
  ): Promise<DeliverResult> {
    if (cutOperation(this.work)) return { ok: false, error: OPERATION_BLOCKS }
    const check = await this.verifyCheck()
    const start = deliveryStart(this.work, check)
    if (!start.ok) return start
    if (this.cleanup && this.cleanup.status !== 'ended') {
      return { ok: false, error: '정리 세션이 열려 있음. [정리 끝 → push/PR 진행]을 누르세요' }
    }
    const opts = { env: this.ctx.env }
    const repos = workRepos(this.work)
    const lines = await this.bundleUncommitted()
    const linesOf = (p: string) => lines.find((l) => l.path === p)?.lines ?? []
    const actionOf = (p: string) => chosen.find((c) => c.path === p)?.action ?? null
    const labels: Record<string, string> = { '': this.mainLabel() }
    for (const r of repos) labels[r.path] = r.path
    // 커밋이 있는 레포만 보낼 수 있다. [커밋하고 진행]을 고르면 커밋이 생긴다
    const facts: RepoDeliverFacts[] = []
    if (mainEditable(this.work)) {
      const ahead = await countCommits(this.worktree, this.work.base_commit, 'HEAD', opts).catch(
        () => 0,
      )
      const b = deliveryButtons(this.checks())
      facts.push({
        path: '',
        commits: ahead > 0 || (linesOf('').length > 0 && actionOf('') === 'commit'),
        push: b.push,
        pr: b.pr,
      })
    }
    for (const r of repos) {
      const ahead = await countCommits(this.repoTree(r.path), r.base_commit, 'HEAD', opts).catch(
        () => 0,
      )
      const b = await this.repoButtons(r.path)
      facts.push({
        path: r.path,
        commits: ahead > 0 || (linesOf(r.path).length > 0 && actionOf(r.path) === 'commit'),
        push: b.push,
        pr: b.pr,
      })
    }
    const planned = bundlePlan(picks, facts, labels)
    if (!planned.ok) return planned
    const plan = planned.plan
    const sending = [...(plan.main ? [''] : []), ...plan.repos.map((r) => r.path)]
    // 보내는 레포는 작업 브랜치에 있어야 한다 (D138)
    const name = workBranch(this.work)
    for (const p of sending) {
      const tree = p === '' ? this.worktree : this.repoTree(p)
      const current = await currentBranch(tree, opts).catch(() => null)
      const off = offWorkBranch(name, current)
      if (off) return { ok: false, error: `${labels[p] ?? p}: ${off}` }
    }
    // 보내는 레포의 커밋 안 된 변경은 레포마다 처리를 고른다 (D475)
    const pending = sending
      .map((p) => ({ path: p, label: labels[p] ?? p, lines: linesOf(p) }))
      .filter((x) => x.lines.length > 0)
    const unanswered = pending.filter((x) => {
      const c = chosen.find((y) => y.path === x.path)
      return !c || !sameChanges(c.expect, x.lines)
    })
    if (unanswered.length > 0) {
      const changed = pending.some((x) => chosen.some((y) => y.path === x.path))
      return {
        ok: false,
        error: changed
          ? '확인한 뒤 커밋 안 된 변경이 바뀌었음. 다시 고르세요'
          : '커밋 안 된 변경이 있어 push와 PR을 할 수 없음',
        repoUncommitted: pending,
      }
    }
    const action = (p: string) => (linesOf(p).length > 0 ? actionOf(p) : null)
    this.opError = null
    const r = await this.command({
      type: 'deliver',
      at: this.ctx.at(),
      choice: plan.main ?? plan.repos[0]?.choice ?? 'push',
      uncommitted: plan.main ? action('') : null,
      check,
      bundle: {
        main: plan.main,
        repos: plan.repos.map((x) => ({ ...x, uncommitted: action(x.path) })),
        link: plan.link,
      },
    })
    const failed = this.opError
    this.opError = null
    if (!r.ok) return r
    if (failed) return { ok: false, error: failed }
    if (this.cleanup?.status === 'ended') {
      this.cleanup = null
      this.changed()
    }
    return { ok: true }
  }

  private async deliverNow(
    choice: DeliveryChoice,
    uncommitted: DeliverInput['uncommitted'],
  ): Promise<DeliverResult> {
    if (cutOperation(this.work)) return { ok: false, error: OPERATION_BLOCKS }
    const check = await this.verifyCheck()
    const start = deliveryStart(this.work, check)
    if (!start.ok) return start
    const button = deliveryButtons(this.checks())[choice]
    if (!button.enabled) {
      return {
        ok: false,
        error: `[${DELIVERY_LABEL[choice]}]을 쓸 수 없음: ${button.reason ?? ''}`,
      }
    }
    if (this.cleanup && this.cleanup.status !== 'ended') {
      return { ok: false, error: '정리 세션이 열려 있음. [정리 끝 → push/PR 진행]을 누르세요' }
    }
    try {
      const off = await this.offBranch()
      if (off) return { ok: false, error: off }
    } catch (e) {
      return { ok: false, error: `Work 브랜치를 확인하지 못함: ${message(e)}` }
    }
    let lines: string[]
    try {
      lines = await statusLines(this.worktree, { env: this.ctx.env })
    } catch (e) {
      return { ok: false, error: `git status를 읽지 못함: ${message(e)}` }
    }
    let action: UncommittedAction | null = null
    if (lines.length > 0) {
      if (!uncommitted) {
        return {
          ok: false,
          error: '커밋 안 된 변경이 있어 push와 PR을 할 수 없음',
          uncommitted: lines,
        }
      }
      if (!sameChanges(uncommitted.expect, lines)) {
        return {
          ok: false,
          error: '확인한 뒤 커밋 안 된 변경이 바뀌었음. 다시 고르세요',
          uncommitted: lines,
        }
      }
      action = uncommitted.action
    }
    this.opError = null
    const r = await this.command({
      type: 'deliver',
      at: this.ctx.at(),
      choice,
      uncommitted: action,
      check,
    })
    const failed = this.opError
    this.opError = null
    if (!r.ok) return r
    if (failed) return { ok: false, error: failed }
    // 끝난 정리 세션은 전달을 마치면 치운다
    if (this.cleanup?.status === 'ended') {
      this.cleanup = null
      this.changed()
    }
    return { ok: true }
  }

  /**
   * 전달 (7-4~7-6). 커밋 안 된 변경을 처리하고(stash나 커밋), origin에 push하고, PR이면 pr.md로 PR을
   * 만든다. 같은 브랜치의 PR이 이미 열려 있으면 새로 만들지 않고 링크만 기록한다. 단계가 넘어갈 때마다
   * machine에 알려 진행 중 작업 기록을 옮긴다(D77). 실패하면 알리고 Work는 완료하지 않는다.
   */
  private async deliverCode(e: Extract<Effect, { type: 'deliver' }>): Promise<void> {
    const { env } = this.ctx
    const repo = this.project.repo_path
    const task = this.task(e.taskId)
    // 묶음 Work는 서브모듈부터 차례로 보내고, 메인이 새 커밋을 가리키게 한 뒤 메인을 보낸다 (D478, D479)
    if (e.bundle && !(await this.deliverRepos(e))) return
    const op = this.work.operation
    if (op?.kind === 'deliver' && op.skip_main) {
      const check = task ? await this.checkOf(task) : null
      await this.feed({ type: 'delivery.succeeded', at: this.ctx.at(), compareUrl: null, check })
      if (this.work.status === 'pr') await this.startPr()
      return
    }
    const facts: {
      prUrl?: string
      prExisting?: boolean
      draft?: boolean
      pr?: { number: number; head: string; ghVersion: string | null }
    } = {}
    let compare: string | null
    try {
      // 만든 stash나 커밋은 push로 넘어가며 진행 중 작업 기록에 적는다. 뒤 단계가 실패해도 결과에 남는다 (7-5)
      if (e.uncommitted === 'discard') {
        // 서브모듈이 가리키는 커밋이 바뀐 것은 HEAD로 되돌리고 나머지는 stash한다 (D384)
        const stash = await discardChanges(
          this.worktree,
          e.message ?? '',
          { env },
          workRepos(this.work).map((r) => r.path),
        )
        await this.feed({
          type: 'delivery.stage',
          at: this.ctx.at(),
          stage: 'push',
          ...(stash ? { stash } : {}),
        })
      }
      if (e.uncommitted === 'commit') {
        const commit = await commitAll(
          this.worktree,
          e.message ?? '',
          { env },
          workRepos(this.work).map((r) => r.path),
        )
        await this.feed({ type: 'delivery.stage', at: this.ctx.at(), stage: 'push', commit })
      }
      await pushBranch(this.worktree, e.branch, 'origin', { env })
      const origin = await remoteUrl(repo, 'origin', { env })
      compare = origin ? compareUrl(origin, e.base, e.branch) : null
      if (e.choice === 'pr') {
        await this.feed({ type: 'delivery.stage', at: this.ctx.at(), stage: 'pr' })
        if (!origin) throw new Error('origin 원격이 없음')
        const pr = prText((task ? await this.files.taskFiles(task) : {})[PR_FILE] ?? '')
        if (!pr.ok) throw new Error(pr.error)
        const gh = { repo: ghRepo(origin), cwd: repo, env }
        const open = await ghOpenPr(this.ctx.ghBin, { ...gh, head: e.branch })
        if (open) {
          facts.prUrl = open.url
          facts.prExisting = true
        } else {
          facts.draft = this.ctx.config().pr_draft
          // 이슈 기록이 있으면 본문 끝에 Closes를 붙인다 (D346). 이어받은 PR의 본문은 고치지 않는다 (D349)
          const issue = this.work.issue?.number ?? null
          // 묶음 Work는 함께 머지할 서브모듈 PR을 붙인다 (D479)
          const body = withLinkedPrs(pr.body, this.linkedPrs())
          facts.prUrl = await ghCreatePr(this.ctx.ghBin, {
            ...gh,
            base: e.base,
            head: e.branch,
            title: pr.title,
            body: issue === null ? body : withCloses(body, issue),
            draft: facts.draft,
          })
        }
        // PR 진행 (D152, D191): 번호는 PR 주소에서 읽고(I50), head는 push한 커밋이고, gh 버전을 적는다 (D198)
        const location = prLocation(facts.prUrl)
        if (!location) throw new Error(`PR 주소를 읽지 못함: ${facts.prUrl}`)
        facts.pr = {
          number: location.number,
          head: await headCommit(this.worktree, { env }),
          ghVersion: await ghVersion(this.ctx.ghBin, env),
        }
      }
    } catch (err) {
      this.opError = `전달 실패: ${message(err)}`
      console.error(`[${this.key}] ${this.opError}`)
      await this.feed({ type: 'delivery.failed', at: this.ctx.at(), error: message(err) })
      return
    }
    const check = task ? await this.checkOf(task) : null
    await this.feed({
      type: 'delivery.succeeded',
      at: this.ctx.at(),
      compareUrl: compare,
      ...facts,
      check,
    })
    // [PR 생성]이 성공하면 PR 진행이다. 바로 한 번 읽고 주기 읽기를 건다 (시나리오 10-1)
    if (this.work.status === 'pr') await this.startPr()
  }

  /**
   * 묶음 Work의 서브모듈 전달 (D479): 진행 중 작업 기록의 차례대로 커밋 안 된 변경을 처리하고, 그 레포의 origin에 작업
   * 브랜치를 push하고, PR이면 그 레포의 PR 초안(pr/<경로>.md)으로 PR을 만든다. 같은 브랜치의 PR이 열려 있으면 링크만
   * 적는다. 레포마다 끝나면 기록한다. 그 뒤 메인이 새 커밋을 가리키게 하는 커밋을 메인에 더한다(D478, 이미 가리키면
   * 건너뜀). 하나라도 실패하면 알리고 그 뒤는 하지 않는다. 계속할 수 있으면 true다
   */
  private async deliverRepos(e: Extract<Effect, { type: 'deliver' }>): Promise<boolean> {
    const { env } = this.ctx
    const op = this.work.operation
    if (op?.kind !== 'deliver') return false
    const task = this.task(e.taskId)
    for (const step of op.repos ?? []) {
      if (step.stage === 'done') continue
      const tree = this.repoTree(step.path)
      const dir = this.repoDir(step.path)
      try {
        if (step.uncommitted === 'discard') {
          const stash = await discardChanges(tree, stashMessage(this.work.work_id), { env })
          await this.feed({
            type: 'delivery.repo',
            at: this.ctx.at(),
            path: step.path,
            stage: 'push',
            ...(stash ? { stash } : {}),
          })
        }
        if (step.uncommitted === 'commit') {
          const commit = await commitAll(tree, commitMessage(this.work.work_id), { env })
          await this.feed({
            type: 'delivery.repo',
            at: this.ctx.at(),
            path: step.path,
            stage: 'push',
            commit,
          })
        }
        await pushBranch(tree, e.branch, 'origin', { env })
        const origin = await remoteUrl(dir, 'origin', { env })
        const compare = origin ? compareUrl(origin, step.base, e.branch) : null
        const done: Omit<
          Extract<MachineEvent, { type: 'delivery.repo' }>,
          'type' | 'at' | 'path'
        > = {
          stage: 'done',
          compareUrl: compare,
        }
        if (step.choice === 'pr') {
          await this.feed({
            type: 'delivery.repo',
            at: this.ctx.at(),
            path: step.path,
            stage: 'pr',
          })
          if (!origin) throw new Error('origin 원격이 없음')
          const text = task ? await this.files.taskFile(task, repoDraftFile(step.path)) : null
          if (text === null) throw new Error(`PR 초안이 없음: ${repoDraftFile(step.path)}`)
          const pr = prText(text)
          if (!pr.ok) throw new Error(`${repoDraftFile(step.path)}: ${pr.error}`)
          const gh = { repo: ghRepo(origin), cwd: dir, env }
          const open = await ghOpenPr(this.ctx.ghBin, { ...gh, head: e.branch })
          if (open) {
            done.prUrl = open.url
            done.prExisting = true
          } else {
            done.draft = this.ctx.config().pr_draft
            done.prUrl = await ghCreatePr(this.ctx.ghBin, {
              ...gh,
              base: step.base,
              head: e.branch,
              title: pr.title,
              body: await this.repoPrBody(pr.body),
              draft: done.draft,
            })
          }
          const location = prLocation(done.prUrl)
          if (!location) throw new Error(`PR 주소를 읽지 못함: ${done.prUrl}`)
          done.pr = {
            number: location.number,
            head: await headCommit(tree, { env }),
            ghVersion: await ghVersion(this.ctx.ghBin, env),
          }
        }
        await this.feed({ type: 'delivery.repo', at: this.ctx.at(), path: step.path, ...done })
      } catch (err) {
        this.opError = `전달 실패 (${step.path}): ${message(err)}`
        console.error(`[${this.key}] ${this.opError}`)
        await this.feed({
          type: 'delivery.failed',
          at: this.ctx.at(),
          path: step.path,
          error: message(err),
        })
        return false
      }
    }
    const links = this.work.operation?.kind === 'deliver' ? (this.work.operation.link ?? []) : []
    if (links.length > 0) {
      try {
        const commit = await this.linkSubmodules(links)
        if (commit) await this.feed({ type: 'delivery.linked', at: this.ctx.at(), commit })
      } catch (err) {
        this.opError = `전달 실패 (메인이 새 서브모듈 커밋을 가리키게 함): ${message(err)}`
        console.error(`[${this.key}] ${this.opError}`)
        await this.feed({ type: 'delivery.failed', at: this.ctx.at(), error: message(err) })
        return false
      }
    }
    return true
  }

  /**
   * 메인이 고른 서브모듈의 새 커밋을 가리키게 하는 커밋을 메인 작업 브랜치에 더한다 (D478): 서브모듈 worktree의 HEAD로
   * gitlink를 바꿔(git update-index --cacheinfo) 그것만 커밋한다. 메인의 다른 커밋 안 된 변경은 건드리지 않는다. 이미 그
   * 커밋을 가리키면 건너뛰고, 바꿀 것이 없으면 커밋하지 않고 null이다
   */
  private async linkSubmodules(paths: readonly string[]): Promise<string | null> {
    const opts = { env: this.ctx.env }
    const links: { path: string; sha: string }[] = []
    for (const p of paths) {
      const sha = await headCommit(this.repoTree(p), opts)
      if ((await gitlinkAt(this.worktree, 'HEAD', p, opts)) !== sha) links.push({ path: p, sha })
    }
    if (links.length === 0) return null
    return commitGitlinks(this.worktree, links, linkMessage(this.work.work_id, links), opts)
  }

  /**
   * 서브모듈 PR의 본문 (D479): 이슈 기록이 있으면 끝에 그 이슈(메인 레포의 것)의 링크를 붙인다. Closes는 메인 PR에만 붙인다
   */
  private async repoPrBody(body: string): Promise<string> {
    const issue = this.work.issue?.number ?? null
    if (issue === null) return body
    const origin = await remoteUrl(this.project.repo_path, 'origin', { env: this.ctx.env }).catch(
      () => null,
    )
    const r = origin ? remoteRepo(origin) : null
    return withIssueRef(body, r ? `${r.owner}/${r.repo}#${issue}` : `#${issue}`)
  }

  /** 메인 PR에 붙일 함께 머지할 서브모듈 PR (D479): 이번 전달로 PR을 만든 서브모듈이다. 메인이 새 커밋을 가리키는지도 적는다 */
  private linkedPrs(): { path: string; url: string; linked: boolean }[] {
    const op = this.work.operation
    if (op?.kind !== 'deliver') return []
    const linked = op.link ?? []
    return workRepos(this.work).flatMap((r) =>
      op.repos?.some((s) => s.path === r.path && s.stage === 'done') && r.delivery?.pr_url
        ? [{ path: r.path, url: r.delivery.pr_url, linked: linked.includes(r.path) }]
        : [],
    )
  }

  // ---------- 정리 세션 ([AI 세션 열기], 7-5) ----------

  /**
   * [AI 세션 열기] (7-5): verify 세션을 끝내고, 기록하지 않는 일반 터미널로 Claude Code를 worktree에서 연다.
   * push와 PR은 계속 막혀 있다(deny 규칙). 세션 상한(D18)을 따라 자리가 없으면 대기열에서 기다린다.
   */
  openCleanup(choice: DeliveryChoice): Promise<CommandResult> {
    return this.enqueue(async () => {
      if (cutOperation(this.work)) return { ok: false, error: OPERATION_BLOCKS }
      // 정리 세션 뒤의 전달은 레포 하나의 것이다. 묶음 Work는 레포마다 고른다 (D475)
      if (isBundle(this.work)) {
        return {
          ok: false,
          error: '여러 레포를 고친 Work는 커밋 안 된 변경을 레포마다 고르세요 (D475)',
        }
      }
      const check = await this.verifyCheck()
      const start = deliveryStart(this.work, check)
      if (!start.ok) return start
      const button = deliveryButtons(this.checks())[choice]
      if (!button.enabled) {
        return {
          ok: false,
          error: `[${DELIVERY_LABEL[choice]}]을 쓸 수 없음: ${button.reason ?? ''}`,
        }
      }
      if (this.cleanup && this.cleanup.status !== 'ended') {
        return { ok: false, error: '정리 세션이 이미 열려 있음' }
      }
      return this.command({
        type: 'deliver',
        at: this.ctx.at(),
        choice,
        uncommitted: 'session',
        check,
      })
    })
  }

  private async startCleanup(choice: DeliveryChoice): Promise<void> {
    const id = `${CLEANUP_ID}-${++this.cleanupSeq}`
    this.terminals.set(id, new TerminalBuffer())
    this.cleanup = {
      engine: currentTask(this.work)?.engine,
      hooksReady: false,
      id,
      choice,
      status: 'queued',
      clean: false,
      uncommitted: [],
      pty: null,
      exited: null,
      unregister: () => {},
      dir: null,
      handled: false,
      ending: false,
    }
    this.changed()
    if (this.ctx.pool.tryAcquire()) {
      await this.launchCleanup()
      return
    }
    this.ctx.pool.enqueue(this.slotKey(id), () => {
      void this.enqueue(async () => {
        if (this.cleanup?.status !== 'queued') {
          this.ctx.pool.release()
          return
        }
        if (await this.launchCleanup()) this.notify('정리 세션: 대기열에서 자동 시작')
      })
    })
  }

  /** 잡은 자리로 정리 세션을 띄운다. 띄우지 못하면 자리를 돌려주고 끝난 것으로 둔다 */
  private async launchCleanup(): Promise<boolean> {
    const c = this.cleanup
    if (!c) {
      this.ctx.pool.release()
      return false
    }
    const { env } = this.ctx
    let pid: number
    try {
      const driver = agentRuntime(taskEngine(c))
      const bin = driver.find(env)
      if (!bin) throw new Error(driver.installGuide)
      c.dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'relay-cleanup-'))
      const settingsPath = path.join(c.dir, SETTINGS_FILE)
      await writeJson(
        settingsPath,
        driver.settings({
          port: this.ctx.hooks.port,
          taskId: CLEANUP_ID,
          workDir: this.files.dir,
          previousTaskDirs: this.work.tasks.map((t) => this.files.taskDir(t)),
        }),
      )
      const token = randomBytes(32).toString('hex')
      const { cols, rows } = this.ctx.size()
      const pty = startPty({
        bin,
        args: await driver.cleanupArgs(settingsPath, this.extraDirs().extraDirs ?? []),
        cwd: this.worktree,
        env: { ...this.agentEnv(), ...driver.launchEnv(token, this.ctx.hooks.port, CLEANUP_ID) },
        cols,
        rows,
        answerQueries: true,
      })
      const buffer = this.terminals.get(c.id) ?? new TerminalBuffer()
      buffer.start({ cols, rows })
      this.terminals.set(c.id, buffer)
      const key = this.terminalKey(c.id)
      let exited!: () => void
      c.exited = new Promise((r) => (exited = r))
      c.pty = pty
      pty.onData((data) => {
        if (!c.handled) this.ctx.ui.terminal(key, buffer.push(data))
      })
      pty.onExit(() => {
        exited()
        void this.enqueue(() => this.onCleanupExit(c))
      })
      c.unregister = this.ctx.hooks.register(
        token,
        CLEANUP_ID,
        (req) => this.cleanupHookArrived(c, req),
        taskEngine(c) === 'codex'
          ? {
              failClosed: true,
              question: (body, signal) => this.askHuman(CLEANUP_ID, c, body, signal),
            }
          : {},
      )
      c.status = 'live'
      this.changed()
      pid = pty.pid
    } catch (err) {
      this.ctx.pool.release()
      await this.releaseCleanup(c)
      this.problem(`정리 세션을 열지 못함: ${message(err)}`)
      return false
    }
    // 살아 있는 동안 프로세스 ID와 시작 시각을 적는다. 앱이 충돌한 뒤 살아남으면 재시작 때 끝낸다 (D126)
    const processStartedAt = await processStartTime(pid)
    await this.feed({
      type: 'cleanup.started',
      at: this.ctx.at(),
      pid,
      ...(processStartedAt ? { processStartedAt } : {}),
    })
    return true
  }

  /** 정리 도구 훅도 처리 큐 밖에서 바로 답하되 Codex의 보호 판정은 task와 공유한다. */
  private cleanupHookArrived(c: CleanupSession, req: HookRequest): Promise<HookReply> {
    if (this.cleanup !== c || c.status !== 'live' || c.ending) return Promise.resolve(null)
    if (TOOL_HOOKS.includes(req.event)) {
      if (taskEngine(c) === 'codex' && !c.hooksReady) {
        c.hooksReady = true
        this.changed()
      }
      return Promise.resolve(
        taskEngine(c) === 'codex' && req.event === 'PreToolUse' ? this.codexToolReply(req) : null,
      )
    }
    return this.enqueue(() => this.onCleanupHook(c, req))
  }

  /** 정리 세션: Stop마다 git status를 보고 새 요청이면 강조를 끈다 (7-5). */
  private async onCleanupHook(c: CleanupSession, req: HookRequest): Promise<HookReply> {
    if (this.cleanup !== c || c.status !== 'live') return null
    if (taskEngine(c) === 'codex' && !c.hooksReady) {
      c.hooksReady = true
      this.changed()
    }
    if (taskEngine(c) === 'codex' && str(req.body['agent_id']) !== undefined) return null
    if (taskEngine(c) === 'codex') {
      const sessionId = str(req.body['session_id'])
      const switched = req.event === 'SessionStart' && sessionId && sessionId !== c.sessionId
      if ((req.event === 'UserPromptSubmit' || switched) && c.question)
        await this.finishQuestion(CLEANUP_ID, c, c.question, {
          cancelled: true,
          reason: switched ? '대화가 바뀌었습니다.' : '새 요청을 보냈습니다.',
        })
      if (req.event === 'SessionStart' && sessionId) c.sessionId = sessionId
    }
    if ((req.event === 'Interrupt' || req.event === 'SessionEnd') && c.question) {
      this.cancelQuestion(c, '정리 세션의 질문을 취소했습니다.')
      this.changed()
    }
    if (req.event === 'UserPromptSubmit' && c.clean) {
      c.clean = false
      this.changed()
    }
    if (req.event === 'Stop') {
      if (c.question) return { decision: 'block', reason: '앱 질문창의 답변을 기다리세요.' }
      const lines = await statusLines(this.worktree, { env: this.ctx.env }).catch(() => null)
      if (lines) {
        c.clean = lines.length === 0
        this.changed()
      }
    }
    return null
  }

  /** 정리 세션이 스스로 끝났다(/exit). 버튼을 누른 것과 같이 git status를 보고 전달하거나 선택지로 돌아간다 */
  private async onCleanupExit(c: CleanupSession): Promise<void> {
    if (this.cleanup !== c || c.handled) return
    this.ctx.pool.release()
    await this.releaseCleanup(c)
    await this.afterCleanup()
  }

  /** 정리 세션에 걸어 둔 것을 푼다: 훅 토큰, 설정 파일 폴더, 적어 둔 프로세스(D126). 끝난 것으로 둔다 */
  private async releaseCleanup(c: CleanupSession): Promise<void> {
    this.cancelQuestion(c, '정리 세션을 종료했습니다.')
    c.status = 'ended'
    await this.dropAux(c)
    this.changed()
    await this.feed({ type: 'cleanup.ended', at: this.ctx.at() })
  }

  /** 보조 세션에 걸어 둔 것을 푼다 (chat의 dropAux) */
  private dropAux(s: AuxSession): Promise<void> {
    return dropAux(s, this.terminals)
  }

  /** 살아 있거나 대기열에 있는 정리 세션을 끝낸다 */
  private async endCleanup(): Promise<void> {
    const c = this.cleanup
    if (!c || c.handled) return
    if (c.status === 'queued') {
      this.ctx.pool.remove(this.slotKey(c.id))
    } else if (c.pty) {
      await killAux(c)
      this.ctx.pool.release()
    }
    await this.releaseCleanup(c)
  }

  /** [정리 세션 닫기] (D137): 정리 세션을 끝내고 전달하지 않는다. 변경은 worktree에 남는다 */
  closeCleanup(): Promise<CommandResult> {
    return this.enqueue(async () => {
      if (!this.cleanup) return { ok: false, error: '정리 세션이 없음' }
      await this.endCleanup()
      this.cleanup = null
      this.changed()
      return { ok: true }
    })
  }

  /**
   * [정리 끝 → push/PR 진행] (7-5). 세션을 끝내고 git status를 본다. 깨끗하면 원래 고른 전달을 하고,
   * 변경이 남았으면 선택지 화면으로 돌아가게 변경 목록을 돌려준다.
   */
  finishCleanup(): Promise<DeliverResult> {
    return this.enqueue(async () => {
      if (!this.cleanup) return { ok: false, error: '정리 세션이 없음' }
      await this.endCleanup()
      return this.afterCleanup()
    })
  }

  private async afterCleanup(): Promise<DeliverResult> {
    const c = this.cleanup
    if (!c) return { ok: false, error: '정리 세션이 없음' }
    let lines: string[]
    try {
      lines = await statusLines(this.worktree, { env: this.ctx.env })
    } catch (e) {
      return { ok: false, error: `git status를 읽지 못함: ${message(e)}` }
    }
    c.uncommitted = lines
    this.changed()
    if (lines.length > 0) {
      return {
        ok: false,
        error: '정리 세션이 끝났지만 커밋 안 된 변경이 남음',
        uncommitted: lines,
      }
    }
    return this.deliverNow(c.choice, null)
  }

  // ---------- 곁 세션 (시나리오 11, D385~D392) ----------

  /**
   * [곁 세션 열기] (시나리오 11). 엔진·모델·추론 수준은 열 때의 설정이다 (D391). 적어 둔 대화가 있고 그 엔진이 같으면
   * 이어 가고, fresh거나 없거나 엔진이 다르면 새 대화다 (D386, D389). 세션 상한을 거치지 않는다 (D385). 다른 동작은 막지
   * 않는다 (D390). 안내 창(D392)은 화면이 띄운다
   */
  openSide(fresh: boolean): Promise<CommandResult> {
    return this.enqueue(async () => {
      const blocked = sideBlock(this.work)
      if (blocked) return { ok: false, error: blocked }
      if (this.side?.status === 'live') return { ok: false, error: '곁 세션이 이미 열려 있음' }
      // 곁 세션이 초안을 쓸 폴더를 (다시) 만들고 본다 (D421)
      await this.watchDrafts().catch(() => undefined)
      return this.launchSide(fresh)
    })
  }

  /** 이어 갈 곁 세션 대화: 적어 둔 대화가 있고 그 엔진이 지금 설정의 엔진과 같다 (D391) */
  private sideResumeId(engine: AgentEngine): string | null {
    const side = this.work.side
    return side?.session_id !== undefined && (side.engine ?? 'claude') === engine
      ? side.session_id
      : null
  }

  /** 곁 세션을 띄운다. 안내와 설정은 열 때마다 임시 폴더에 새로 만든다 (I126). 띄우기는 기본 세션과 함께 쓴다 (I132) */
  private async launchSide(fresh: boolean): Promise<CommandResult> {
    const config = this.ctx.config()
    const agent = resolveAgent(config, 'side')
    const previous = fresh ? null : this.sideResumeId(agent.engine)
    const resume = previous !== null
    // Claude는 새 대화의 id를 정해 준다. Codex는 훅이 알려 주는 id를 첫 요청 때 적는다 (D391)
    const sessionId = previous ?? randomUUID()
    const id = `${SIDE_ID}-${++this.sideSeq}`
    const s = chatSession(
      id,
      agent.engine,
      sideGuide({
        work: this.work,
        title: this.title,
        worktree: this.worktree,
        workDir: this.files.dir,
        projectId: this.project.project_id,
        draftsDir: this.draftsDir,
        signature: config.reply_signature,
      }),
    )
    const model = {
      ...(agent.model ? { model: agent.model } : {}),
      ...(agent.effort ? { effort: agent.effort } : {}),
    }
    let pid: number
    try {
      pid = await openChat({
        session: s,
        // 메인 통합 검증 worktree의 보호 (D415)
        env: this.agentEnv(),
        hooks: this.ctx.hooks,
        hookId: SIDE_ID,
        name: 'side',
        cwd: this.worktree,
        settings: (driver) =>
          driver.sideSettings({
            port: this.ctx.hooks.port,
            taskId: SIDE_ID,
            workDir: this.files.dir,
            ...model,
          }),
        args: (driver, files) =>
          driver.sideArgs({
            sessionId,
            resume,
            workDir: this.files.dir,
            ...this.extraDirs(),
            ...files,
            ...model,
          }),
        size: this.ctx.size(),
        terminals: this.terminals,
        terminalKey: this.terminalKey(id),
        mark: chatMark('곁 세션', resume),
        output: (key, chunk) => this.ctx.ui.terminal(key, chunk),
        onExit: () => void this.enqueue(() => this.onSideExit(s)),
        onHook: (req) => this.sideHook(s, req),
      })
    } catch (err) {
      // 띄우지 못했으면 앞 곁 세션(끝난 터미널)은 그대로 둔다
      return { ok: false, error: `곁 세션을 열지 못함: ${message(err)}` }
    }
    // 끝난 앞 곁 세션의 터미널은 새 터미널로 바꾼다
    if (this.side) this.terminals.delete(this.side.id)
    this.side = s
    this.changed()
    // 살아 있는 동안 프로세스 ID와 시작 시각을 적는다. 앱이 충돌한 뒤 살아남으면 재시작 때 끝낸다 (D389)
    const processStartedAt = await processStartTime(pid)
    await this.feed({
      type: 'side.started',
      at: this.ctx.at(),
      pid,
      ...(processStartedAt ? { processStartedAt } : {}),
    })
    return { ok: true }
  }

  /** 곁 세션의 훅 (D388, D391): 함께 쓰는 처리(chatHook)에 곁 세션의 도구 보호와 대화 적기를 준다 */
  private sideHook(s: SideSession, req: HookRequest): Promise<HookReply> {
    return chatHook(s, req, {
      current: () => this.side === s,
      changed: () => this.changed(),
      toolReply: (r, allowPush) => this.codexToolReply(r, undefined, allowPush),
      conversation: (sessionId) =>
        void this.enqueue(async () => {
          if (this.side === s && !s.handled) {
            await this.feed({
              type: 'side.conversation',
              at: this.ctx.at(),
              sessionId,
              engine: s.engine,
            })
          }
        }),
    })
  }

  /** 곁 세션이 스스로 끝났다(/exit, 이어 갈 대화를 찾지 못함) */
  private async onSideExit(s: SideSession): Promise<void> {
    if (this.side !== s || s.handled) return
    await this.releaseSide(s)
  }

  /** 곁 세션에 걸어 둔 것을 푼다: 질문, 훅 토큰, 임시 폴더, 적어 둔 프로세스(D389). 끝난 것으로 둔다 */
  private async releaseSide(s: SideSession): Promise<void> {
    s.status = 'ended'
    await this.dropAux(s)
    this.changed()
    await this.feed({ type: 'side.ended', at: this.ctx.at() })
  }

  /** 살아 있는 곁 세션을 끝낸다 */
  private async endSide(): Promise<void> {
    const s = this.side
    if (!s || s.handled) return
    await killAux(s)
    await this.releaseSide(s)
  }

  /** [곁 세션 닫기] (시나리오 11-5). 탭은 끝난 터미널로 남는다 */
  closeSide(): Promise<CommandResult> {
    return this.enqueue(async () => {
      if (this.side?.status !== 'live') return { ok: false, error: '곁 세션이 열려 있지 않음' }
      await this.endSide()
      return { ok: true }
    })
  }

  private sideView(): SideView {
    const s = this.side
    // 열린 곁 세션은 그 엔진, 아니면 지금 열 때 쓸 설정의 엔진이다 (D391)
    const next = resolveAgent(this.ctx.config(), 'side').engine
    const engine = s?.status === 'live' ? s.engine : next
    return {
      terminal: s ? this.terminalKey(s.id) : null,
      status: s?.status ?? null,
      engineLabel: AGENT_LABELS[engine],
      ...(s ? chatNotice(s, '곁 세션') : {}),
      // 이어 갈 대화는 지금 설정의 엔진과 같은 것만이다 (D391)
      resumable: this.sideResumeId(next) !== null,
      blocked: sideBlock(this.work),
    }
  }

  // ---------- 정리 (시나리오 8) ----------

  /**
   * PR을 머지한 Work의 작업 브랜치에만 있는 커밋 (D329): 머지한 PR head에 없는 것. squash·rebase 머지면 기준 브랜치가
   * 이 커밋을 갖지 않으므로 머지한 head와 견준다. 머지한 Work가 아니거나 셀 수 없으면 null
   */
  private async lostCommits(
    repo: string,
    name: string,
    head: string | null,
  ): Promise<{ sha: string; subject: string }[] | null> {
    const merged = this.work.pr?.merged
    if (!merged || !head) return null
    try {
      return await commitsOnlyIn(repo, `refs/heads/${name}`, merged.head, { env: this.ctx.env })
    } catch (e) {
      this.problem(`머지한 PR에 없는 커밋을 세지 못함: ${message(e)}`)
      return null
    }
  }

  /** 정리 요약의 사실: git과 이 앱의 세션에서 읽는다 (8-1) */
  private async cleanFacts(): Promise<CleanFacts> {
    const opts = { env: this.ctx.env }
    const repo = this.project.repo_path
    const worktree = await fsp
      .stat(this.worktree)
      .then((st) => st.isDirectory())
      .catch(() => false)
    if (worktree && (await this.halfRemoved())) throw new Error(halfRemovedHint(this.worktree))
    const name = workBranch(this.work)
    const head = await refCommit(repo, `refs/heads/${name}`, opts)
    const contains = async (ref: string) => {
      const tip = await refCommit(repo, ref, opts)
      return !!head && !!tip && (await isAncestor(repo, head, tip, opts))
    }
    // PR이 머지되는 곳은 머지 대상이다 (D428)
    const base = targetBranch(this.work)
    // 머지로 완료한 Work는 origin의 브랜치 삭제도 고를 수 있다 (D178). 원격에 닿지 못하면 고르지 못하게 둔다
    const merged = this.work.pr?.merged !== undefined
    let remote: CleanFacts['remote'] = null
    if (merged) {
      try {
        remote = { name, exists: await remoteBranchExists(repo, name, 'origin', opts) }
      } catch (e) {
        this.problem(`origin의 브랜치 ${name}를 확인하지 못함: ${message(e)}`)
      }
    }
    const picked = workRepos(this.work).map((r) => r.path)
    // 묶음 Work의 메인은 고른 서브모듈의 자리를 빼고 본다. 메인을 고르지 않았으면 메인 쪽 변경 전부다 (D482)
    const uncommitted = !worktree
      ? []
      : !isBundle(this.work)
        ? await statusLines(this.worktree, opts)
        : mainEditable(this.work)
          ? withoutRepoPaths(await statusLines(this.worktree, opts), picked)
          : await this.fixedMainChanges()
    return {
      worktree,
      uncommitted,
      locks: worktree ? await lockFiles(this.worktree, opts) : [],
      submodules: worktree
        ? (await checkedOutSubmodules(this.worktree, opts)).filter((p) => !picked.includes(p))
        : [],
      // 곁 세션도 정리가 끝낸다 (D390)
      live:
        this.live.size +
        (this.cleanup?.status === 'live' ? 1 : 0) +
        (this.side?.status === 'live' ? 1 : 0),
      branch: {
        name,
        exists: head !== null,
        pushed: await contains(`refs/remotes/origin/${name}`),
        merged:
          (await contains(`refs/heads/${base}`)) || (await contains(`refs/remotes/origin/${base}`)),
        lost: await this.lostCommits(repo, name, head),
        stacked: this.ctx.stackedOn(this.project.project_id, name, this.work.work_id),
      },
      // 사람이 지은 Work 브랜치가 백업 브랜치의 모양과 같을 수 있다(D426): Work 브랜치는 백업으로 보지 않는다
      backups: (await refNames(repo, backupPattern(this.work.work_id), opts)).filter(
        (b) => !this.ctx.workBranches(this.project.project_id).includes(b),
      ),
      merged,
      remote,
      integration: await this.integrationCleanFacts(),
      ...(isBundle(this.work) ? { repos: await this.repoCleanFacts() } : {}),
    }
  }

  /** 묶음 Work의 서브모듈마다 정리 사실 (D482): 그 worktree와 서브모듈 저장소(메인 체크아웃의 그 폴더)에서 읽는다 */
  private async repoCleanFacts(): Promise<RepoCleanFacts[]> {
    const opts = { env: this.ctx.env }
    const name = workBranch(this.work)
    const mainPr = this.work.pr
    const out: RepoCleanFacts[] = []
    for (const r of workRepos(this.work)) {
      const tree = this.repoTree(r.path)
      const dir = this.repoDir(r.path)
      const worktree = await exists(path.join(tree, '.git'))
      const head = await refCommit(dir, `refs/heads/${name}`, opts)
      const contains = async (ref: string) => {
        const tip = await refCommit(dir, ref, opts)
        return !!head && !!tip && (await isAncestor(dir, head, tip, opts))
      }
      const base = repoTarget(r)
      const merged = r.pr?.merged !== undefined
      let remote: RepoCleanFacts['remote'] = null
      if (merged) {
        try {
          remote = { name, exists: await remoteBranchExists(dir, name, 'origin', opts) }
        } catch (e) {
          this.problem(`${r.path}: origin의 브랜치 ${name}를 확인하지 못함: ${message(e)}`)
        }
      }
      // 메인 PR이 머지되지 않았고 메인이 가리키는 이 서브모듈 커밋이 머지 대상에 없으면 원격 브랜치를 지우면 안 된다 (D482)
      let pointed = false
      if (mainPr && !mainPr.merged) {
        const sha = await gitlinkAt(this.project.repo_path, mainPr.head, r.path, opts).catch(
          () => null,
        )
        const tip = await refCommit(dir, `refs/remotes/origin/${base}`, opts)
        pointed = !!sha && !(tip && (await isAncestor(dir, sha, tip, opts).catch(() => false)))
      }
      let lost: { sha: string; subject: string }[] | null = null
      if (r.pr?.merged && head) {
        lost = await commitsOnlyIn(dir, `refs/heads/${name}`, r.pr.merged.head, opts).catch(
          () => null,
        )
      }
      out.push({
        path: r.path,
        worktree,
        uncommitted: worktree ? await statusLines(tree, opts) : [],
        locks: worktree ? await lockFiles(tree, opts) : [],
        branch: {
          name,
          exists: head !== null,
          pushed: await contains(`refs/remotes/origin/${name}`),
          merged:
            (await contains(`refs/heads/${base}`)) ||
            (await contains(`refs/remotes/origin/${base}`)),
          lost,
        },
        merged,
        remote,
        pointed,
      })
    }
    return out
  }

  /**
   * 묶음 Work의 서브모듈 worktree를 지운다 (D482). 메인 worktree보다 먼저 지운다: 먼저 지우면 git이 그 안의 worktree를
   * 확인 없이 지운다(D416). 폴더가 없으면 관리 정보만 prune하고, 반쯤 지운 폴더(.git 없음)는 prune한 뒤 지운다
   */
  private async removeRepoTrees(steps: readonly RepoCleanStep[]): Promise<void> {
    const opts = { env: this.ctx.env }
    for (const step of steps) {
      const tree = this.repoTree(step.path)
      const dir = this.repoDir(step.path)
      if (!(await exists(tree))) {
        await pruneWorktrees(dir, opts)
        continue
      }
      if (!(await exists(path.join(tree, '.git')))) {
        await pruneWorktrees(dir, opts)
        // 빈 서브모듈 자리는 메인 worktree의 것이라 남긴다
        if ((await fsp.readdir(tree).catch(() => [])).length > 0) await removeTree(tree)
        continue
      }
      await removeWorktree(dir, tree, { ...opts, force: step.force })
    }
  }

  /**
   * 정리 요약의 메인 통합 검증 worktree (D416): 그 폴더와 메인 쪽 변경(서브모듈 자리 제외, 받아 둔 다른 서브모듈 안의
   * 변경 포함). 폴더가 없거나 서브모듈 Work가 아니면 null
   */
  private async integrationCleanFacts(): Promise<CleanFacts['integration']> {
    const root = this.integrationRoot
    if (root === null || !(await exists(root))) return null
    await this.guardSubmodule()
    return { root, changes: await this.mainChanges() }
  }

  /**
   * 메인 통합 검증 worktree를 지운다 (D416). 서브모듈 worktree를 지운 뒤에 부른다: 먼저 지우면 git이 그 안의 서브모듈
   * worktree를 커밋 안 된 변경과 함께 확인 없이 지운다(실행). 메인 쪽 변경과 받아 둔 다른 서브모듈이 있어도 지우게
   * --force다(정리 요약에서 확인받음). 폴더가 없으면 관리 정보만 prune하고, 반쯤 지운 폴더(.git 없음)는 prune한 뒤 지운다
   */
  private async removeIntegration(): Promise<void> {
    const root = this.integrationRoot
    if (root === null) return
    const main = this.mainProject()
    if (!main) throw new Error('메인 프로젝트를 찾지 못해 메인 통합 검증 worktree를 지우지 못함')
    const opts = { env: this.ctx.env }
    if (await exists(path.join(this.worktree, '.git'))) {
      throw new Error('서브모듈 worktree가 남아 있어 메인 통합 검증 worktree를 지우지 않음')
    }
    if (!(await exists(root))) {
      await pruneWorktrees(main.repo_path, opts)
      return
    }
    if (!(await exists(path.join(root, '.git')))) {
      await pruneWorktrees(main.repo_path, opts)
      await removeTree(root)
      return
    }
    await removeWorktree(main.repo_path, root, { ...opts, force: true })
  }

  /** [Work 정리]의 확인 요약 (시나리오 8-1) */
  cleanPreview(): Promise<CleanPreviewResult> {
    return this.enqueue(async () => {
      if (cutOperation(this.work)) return { ok: false, error: OPERATION_BLOCKS }
      if (!canClean(this.work)) return { ok: false, error: '완료나 포기한 Work만 정리함' }
      try {
        return { ok: true, preview: cleanPreview(await this.cleanFacts()) }
      } catch (e) {
        return { ok: false, error: `정리 요약을 만들지 못함: ${message(e)}` }
      }
    })
  }

  /**
   * [Work 정리]의 [정리] (시나리오 8-2). 확인한 뒤 바뀌었으면 받지 않는다. 살아 있는 세션을 끝내고,
   * worktree를 지우고, 고른 브랜치를 지운 뒤 보관됨으로 바꾼다. 산출물은 지우지 않는다.
   */
  clean(input: CleanInput): Promise<CommandResult> {
    return this.enqueue(async () => {
      if (cutOperation(this.work)) return { ok: false, error: OPERATION_BLOCKS }
      if (!canClean(this.work)) return { ok: false, error: '완료나 포기한 Work만 정리함' }
      let facts: CleanFacts
      try {
        facts = await this.cleanFacts()
      } catch (e) {
        return { ok: false, error: `정리 요약을 만들지 못함: ${message(e)}` }
      }
      const plan = planClean(cleanPreview(facts), input)
      if (!plan.ok) return plan
      // 정리 전 HEAD: 보관된 Work의 [변경]이 작업 트리 대신 본다. 사람이 worktree 폴더를 먼저 지웠으면
      // 작업 브랜치의 커밋이다(worktree의 HEAD는 그 브랜치다)
      const opts = { env: this.ctx.env }
      const head = facts.worktree
        ? await headCommit(this.worktree, opts).catch(() => null)
        : await refCommit(this.project.repo_path, `refs/heads/${facts.branch.name}`, opts)
      this.opError = null
      const repos: RepoCleanStep[] = []
      for (const step of plan.repos ?? []) {
        const tree = this.repoTree(step.path)
        repos.push({
          ...step,
          head: (await exists(path.join(tree, '.git')))
            ? await headCommit(tree, opts).catch(() => null)
            : await refCommit(this.repoDir(step.path), `refs/heads/${facts.branch.name}`, opts),
        })
      }
      const r = await this.command({
        type: 'clean',
        at: this.ctx.at(),
        force: plan.force,
        deleteBranches: plan.deleteBranches,
        ...(plan.deleteRemote ? { deleteRemote: plan.deleteRemote } : {}),
        head,
        ...(repos.length ? { repos } : {}),
      })
      const failed = this.opError
      this.opError = null
      return r.ok && failed ? { ok: false, error: failed } : r
    })
  }

  /**
   * 정리의 git 작업 (8-2). 단계가 끝날 때마다 machine에 알려 진행 중 작업 기록을 옮긴다(D77).
   * 끊긴 정리를 다시 하면(resume) 끊긴 단계부터 하고, 아직 있는 브랜치만 지운다 (D123). 머지로 완료한 Work에서 고르면
   * 마지막에 origin의 브랜치를 지운다(D178). 이미 없으면(레포 설정이 머지 뒤 지움) 건너뛴다
   */
  private async cleanCode(e: Extract<Effect, { type: 'clean' }>): Promise<void> {
    const opts = { env: this.ctx.env }
    const repo = this.project.repo_path
    try {
      // 살아 있는 세션은 트리째 끝내고 기다린다 (8-1)
      for (const id of [...this.live.keys()]) await this.endSession(id)
      await this.endCleanup()
      this.cleanup = null
      // 곁 세션도 끝낸다: worktree를 지운다 (D390)
      await this.endSide()
      // 서브모듈 저장소가 깨져 있으면 git worktree remove가 실패한다 (D415)
      await this.guardSubmodule()
      // 묶음 Work는 서브모듈 worktree를 먼저 지운다 (D482). 그 뒤 메인 worktree는 비운 서브모듈 자리가 남아 --force다
      const bundled = (e.repos?.length ?? 0) > 0
      if (e.resume === undefined || e.resume === 'worktree')
        await this.removeRepoTrees(e.repos ?? [])
      if (e.resume === undefined) {
        if (await exists(this.worktree)) {
          await removeWorktree(repo, this.worktree, { ...opts, force: e.force || bundled })
        } else {
          await pruneWorktrees(repo, opts)
        }
        await this.removeIntegration()
      } else if (e.resume === 'worktree') {
        await this.removeCutWorktree(e.force || bundled)
        await this.removeIntegration()
      }
    } catch (err) {
      await this.cleanFailed(err)
      return
    }
    await this.feed({ type: 'clean.removed', at: this.ctx.at() })
    if (e.resume !== 'remote') {
      try {
        const names =
          e.resume === undefined ? e.deleteBranches : await this.existing(e.deleteBranches)
        await deleteBranches(repo, names, opts)
        // 서브모듈마다 그 저장소의 작업 브랜치를 지운다 (D482). 이미 없는 것은 건너뛴다
        for (const step of e.repos ?? []) {
          const dir = this.repoDir(step.path)
          const left: string[] = []
          for (const b of step.delete_branches) {
            if (await refCommit(dir, `refs/heads/${b}`, opts)) left.push(b)
          }
          await deleteBranches(dir, left, opts)
        }
      } catch (err) {
        await this.cleanFailed(err)
        return
      }
    }
    const remotes = (e.repos ?? []).filter((r) => r.delete_remote)
    if (e.deleteRemote || remotes.length > 0) {
      await this.feed({ type: 'clean.branchesDeleted', at: this.ctx.at() })
      try {
        if (e.deleteRemote && (await remoteBranchExists(repo, e.deleteRemote, 'origin', opts))) {
          await deleteRemoteBranch(repo, e.deleteRemote, 'origin', opts)
        }
        for (const step of remotes) {
          const dir = this.repoDir(step.path)
          const name = step.delete_remote ?? ''
          if (await remoteBranchExists(dir, name, 'origin', opts)) {
            await deleteRemoteBranch(dir, name, 'origin', opts)
          }
        }
      } catch (err) {
        await this.cleanFailed(err)
        return
      }
    }
    await this.feed({ type: 'clean.done', at: this.ctx.at() })
  }

  /**
   * 끊긴 정리의 worktree 단계 (D123). 폴더가 없으면 관리 정보만 prune한다. .git이 없으면(반쯤 지움) git worktree
   * remove가 --force로도 거부하므로 prune한 뒤 남은 폴더를 지운다. 있으면 core/recovery의 cleanResume으로 --force를
   * 다시 정해 지운다
   */
  private async removeCutWorktree(recordedForce: boolean): Promise<void> {
    const opts = { env: this.ctx.env }
    const repo = this.project.repo_path
    if (!(await exists(this.worktree))) {
      await pruneWorktrees(repo, opts)
      return
    }
    if (!(await exists(path.join(this.worktree, '.git')))) {
      await pruneWorktrees(repo, opts)
      await removeTree(this.worktree)
      return
    }
    const r = cleanResume(recordedForce, await statusLines(this.worktree, opts))
    if (!r.ok) throw new Error(r.error)
    await removeWorktree(repo, this.worktree, { ...opts, force: r.force })
  }

  /** 아직 있는 브랜치 */
  private async existing(names: readonly string[]): Promise<string[]> {
    const opts = { env: this.ctx.env }
    const out: string[] = []
    for (const name of names) {
      if (await refCommit(this.project.repo_path, `refs/heads/${name}`, opts)) out.push(name)
    }
    return out
  }

  /** worktree 폴더는 있는데 git이 worktree로 보지 않는다: 지우다 도중에 실패했다 (D140) */
  private async halfRemoved(): Promise<boolean> {
    if (!(await exists(this.worktree))) return false
    const root = await repoRoot(this.worktree, { env: this.ctx.env })
    return root === null || pathKey(root) !== pathKey(this.worktree)
  }

  private async cleanFailed(err: unknown): Promise<void> {
    const hint = (await this.halfRemoved().catch(() => false))
      ? `. ${halfRemovedHint(this.worktree)}`
      : ''
    this.opError = `정리 실패: ${message(err)}${hint}`
    this.problem(this.opError)
    await this.feed({ type: 'clean.failed', at: this.ctx.at(), error: message(err) })
  }

  /**
   * Work별 설정 (D72). 검사한 값을 받는다. 준 키만 바꾸고 빈 값이면 앱 설정을 따른다. 질문 방식은 다음에 시작하는
   * task부터 쓰고(D73), 카운트다운 중에 그 단계의 자동 승인을 끄면 바로 멈춘다 (D128)
   */
  updateSettings(settings: WorkSettingsPatch): Promise<CommandResult> {
    return this.enqueue(() =>
      this.command({ type: 'settings.update', at: this.ctx.at(), settings }),
    )
  }

  /**
   * 앱을 다시 켰을 때의 조정 (시나리오 9, D75, D78). 실행 중이던 task는 중단됨이나(유효한 handoff가 있으면)
   * 승인 대기로, 대기열의 task는 중단됨으로 바꾼다. OS 알림은 보내지 않고, 자동으로 재개하거나 승인하지 않는다.
   * killed는 Relay가 먼저 끝낸 이 Work의 고아 프로세스다 (D76). 남은 진행 중 작업 기록은 끊긴 작업이 된다 (D121).
   * 앱 소유 파일은 적힌 해시와 비교해 다르면 패널에 알린다. M6 전에 만든 Work는 경고 없이 적는다 (D124).
   */
  reconcile(killed: readonly RecordedProcess[] = []): Promise<void> {
    return this.enqueue(async () => {
      // 꺼져 있던 동안 남은 서브모듈 설정 바뀜도 되돌린다 (D415)
      if (this.work.status !== 'archived') await this.guardSubmodule()
      const task = currentTask(this.work)
      const check = task ? await this.checkOf(task) : null
      const tasks = killed.flatMap((p) => (p.taskId ? [{ taskId: p.taskId, pid: p.pid }] : []))
      // 앱이 끝내지 못한 세션: pty.log 끝에 앱이 꺼져 끝났다는 표시 줄을 남긴다 (D219)
      for (const t of this.work.tasks) {
        if (!t.session?.alive) continue
        await this.files
          .appendPtyMark(t, APP_END_MARK)
          .catch((e: unknown) => this.problem(`pty.log에 표시 줄을 쓰지 못함: ${message(e)}`))
      }
      await this.feed(
        {
          type: 'app.restarted',
          at: this.ctx.at(),
          check,
          ...(tasks.length ? { killed: tasks } : {}),
        },
        { quiet: true },
      )
      // 결과를 모르는 머지는 다시 켠 뒤에도 앱이 다시 확인한다 (D330)
      const op = cutOperation(this.work)
      if (op?.kind === 'merge' && op.unconfirmed) {
        this.laneState(op.repo ?? '').mergeConfirms = 0
        this.scheduleMergeConfirm(op.repo ?? '')
      }
      if (killed.length) {
        this.orphans = [...killed]
        this.changed()
      }
      let hashes: ActualHashes
      try {
        hashes = await this.files.ownedHashes(OWNED_FILES)
      } catch (e) {
        this.problem(`앱 소유 파일을 읽지 못함: ${message(e)}`)
        return
      }
      if (this.work.file_hashes) this.compareOwned(hashes)
      else await this.feed({ type: 'files.recorded', at: this.ctx.at(), hashes }, { quiet: true })
    })
  }

  // ---------- 끊긴 작업 (시나리오 9-4, D121~D123) ----------

  /**
   * 끊긴 작업의 [다시 시도] (D123). 되감기와 정리는 끊긴 곳부터 잇는다. 전달은 끊긴 시도가 만들었지만 기록하지 못한
   * stash와 커밋을 찾아 끊긴 시도를 실패로 남긴 뒤 같은 전달을 처음부터 한다. 커밋 안 된 변경이 남았으면 선택지를
   * 다시 보이게 변경 목록을 돌려준다 (7-5). git이 실패하면 오류를 돌려준다.
   */
  retryOperation(): Promise<DeliverResult> {
    return this.enqueue(async () => {
      const op = cutOperation(this.work)
      if (!op) return { ok: false, error: '끊긴 작업이 없음' }
      if (op.kind === 'deliver') {
        const found = await this.lostDelivery(op)
        const r = await this.command({ type: 'operationRetry', at: this.ctx.at(), found })
        if (!r.ok) return r
        // 묶음 Work는 같은 레포별 전달을 처음부터 한다. push와 열린 PR 찾기는 다시 해도 같다 (D479)
        if (op.repos) {
          const picks: RepoPick[] = [
            ...(mainEditable(this.work)
              ? [{ path: '', choice: op.skip_main ? null : op.choice }]
              : []),
            ...op.repos.map((x) => ({
              path: x.path,
              choice: x.choice,
              link: op.link?.includes(x.path) === true,
            })),
          ]
          return this.deliverBundle(picks, [])
        }
        return this.deliverNow(op.choice, null)
      }
      this.opError = null
      const r = await this.command({ type: 'operationRetry', at: this.ctx.at() })
      const failed = this.opError
      this.opError = null
      return r.ok && failed ? { ok: false, error: failed } : r
    })
  }

  /** 끊긴 작업의 [무시] (D123). 기록만 지우고 git은 건드리지 않는다. 전달은 끊긴 시도를 실패로 남긴다 */
  ignoreOperation(): Promise<CommandResult> {
    return this.enqueue(async () => {
      const op = cutOperation(this.work)
      if (!op) return { ok: false, error: '끊긴 작업이 없음' }
      const found = op.kind === 'deliver' ? await this.lostDelivery(op) : undefined
      return this.command({
        type: 'operationIgnore',
        at: this.ctx.at(),
        ...(found ? { found } : {}),
      })
    })
  }

  /**
   * 끊긴 전달이 만들었지만 기록하지 못한 stash와 커밋 (D123). [변경 버리고 진행]이면 이 Work의 메시지로 stash
   * 목록을, [커밋하고 진행]이면 HEAD 커밋을 본다. git을 읽지 못하면 없는 것으로 두고 알린다
   */
  private async lostDelivery(op: DeliverOperation): Promise<DeliveryFound> {
    const opts = { env: this.ctx.env }
    const id = this.work.work_id
    const known = knownBackups(this.work, op)
    try {
      const stashes =
        op.uncommitted === 'discard'
          ? lostStashes(id, await stashEntries(this.worktree, opts), known.stashes)
          : []
      const commit =
        op.uncommitted === 'commit'
          ? lostCommit(id, await commitInfo(this.worktree, 'HEAD', opts), known.commits)
          : null
      return { stashes, commits: commit ? [commit] : [] }
    } catch (e) {
      this.problem(`끊긴 전달이 만든 stash나 커밋을 찾지 못함: ${message(e)}`)
      return { stashes: [], commits: [] }
    }
  }

  // ---------- 알림 (D121) ----------

  /** 알림의 [확인] (D121). 바뀐 앱 소유 파일은 지금 내용의 해시를 다시 적어 받아들인다 (D124) */
  dismissNotice(id: string): Promise<CommandResult> {
    return this.enqueue(async () => {
      if (id === 'orphans') {
        this.orphans = []
      } else if (id === 'work_json') {
        this.workJsonChanges = []
      } else if (id === 'files') {
        let hashes: ActualHashes
        try {
          hashes = await this.files.ownedHashes([...this.fileChanges.keys()])
        } catch (e) {
          return { ok: false, error: `파일을 읽지 못함: ${message(e)}` }
        }
        this.fileChanges.clear()
        await this.feed({ type: 'files.recorded', at: this.ctx.at(), hashes })
      } else {
        return { ok: false, error: '알림이 없음' }
      }
      this.changed()
      return { ok: true }
    })
  }

  /**
   * 앱 소유 파일의 지금 해시를 적힌 해시와 비교해, 다른 파일을 알림에 넣는다 (D124). 이미 알린 해시면 다시 넣지
   * 않는다. 적힌 해시가 없는 Work(M6 전에 만듦)는 비교하지 않는다: 재시작 조정이 먼저 적는다
   */
  private compareOwned(actual: ActualHashes): void {
    const recorded = this.work.file_hashes
    if (!recorded) return
    const at = this.ctx.at()
    let added = false
    for (const file of changedFiles(recorded, actual)) {
      const hash = actual[file] ?? null
      if (this.fileChanges.get(file)?.hash === hash) continue
      const line = changedFileLine(
        file,
        recorded[file] ?? null,
        hash,
        at,
        this.files.ownedPath(file),
      )
      this.fileChanges.set(file, { line, hash })
      added = true
    }
    if (added) this.changed()
  }

  /** 앱이 앱 소유 파일을 고쳐 썼다: 쓰기 전에 읽은 내용을 적힌 해시와 비교하고(D124) 쓴 내용의 해시를 적는다 */
  private async ownedWritten(file: OwnedFile, written: OwnedWrite): Promise<void> {
    this.compareOwned({ [file]: written.before })
    await this.feed({ type: 'files.recorded', at: this.ctx.at(), hashes: { [file]: written.hash } })
  }

  /**
   * 앱을 끝낸다 (시나리오 3-6). 살아 있는 세션은 중단됨으로 남기고 트리째 끝낸다.
   * 대기열의 task는 그대로 두고 다음 실행 때 중단됨으로 바꾼다 (D78).
   */
  shutdown(): Promise<void> {
    this.quitting = true
    this.closing = true
    this.drafts.stop()
    this.stopPrTimers()
    // 도는 독립 리뷰를 끊는다. 다음 실행 때 처음부터 다시 돌린다 (D496). 호출 프로세스가 끝나기를 함께 기다린다
    for (const r of this.reviews.values()) r.abort()
    const reviewsIdle = this.reviewsIdle()
    const ended = this.enqueue(async () => {
      this.stopCountdown()
      const task = currentTask(this.work)
      if (task && this.live.has(task.id)) {
        await this.feed({
          type: 'interrupt',
          taskId: task.id,
          at: this.ctx.at(),
          reason: 'app_quit',
        })
      }
      // 보조 세션도 task 세션과 함께 끝낸다: 하나씩 끝내면 KILL_WAIT_MS를 차례로 기다린다
      await Promise.all([
        ...[...this.live.keys()].map((id) => this.endSession(id)),
        this.endCleanup(),
        this.endSide(),
      ])
    })
    return Promise.all([ended, reviewsIdle]).then(() => undefined)
  }

  /**
   * [기록 지우기] (D407): 보관된 Work의 기록과 산출물(works/<work-id>/)을 지운다. 정리하지 않은 Work는 Relay가 먼저
   * 정리한다. 하던 PR 읽기와 이슈 게시가 끝나기를 기다리고 더 걸지 않는다. 보관된 Work에는 세션이 없지만(정리가 끝냄,
   * 곁 세션은 열지 않음) 남았으면 끝낸다. 지우다 실패하면 work.json을 다시 써 Work를 남기고 멈춘 게시를 다시 건다.
   * files가 false면 디렉터리는 지우지 않고 멈추기만 한다: [등록 해제]가 프로젝트 디렉터리를 한 번에 지운다 (D409).
   * 지운 뒤로는 이 runner를 쓰지 않는다
   */
  async remove(opts: { files: boolean } = { files: true }): Promise<CommandResult> {
    if (this.removed) return { ok: false, error: '지운 Work임' }
    if (this.work.status !== 'archived') return { ok: false, error: '보관된 Work만 지움' }
    this.closing = true
    this.stopPrTimers()
    for (const r of this.reviews.values()) r.abort()
    await this.reviewsIdle()
    await this.prIdle()
    await this.issueIdle()
    return this.enqueue(async () => {
      if (this.removed) return { ok: false, error: '지운 Work임' }
      if (this.work.status !== 'archived' || this.work.operation) {
        this.resumeAfterRemove()
        return { ok: false, error: '보관된 Work만 지움' }
      }
      this.stopCountdown()
      await Promise.all([
        ...[...this.live.keys()].map((id) => this.endSession(id)),
        this.endCleanup(),
        this.endSide(),
      ])
      this.removed = true
      this.drafts.stop()
      if (!opts.files) return { ok: true }
      try {
        await removeTree(this.files.dir)
      } catch (e) {
        this.removed = false
        // 일부만 지웠으면 기록을 다시 써 Work를 남긴다
        try {
          this.workText = (await this.files.save(this.work)).text
        } catch (err) {
          this.problem(`work.json을 다시 쓰지 못함: ${message(err)}`)
        }
        this.resumeAfterRemove()
        this.changed()
        return { ok: false, error: `Work 기록을 지우지 못함: ${message(e)}` }
      }
      return { ok: true }
    })
  }

  /** 지우지 못했다: 앱을 끝내는 중이 아니면 읽기와 게시를 다시 받고, 남은 이슈 게시를 다시 건다 */
  private resumeAfterRemove(): void {
    this.closing = this.quitting
    this.publishIssueSoon()
  }

  /**
   * 작업 브랜치의 커밋 (D225): 기준 커밋 뒤의 커밋 수와 마지막 커밋, worktree 경로. 브랜치는 모든 worktree가 함께
   * 보므로 메인 체크아웃에서 읽는다. 커밋 안 된 변경은 넣지 않는다. 브랜치가 없으면(정리로 지움) null이다
   */
  private async branchInfo(): Promise<BranchInfo | null> {
    const opts = { env: this.ctx.env }
    const repo = this.project.repo_path
    const name = workBranch(this.work)
    const head = await refCommit(repo, name, opts).catch(() => null)
    if (!head) return null
    const ahead = await countCommits(repo, this.work.base_commit, head, opts).catch(() => 0)
    const last = ahead > 0 ? await commitInfo(repo, head, opts).catch(() => null) : null
    return {
      name,
      ahead,
      last: last ? { sha: last.id.slice(0, 8), subject: last.subject } : null,
      worktree: (await exists(this.worktree)) ? this.worktree : null,
    }
  }

  /**
   * Work 완료 화면의 "이 Work의 지식" (D298): 기준 커밋에서 to(null이면 작업 트리)까지 더하거나 고치거나 지운 지식.
   * 머지 전 앞 Work에 있던 경로를 다시 쓴 것은 그 Work의 글에서 본 diff다. 지식 관리를 끄면 null, 읽지 못하면 빈 목록
   */
  private async knowledgeView(
    cwd: string,
    to: string | null,
    handoff: string,
  ): Promise<KnowledgeChange[] | null> {
    const { env } = this.ctx
    if (!knowledgeEnabled(env)) return null
    try {
      const sources = this.ctx.knowledgeSources(this.project.project_id, this.work.work_id)
      const branchOf = new Map(sources.map((s) => [s.workId, s.branch]))
      const pending = await readPendingKnowledge(
        this.project.repo_path,
        this.work.base_commit,
        sources,
        { env },
      )
      const pendingFrom = new Map<string, string>()
      const pendingBranch = new Map<string, string>()
      for (const e of pending) {
        if (!e.pendingFrom) continue
        if (e.removed) {
          pendingFrom.delete(e.path)
          pendingBranch.delete(e.path)
          continue
        }
        pendingFrom.set(e.path, e.pendingFrom)
        const b = branchOf.get(e.pendingFrom)
        if (b) pendingBranch.set(e.path, b)
      }
      const files = await knowledgeFileChanges(cwd, this.work.base_commit, to, pendingBranch, {
        env,
      })
      return knowledgeChanges(files, pendingFrom, handoff).map((k) => ({
        ...k,
        diff: clip(k.diff),
      }))
    } catch (e) {
      console.error(`[${this.key}] 지식 변경을 읽지 못함: ${message(e)}`)
      return []
    }
  }

  /** 승인 화면(D83)과 Work 완료 화면(시나리오 7-3)에 보일 것. 파일을 다시 읽어 만든다 */
  async review(taskId: string): Promise<ReviewView | null> {
    const task = this.task(taskId)
    if (!task) return null
    const { env } = this.ctx
    const files = await this.files.taskFiles(task)
    const check = await this.checkOf(task, files)
    // 끝난 task는 그 task가 끝났을 때의 코드까지 본다. 작업 트리는 지금 코드의 마지막 task만 본다.
    // 정리한 Work는 worktree가 없어 메인 체크아웃에서 커밋끼리 비교한다 (시나리오 8). 정리 중에도 그렇다: 이 읽기는
    // 처리 줄 밖이라 지우는 worktree 안에서 git을 띄우면 Windows에서 git worktree remove가 실패한다
    const range = changeRange(this.work, task.id)
    const latest = range?.to === null
    const cwd =
      this.work.status === 'archived' || this.work.operation?.kind === 'clean'
        ? this.project.repo_path
        : this.worktree
    const bundled = isBundle(this.work)
    const picked = workRepos(this.work).map((r) => r.path)
    // 묶음 Work는 레포마다 센다 (D475)
    const uncommitted = latest
      ? bundled
        ? (await this.bundleUncommitted()).flatMap((r) =>
            r.path === '' ? r.lines : r.lines.map((l) => repoLine(r.path, l)),
          )
        : await statusLines(this.worktree, { env }).catch(() => [])
      : []
    // 서브모듈 안의 변경은 커밋 안 된 변경에 들지 않고 전달되지 않아 따로 알린다 (D384). 고른 서브모듈은 레포마다 센다
    const submodules = latest
      ? (await dirtySubmodules(this.worktree, { env }).catch(() => [])).filter(
          (p) => !picked.includes(p),
        )
      : []
    const integration = latest ? await this.integrationFacts(taskId) : null
    const bundle = latest && bundled ? await this.bundleFacts(taskId) : null
    const diffTo = (from: string) =>
      diffFrom(cwd, from, range?.to ?? null, { env }).catch(
        (e: unknown) => `변경을 읽지 못함: ${message(e)}`,
      )
    const diff = range ? await diffTo(range.from) : ''
    const handoffText = files[HANDOFF_FILE]
    const header = check.handoffHeader
    const respond = task.respond ? await this.respondReview(task, files) : null
    let completion: Completion | null = null
    if (completesWork(this.work, task)) {
      const workDiff = await diffTo(this.work.base_commit)
      // Work 완료 화면 (시나리오 7-3): 승인할 수 있는 verify는 전달 버튼이나(승인하면 멈추면
      // [승인하고 멈춤]), verify에서 멈춘 Work는 전달 버튼이다 (D119)
      const stopped = stoppedVerify(this.work)?.id === task.id
      const current =
        this.work.status === 'active' &&
        currentTask(this.work)?.id === task.id &&
        REVIEWABLE.includes(task.status)
      completion = {
        verdicts: verdicts(files[VERIFICATION_FILE] ?? ''),
        revisit: revisitDecisions(typeTarget(this.work), files[VERIFICATION_FILE] ?? ''),
        diff: clip(workDiff),
        mode:
          stopped || (current && !approvalStops(this.work)) ? 'deliver' : current ? 'stop' : null,
        stopped,
        buttons: deliveryButtons(this.checks()),
        delivery: deliveryView(this.work.delivery),
        branch: await this.branchInfo(),
        knowledge: await this.knowledgeView(cwd, range?.to ?? null, handoffText ?? ''),
        ...(bundled ? { repos: await this.repoCompletions(workDiff, latest) } : {}),
        review: completionReview(this.work, task),
      }
    }
    const shown = shownErrors(task, check.status, check.errors)
    return {
      workKey: this.key,
      taskId,
      node: task.node,
      label: taskLabel(task),
      taskStatus: task.status,
      reviewable:
        REVIEWABLE.includes(task.status) &&
        (task.node === RESPOND
          ? this.work.status === 'pr' &&
            !this.work.operation &&
            currentTask(this.work)?.id === task.id
          : this.work.status === 'active'),
      handoffPresent: check.handoff_present,
      handoffStatus: check.status,
      summary: handoffText === undefined ? null : handoffSummary(handoffText),
      decisions: header?.decisions ?? [],
      assumptions: header?.assumptions ?? [],
      risks: header?.risks ?? [],
      errors: shown,
      warnings: check.warnings,
      emphasis: emphasis({
        node: task.node,
        type: workType(this.work),
        handoff: header,
        errors: shown,
        uncommitted,
        submodules,
        ...(integration ? { integration } : {}),
        ...(bundle ? { bundle } : {}),
        live: this.live.has(task.id),
        ...(respond ? { tests: respond.tests, failure: respond.view.failure } : {}),
      }),
      lead: stageLead(task.node, files, customStep(this.work, task), finishesWork(this.work, task)),
      artifacts: Object.entries(files)
        .filter(([name]) => isArtifactName(name))
        .map(([name, text]) => ({ name, text })),
      ...(task.review ? { reviewLogs: await this.reviewLogs(task) } : {}),
      diff: clip(diff),
      ...(bundled ? { repoDiffs: await this.repoDiffs(task, diff) } : {}),
      gate: approvalGate(task, check),
      autoApprove: autoApproveNote(this.work, task, this.ctx.config()),
      completion,
      respond: respond?.view ?? null,
    }
  }

  /** 독립 리뷰의 진행 기록 (D502): 호출마다 independent-review/<kind>.log. 없는 호출(코드 리뷰를 끔 등)은 뺀다 */
  private async reviewLogs(task: TaskRecord): Promise<Artifact[]> {
    const out: Artifact[] = []
    for (const call of ['find', 'check'] as const) {
      const name = reviewLogFile(call)
      const text = await readText(path.join(this.files.taskDir(task), REVIEW_INPUT_DIR, name))
      if (text !== null) out.push({ name, text })
    }
    return out
  }

  /**
   * 묶음 Work의 커밋 안 된 변경 (D475): 메인(경로 '')과 고른 서브모듈마다. 메인은 고른 서브모듈의 자리를 빼고(D478이
   * 맞춤), 메인을 고르지 않았으면 비운다(전달하지 않는 메인 쪽 변경은 bundleFacts가 따로 알린다). 읽지 못한 레포는 비운다
   */
  private async bundleUncommitted(): Promise<{ path: string; lines: string[] }[]> {
    const opts = { env: this.ctx.env }
    const repos = workRepos(this.work)
    const main = mainEditable(this.work)
      ? withoutRepoPaths(
          await statusLines(this.worktree, opts).catch(() => []),
          repos.map((r) => r.path),
        )
      : []
    const out = [{ path: '', lines: main }]
    for (const r of repos) {
      out.push({
        path: r.path,
        lines: await statusLines(this.repoTree(r.path), opts).catch(() => []),
      })
    }
    return out
  }

  /**
   * 승인 화면의 묶음 Work 사실 (D471, D475): 작업 브랜치에서 벗어난 서브모듈 worktree와, 메인을 고르지 않았으면 메인 쪽
   * 변경(고른 서브모듈 자리 제외, 받아 둔 다른 서브모듈 안의 변경 포함). 읽기만 한다
   */
  private async bundleFacts(taskId: string): Promise<BundleFacts> {
    const opts = { env: this.ctx.env }
    const name = workBranch(this.work)
    const offBranch: { path: string; branch: string | null }[] = []
    for (const r of workRepos(this.work)) {
      const branch = await headBranch(this.repoTree(r.path), opts).catch(() => name)
      if (branch !== name) offBranch.push({ path: r.path, branch })
    }
    return {
      mainChanges: mainEditable(this.work) ? [] : await this.fixedMainChanges(),
      offBranch,
      workBranch: name,
      repaired: this.submoduleRepaired.has(taskId),
    }
  }

  /** 메인을 고르지 않은 묶음 Work의 메인 쪽 변경 (D471, D475): 정리 요약도 같은 목록을 보인다 */
  private async fixedMainChanges(): Promise<string[]> {
    const opts = { env: this.ctx.env }
    const picked = workRepos(this.work).map((r) => r.path)
    const [lines, dirty] = await Promise.all([
      statusLines(this.worktree, opts).catch(() => []),
      dirtySubmodules(this.worktree, opts).catch(() => []),
    ])
    return [
      ...withoutRepoPaths(lines, picked),
      ...dirty.filter((p) => !picked.includes(p)).map((p) => `서브모듈 ${p} 안의 변경`),
    ]
  }

  /**
   * 묶음 Work의 레포마다 이 task의 변경 (D475): 메인은 이미 읽은 것을 쓰고, 서브모듈은 그 레포의 시작 커밋부터다. 보관된
   * Work와 정리 중인 Work는 서브모듈 저장소(메인 체크아웃의 그 폴더)에서 커밋끼리 본다
   */
  private async repoDiffs(task: TaskRecord, mainDiff: string): Promise<RepoDiffView[]> {
    const out: RepoDiffView[] = [{ path: '', label: this.mainLabel(), diff: clip(mainDiff) }]
    for (const r of workRepos(this.work)) {
      const range = repoChangeRange(this.work, task.id, r.path)
      out.push({
        path: r.path,
        label: r.path,
        diff: range ? clip(await this.repoDiff(r.path, range.from, range.to)) : '',
      })
    }
    return out
  }

  /** 메인 레포의 화면 이름 (D472) */
  private mainLabel(): string {
    return `${projectName(this.project)} (메인${mainEditable(this.work) ? '' : ', 고치지 않음'})`
  }

  /** 서브모듈 하나의 from→to 변경. to가 null이면 그 worktree의 작업 트리까지다 */
  private async repoDiff(repoPath: string, from: string, to: string | null): Promise<string> {
    const cwd =
      this.work.status === 'archived' || this.work.operation?.kind === 'clean'
        ? this.repoDir(repoPath)
        : this.repoTree(repoPath)
    return diffFrom(cwd, from, to, { env: this.ctx.env }).catch(
      (e: unknown) => `변경을 읽지 못함: ${message(e)}`,
    )
  }

  /** 서브모듈 하나의 전달 버튼 (D477). 점검 전이면 지금 점검한다 */
  private async repoButtons(repoPath: string): Promise<DeliveryButtons> {
    let checks = this.repoCheckMap.get(repoPath)
    if (!checks) {
      try {
        checks = await this.ctx.repoChecks(this.repoDir(repoPath))
        this.repoCheckMap.set(repoPath, checks)
      } catch (e) {
        const reason = `점검하지 못함: ${message(e)}`
        return {
          none: { enabled: true, reason: null },
          push: { enabled: false, reason },
          pr: { enabled: false, reason },
        }
      }
    }
    return deliveryButtons(checks)
  }

  /** 서브모듈 하나의 작업 브랜치 커밋 (D225, D475). 브랜치는 그 서브모듈 저장소에서 읽는다 */
  private async repoBranchInfo(repoPath: string, baseCommit: string): Promise<BranchInfo | null> {
    const opts = { env: this.ctx.env }
    const dir = this.repoDir(repoPath)
    const name = workBranch(this.work)
    const head = await refCommit(dir, name, opts).catch(() => null)
    if (!head) return null
    const ahead = await countCommits(dir, baseCommit, head, opts).catch(() => 0)
    const last = ahead > 0 ? await commitInfo(dir, head, opts).catch(() => null) : null
    const tree = this.repoTree(repoPath)
    return {
      name,
      ahead,
      last: last ? { sha: last.id.slice(0, 8), subject: last.subject } : null,
      worktree: (await exists(path.join(tree, '.git'))) ? tree : null,
    }
  }

  /** 묶음 Work의 Work 완료 화면에서 레포마다 (D475, D477, D478). 메인이 맨 앞이다 */
  private async repoCompletions(mainDiff: string, latest: boolean): Promise<RepoCompletion[]> {
    const editable = mainEditable(this.work)
    const lines = latest ? await this.bundleUncommitted() : []
    const of = (p: string) => lines.find((l) => l.path === p)?.lines ?? []
    const out: RepoCompletion[] = [
      {
        path: '',
        label: this.mainLabel(),
        editable,
        diff: clip(mainDiff),
        branch: editable ? await this.branchInfo() : null,
        uncommitted: of(''),
        buttons: deliveryButtons(this.checks()),
        delivery: deliveryView(this.work.delivery),
        linkable: false,
      },
    ]
    for (const r of workRepos(this.work)) {
      const end = repoEndRange(this.work, r.path, r.base_commit)
      out.push({
        path: r.path,
        label: r.path,
        editable: true,
        diff: clip(await this.repoDiff(r.path, end.from, end.to)),
        branch: await this.repoBranchInfo(r.path, r.base_commit),
        uncommitted: of(r.path),
        buttons: await this.repoButtons(r.path),
        delivery: deliveryView(r.delivery),
        linkable: editable,
      })
    }
    return out
  }

  /**
   * PR 대응 task의 승인 화면에 더할 것 (D172, D180, D202, D207): 이번 라운드의 항목, 항목별 결과(response.md), 게시될 모양의
   * 답글(지금 replies.md로 만든다. 끝난 라운드는 게시한 기록), 함께 게시할 미룬 앞 라운드, 승인 뒤 실패한 push나 게시.
   * 기존 테스트 변경은 끝나지 않은 라운드만 git으로 가린다(라운드 시작 커밋 → 지금 작업 트리)
   */
  private async respondReview(
    task: TaskRecord,
    files: Readonly<Record<string, string>>,
  ): Promise<{ view: RespondReview; tests: string[] } | null> {
    const r = task.respond
    if (!r) return null
    const lane = laneOf(task)
    const w = this.laneWork(lane)
    const file = await this.prItems(lane)
    const prior = file.rounds.find((x) => x.task_id === task.id)
    const pending = pendingRespond(w)?.id === task.id
    const start = laneStart(task, lane)
    const round: PrRound =
      !pending && prior
        ? prior
        : planRound({
            workId: this.work.work_id,
            task: { id: task.id, respond: r },
            items: file.items,
            replies: files[REPLIES_FILE],
            signature: this.ctx.config().reply_signature,
            prior,
          })
    let tests: string[] = []
    if (pending && start) {
      try {
        tests = existingTestChanges(
          await changedPaths(this.laneTree(lane), start, { env: this.ctx.env }),
        )
      } catch (e) {
        this.problem(`기존 테스트 변경을 읽지 못함: ${message(e)}`)
      }
    }
    const rules = this.prRules(lane)
    return {
      tests,
      view: {
        round: r.round,
        instruction: r.instruction,
        items: roundItemViews(r.items, new Map(file.items.map((i) => [i.id, i])), rules),
        results: sectionText(files[RESPONSE_FILE] ?? '', '항목별 결과'),
        replies: round.replies.map((x) => ({
          item: x.item,
          where:
            x.thread === null ? 'PR 대화 코멘트로 새로 올림' : `스레드 inline:${x.thread}에 답글`,
          body: visibleBody(x),
          url: x.url ?? null,
          skipped: x.skipped ?? null,
        })),
        deferred: pending ? deferredRounds(w).map((t) => taskLabel(t)) : [],
        failure: respondFailureView(r.failure),
        blocked: pending && w.pr?.closed_at ? PR_CLOSED : null,
      },
    }
  }

  // ---------- PR 진행 (시나리오 10, D152~D200) ----------

  /** PR 카드의 메모리 상태 (D480). 처음 쓸 때 만든다 */
  private laneState(lane: string): Lane {
    let l = this.laneStates.get(lane)
    if (!l) {
      l = {
        file: null,
        read: null,
        local: null,
        error: null,
        reading: null,
        timer: null,
        headSeen: new Map(),
        runEvents: new Map(),
        autoWanted: false,
        autoRunning: null,
        startRead: false,
        mergeConfirms: 0,
        relink: [],
        relinkChecked: [],
        relinkOk: new Map(),
      }
      this.laneStates.set(lane, l)
    }
    return l
  }

  /** PR 카드의 렌즈 (D480, I174): 서브모듈 카드는 그 레포를 메인 자리에 둔 Work다. 판정에만 쓰고 쓰지 않는다 */
  private laneWork(lane: string): WorkState {
    return focusLane(this.work, lane)
  }

  /** PR 카드의 worktree: 메인은 메인 worktree, 서브모듈은 그 서브모듈 worktree다 */
  private laneTree(lane: string): string {
    return lane ? this.repoTree(lane) : this.worktree
  }

  /** PR 카드의 저장소: 메인은 메인 체크아웃, 서브모듈은 그 서브모듈 저장소다. 브랜치와 원격, gh의 작업 폴더다 */
  private laneRepo(lane: string): string {
    return lane ? this.repoDir(lane) : this.project.repo_path
  }

  /** PR 카드의 worktree에서 깨끗한지 볼 때 빼는 자리: 메인 카드는 고른 서브모듈의 gitlink다 (D475) */
  private laneIgnore(lane: string): string[] {
    return lane ? [] : workRepos(this.work).map((r) => r.path)
  }

  /** PR 카드의 worktree의 커밋 안 된 변경 (laneIgnore를 뺌) */
  private async laneStatus(lane: string): Promise<string[]> {
    const lines = await statusLines(this.laneTree(lane), { env: this.ctx.env })
    return withoutRepoPaths(lines, this.laneIgnore(lane))
  }

  /** 진행 중인 머지나 대응의 push·게시의 PR 카드 (D480) */
  private opLane(): string {
    const op = this.work.operation
    return op?.kind === 'merge' || op?.kind === 'respond' ? (op.repo ?? '') : ''
  }

  /** PR 카드의 이벤트에 붙이는 레포 (D480). 메인 카드는 없다 */
  private laneTag(lane: string): { repo?: string } {
    return lane ? { repo: lane } : {}
  }

  /** 지금 있는 PR 카드 (D480): 메인 PR이 맨 앞이다 */
  private cardLanes(): string[] {
    return prCards(this.work).map((c) => c.lane)
  }

  /** 지금 프로젝트. 프로젝트 설정은 실행 중에 바뀐다 (D185) */
  private projectNow(): ProjectState {
    return this.ctx.project(this.project.project_id) ?? this.project
  }

  /** 코멘트의 거르기 규칙: 프로젝트 설정의 받을 봇 (D161, D197). 서브모듈 카드는 그 서브모듈의 칸이다 (D483) */
  private prRules(lane: string): ItemRules {
    return { allowedBots: repoSettings(this.projectNow(), lane).allowedBots }
  }

  /** pr-items.json. 처음 쓸 때 읽는다. 읽지 못하면 알리고 빈 목록으로 둔다 */
  private async prItems(lane: string): Promise<PrItemsFile> {
    const L = this.laneState(lane)
    if (!L.file) {
      try {
        L.file = await this.files.readPrItems(lane)
      } catch (e) {
        this.problem(`pr-items.json을 읽지 못함: ${message(e)}`)
        L.file = { ...EMPTY_PR_ITEMS, items: [], synced: [], rounds: [] }
      }
    }
    return L.file
  }

  /** 머지 조건 (D176, D196, D481) */
  private prGate(lane: string): Gate {
    const L = this.laneState(lane)
    return mergeGate({
      work: this.laneWork(lane),
      read: L.read,
      items: L.file?.items ?? [],
      localHead: L.local,
      ...(lane ? {} : { relink: L.relink, relinkChecked: L.relinkChecked }),
    })
  }

  /** PR 진행인 Work의 배지 (D183) */
  private prBadge(lane: string): BadgeKind | undefined {
    const L = this.laneState(lane)
    if (this.laneWork(lane).status !== 'pr') return undefined
    const items = L.file?.items ?? []
    // 상한에 닿아 자동 시작을 멈췄으면 "자동 대응 멈춤"이 앞선다 (D171, D183)
    const paused = autoPlan(this.laneWork(lane), items, this.ctx.config()).kind === 'paused'
    return prBadgeKind(
      items,
      this.laneWork(lane).pr?.closed_at !== undefined,
      this.prGate(lane),
      paused,
    )
  }

  /**
   * PR 카드가 여럿인 Work의 배지 (D183, D480): 끝나지 않은 카드의 배지 가운데 사람이 먼저 볼 것이다 (prBadgeKind의 차례)
   */
  private cardBadge(): BadgeKind | undefined {
    const kinds = prCards(this.work)
      .filter((c) => !cardDone(c.pr))
      .map((c) => this.prBadge(c.lane))
    return CARD_BADGE_ORDER.find((k) => kinds.includes(k)) ?? kinds[0]
  }

  /** PR 패널 (시나리오 10, D183) */
  private prPanel(lane: string): PrView | null {
    const L = this.laneState(lane)
    return prView({
      work: this.laneWork(lane),
      config: this.ctx.config(),
      read: L.read,
      file: L.file ?? EMPTY_PR_ITEMS,
      rules: this.prRules(lane),
      localHead: L.local,
      reading: L.reading !== null,
      error: L.error,
      ...(lane ? {} : { relink: L.relink, relinkChecked: L.relinkChecked }),
    })
  }

  /**
   * PR 진행을 시작했거나 앱을 켰다 (시나리오 10-1, D158, D159). 항목을 읽어 두고, 닫히지 않은 PR이면 바로 한 번 읽고
   * 주기 읽기를 건다. 닫힌 PR은 [새로 고침]으로만 읽는다(D179). quiet면(앱을 켤 때) 반영에 성공한 첫 읽기까지 알리지
   * 않고 자동 대응을 바라지 않는다 (D159, D121). 읽기는 기다리지 않는다: 반영은 이 Work의 처리 줄에서 한다(I51)
   */
  async startPr(opts: { quiet?: boolean } = {}): Promise<void> {
    // PR 카드마다 한다 (D480)
    for (const lane of this.cardLanes()) await this.startLane(lane, opts)
  }

  private async startLane(lane: string, opts: { quiet?: boolean }): Promise<void> {
    const L = this.laneState(lane)
    const pr = this.laneWork(lane).pr
    if (!pr) return
    if (opts.quiet) L.startRead = true
    await this.prItems(lane)
    // 항목의 대응 중·처리됨을 대응 task의 기록(work.json)에 맞춘다: 앱이 둘 사이에 꺼졌을 수 있다 (D189)
    await this.syncItemStatus(lane)
    this.changed()
    if (this.work.status !== 'pr' || pr.closed_at || pr.merged || pr.ended_at) return
    void this.readPrNow(lane)
  }

  /** 주기 읽기를 건다 (D158). PR 진행이 아니거나 닫혔거나 앱을 끝내면 걸지 않는다 */
  private schedulePr(lane: string): void {
    const L = this.laneState(lane)
    if (L.timer) clearTimeout(L.timer)
    L.timer = null
    const w = this.laneWork(lane)
    // 머지되거나 끝낸 카드는 다른 카드가 남아도 읽지 않는다 (D480)
    if (this.closing || w.status !== 'pr' || !w.pr || w.pr.closed_at || cardDone(w.pr)) return
    L.timer = setTimeout(() => {
      L.timer = null
      void this.readPrNow(lane)
    }, this.ctx.config().pr_poll_interval_sec * 1000)
  }

  /**
   * 하던 PR 읽기가 끝나기를 기다린다. 앱을 끝낼 때는 기다리지 않는다(네트워크를 기다려 종료가 늦어짐). 끝난 읽기는
   * 반영하지 않는다. 시험 도구가 임시 폴더를 지우기 전에 부른다: Windows는 gh·git이 작업 폴더로 쓰는 폴더를 지우지
   * 못한다
   */
  async prIdle(): Promise<void> {
    for (const L of this.laneStates.values()) while (L.reading) await L.reading
  }

  /** 모든 PR 카드의 주기 읽기를 멈춘다: 앱을 끝내거나 기록을 지운다 */
  private stopPrTimers(): void {
    for (const L of this.laneStates.values()) {
      if (L.timer) clearTimeout(L.timer)
      L.timer = null
    }
  }

  /** PR 패널의 [새로 고침] (D158). 닫힌 PR도 읽어 다시 열렸는지 본다 (D179). repo는 서브모듈 PR 카드다 (D480) */
  refreshPr(lane = ''): Promise<CommandResult> {
    return this.readPrNow(lane)
  }

  /**
   * PR을 한 번 읽는다 (시나리오 10-2, I51). 네트워크 부분은 처리 줄 밖에서 하고 반영은 줄에서 한다. 읽는 중이면 그
   * 읽기가 끝난 뒤 다시 읽는다. 끝나면 다음 주기 읽기를 건다
   */
  private async readPrNow(lane: string): Promise<CommandResult> {
    const L = this.laneState(lane)
    while (L.reading) await L.reading
    if (this.closing) return { ok: false, error: '앱을 끝내는 중' }
    const run = this.readPrOnce(lane).catch((e: unknown): CommandResult =>
      this.prFailed(lane, `PR을 읽지 못함: ${message(e)}`),
    )
    L.reading = run
    this.changed()
    try {
      return await run
    } finally {
      L.reading = null
      this.changed()
      this.schedulePr(lane)
    }
  }

  private prFailed(lane: string, error: string): CommandResult {
    const L = this.laneState(lane)
    L.error = error
    console.error(`[${this.key}] ${error}`)
    return { ok: false, error }
  }

  private async readPrOnce(lane: string): Promise<CommandResult> {
    const L = this.laneState(lane)
    const pr = this.laneWork(lane).pr
    if (this.laneWork(lane).status !== 'pr' || !pr)
      return { ok: false, error: 'PR 진행인 Work가 아님' }
    if (cardDone(pr)) return { ok: true }
    // 끊긴 작업의 기록이 있는 동안은 읽지 않는다 (I51, D122). 진행 중인 머지는 처리 줄이 끝나야 읽는다
    if (cutOperation(this.laneWork(lane))) return { ok: false, error: OPERATION_BLOCKS }
    const location = prLocation(pr.url)
    if (!location) return this.prFailed(lane, `PR 주소를 읽지 못함: ${pr.url}`)
    const file = await this.prItems(lane)
    // CI 실패 항목에 적힌 이벤트를 다시 읽지 않는다. 읽기에 실패해도 항목의 id가 바뀌지 않는다 (I52)
    for (const item of file.items) {
      const c = item.check
      if (c && c.run !== null && c.event) L.runEvents.set(c.run, c.event)
    }
    let fetched: PrFetched
    try {
      fetched = await readPr(
        {
          ghBin: this.ctx.ghBin,
          env: this.ctx.env,
          repo: this.laneRepo(lane),
          worktree: this.laneTree(lane),
          ignore: this.laneIgnore(lane),
          branch: workBranch(this.laneWork(lane)),
          location,
          runEvents: L.runEvents,
        },
        (id, job) => ciLogRead(file.items, id, job),
      )
    } catch (e) {
      return this.prFailed(lane, `PR을 읽지 못함: ${message(e)}`)
    }
    // 메인 PR은 머지된 서브모듈 커밋을 가리키는지도 본다 (D481)
    if (!lane) {
      const r = await this.relinkNeeded(L.relinkOk)
      L.relink = r.need
      L.relinkChecked = r.checked
    }
    return this.enqueue(() => this.applyRead(lane, pr.number, fetched))
  }

  /**
   * 메인이 머지된 커밋을 가리키지 않는 서브모듈 (D481): 메인이 새 커밋을 가리키게 한 서브모듈 가운데 PR이 머지됐는데, 메인
   * 작업 브랜치가 가리키는 그 서브모듈 커밋이 그 서브모듈의 머지 대상(원격)에 없는 것. squash·rebase 머지는 커밋 id를
   * 바꾼다. 머지 대상은 받아서 본다(네트워크라 처리 줄 밖). 확인한 것은 checked에 넣고, 읽지 못한 것은 넣지 않는다. 머지
   * 대상에 있다고 확인한 gitlink는 ok에 두고 바뀌지 않았으면 다시 받지 않는다
   */
  private async relinkNeeded(
    ok: Map<string, string>,
  ): Promise<{ need: string[]; checked: string[] }> {
    const opts = { env: this.ctx.env }
    const need: string[] = []
    const checked: string[] = []
    for (const r of workRepos(this.work)) {
      if (!r.linked || !r.pr?.merged) continue
      try {
        const dir = this.repoDir(r.path)
        const sha = await gitlinkAt(this.worktree, 'HEAD', r.path, opts)
        if (sha && ok.get(r.path) === sha) {
          checked.push(r.path)
          continue
        }
        const tip = await fetchTip({ repo: dir, env: this.ctx.env }, repoTarget(r))
        if (!sha || !tip) continue
        if (await isAncestor(dir, sha, tip, opts).catch(() => false)) ok.set(r.path, sha)
        else need.push(r.path)
        checked.push(r.path)
      } catch (e) {
        this.problem(`${r.path}: 머지된 서브모듈 커밋을 확인하지 못함: ${message(e)}`)
      }
    }
    return { need, checked }
  }

  /**
   * 메인 PR 카드의 [서브모듈 커밋 맞추기] (D481): 머지된 서브모듈 PR의 머지 커밋을 gh로 읽어, 메인 작업 브랜치에 그 커밋을
   * 가리키는 커밋을 더하고 push한다. 사람이 누른 push다 (D15). 곧 메인 PR을 다시 읽는다
   */
  relinkSubmodules(): Promise<CommandResult> {
    return this.enqueue(async () => {
      if (cutOperation(this.work)) return { ok: false, error: OPERATION_BLOCKS }
      const pr = this.work.pr
      if (this.work.status !== 'pr' || !pr || pr.merged || pr.ended_at)
        return { ok: false, error: '메인 PR이 진행 중인 Work가 아님' }
      if (anyPendingRespond(this.work))
        return { ok: false, error: '돌거나 기다리는 PR 대응 task가 있음' }
      const paths = this.laneState('').relink
      if (!paths.length) return { ok: false, error: '맞출 서브모듈이 없음' }
      const opts = { env: this.ctx.env }
      const links: { path: string; sha: string }[] = []
      try {
        for (const p of paths) {
          const sub = workRepos(this.work).find((r) => r.path === p)
          const location = sub?.pr ? prLocation(sub.pr.url) : null
          if (!sub?.pr || !location) throw new Error(`${p}: PR 주소를 읽지 못함`)
          const view = await ghPrView(
            this.ctx.ghBin,
            {
              repo: repoArg(location),
              number: sub.pr.number,
              cwd: this.repoDir(p),
              env: this.ctx.env,
            },
            ['mergeCommit'],
          )
          const merged = view['mergeCommit']
          const sha =
            merged && typeof merged === 'object'
              ? (merged as Record<string, unknown>)['oid']
              : undefined
          if (typeof sha !== 'string' || !sha) throw new Error(`${p}: 머지 커밋을 읽지 못함`)
          if (!(await hasCommit(this.repoDir(p), sha, opts))) {
            await fetchTip({ repo: this.repoDir(p), env: this.ctx.env }, repoTarget(sub))
          }
          links.push({ path: p, sha })
        }
        const off = offWorkBranch(workBranch(this.work), await currentBranch(this.worktree, opts))
        if (off) throw new Error(off)
        const commit = await commitGitlinksAt(
          this.worktree,
          links,
          relinkMessage(this.work.work_id, links),
          opts,
        )
        await pushBranch(this.worktree, workBranch(this.work), 'origin', opts)
        await this.feed({ type: 'pr.relinked', at: this.ctx.at(), links, commit })
      } catch (e) {
        return { ok: false, error: `서브모듈 커밋을 맞추지 못함: ${message(e)}` }
      }
      this.laneState('').relink = []
      setTimeout(() => void this.readPrNow(''), 0)
      return { ok: true }
    })
  }

  /**
   * 읽은 결과를 반영한다 (처리 줄 안, I51). 새 head를 처음 읽은 때로 CI를 정하고(D196), 원격만 앞섰으면 fast-forward로
   * 받고(D193) 기준 브랜치 병합이 있으면 기준 커밋을 옮기고(D181), 항목을 모아(D189, D199) pr-items.json에 쓰고,
   * 읽은 결과를 machine에 넣는다. 사람이 움직여야 하면 알린다(D184): 대응 거리가 들어옴, 머지할 수 있음, 닫힘,
   * 밖에서 머지됨. 앱을 켤 때의 읽기(반영에 성공한 첫 읽기)는 알리지 않는다(D159)
   */
  private async applyRead(lane: string, number: number, f: PrFetched): Promise<CommandResult> {
    const L = this.laneState(lane)
    const pr = this.laneWork(lane).pr
    // 앱을 끝내는 동안 끝난 읽기는 반영하지 않는다. 다음에 켤 때 다시 읽는다 (D159)
    if (this.closing) return { ok: false, error: '앱을 끝내는 중' }
    if (
      this.laneWork(lane).status !== 'pr' ||
      !pr ||
      pr.number !== number ||
      this.laneWork(lane).operation
    ) {
      return { ok: false, error: '읽는 동안 Work가 바뀌어 반영하지 않음' }
    }
    const at = this.ctx.at()
    const now = Date.now()
    const mergeableBefore = this.prGate(lane).enabled
    const closedBefore = pr.closed_at !== undefined
    // D196: 새 head를 처음 읽은 때부터 60초는 체크가 없어도 통과로 보지 않는다
    const seen = L.headSeen.get(f.view.head) ?? now
    L.headSeen.set(f.view.head, seen)
    const warnings = [...f.warnings]
    let local = f.local
    let sync = f.sync
    let synced: PrSynced | null = null
    // PR 대응 task가 끝나기 전에는 fast-forward하지 않는다 (D193): 대응 task가 코드를 바꾸는 중이다
    // 다른 PR 카드의 대응 task가 도는 동안에도 받지 않는다: 에이전트가 같은 작업 공간에서 일한다 (D480)
    if (sync === 'ff' && local && !anyPendingRespond(this.work)) {
      try {
        synced = await this.fastForward(lane, local, f.view.head, f.view.baseRef, at)
        local = f.view.head
        sync = 'same'
      } catch (e) {
        warnings.push(`원격 커밋을 받지 못함: ${message(e)}`)
        sync = null
      }
    }
    const file = await this.prItems(lane)
    // 앱이 게시한 답글은 항목으로 보지 않는다: 적어 둔 코멘트 id와 보이지 않는 표시로 가린다 (D194)
    const comments = f.comments.filter((c) => !isAppReply(c, this.laneWork(lane).work_id, file))
    const gathered = gatherItems(
      file.items,
      {
        at,
        head: f.view.head,
        comments,
        failing: f.checks.filter((c) => c.bucket === 'fail'),
        conflict: f.conflict,
        diverged: sync === null || !local ? undefined : divergedFact(sync, f.view.head, local),
        logs: f.logs,
      },
      this.prRules(lane),
    )
    const next: PrItemsFile = {
      ...file,
      items: gathered.items,
      synced: synced ? [...file.synced, synced] : file.synced,
    }
    try {
      await this.files.writePrItems(next, lane)
    } catch (e) {
      return this.prFailed(lane, `pr-items.json을 쓰지 못함: ${message(e)}`)
    }
    L.file = next
    L.local = local
    L.read = {
      at,
      state: f.view.state,
      head: f.view.head,
      headRef: f.view.headRef,
      baseRef: f.view.baseRef,
      isDraft: f.view.isDraft,
      mergeable: f.view.mergeable,
      mergeStateStatus: f.view.mergeStateStatus,
      reviewDecision: f.view.reviewDecision,
      checks: f.checks,
      ci: ciState(f.checks, now - seen >= CHECK_WAIT_MS),
      sync,
    }
    L.error = warnings.length ? warnings.join(' / ') : null
    const quiet = L.startRead
    await this.feed(
      {
        type: 'pr.read',
        ...this.laneTag(lane),
        at,
        number,
        state: f.view.state,
        head: f.view.head,
        baseRef: f.view.baseRef,
        received: gathered.received,
        notAccepted: gathered.notAccepted,
        ...(synced
          ? {
              synced: {
                commits: synced.commits,
                ...(synced.base_commit ? { baseCommit: synced.base_commit } : {}),
              },
            }
          : {}),
      },
      { quiet: true },
    )
    L.startRead = false
    // 받은 새 항목으로 자동 대응을 바란다. 앱을 켤 때의 읽기는 보이기만 한다 (D159, D210)
    const autoOn = autoStartOn(this.ctx.config(), this.laneWork(lane).settings)
    const wanted = wantsAutoStart({ quiet, received: gathered.received.length, on: autoOn })
    if (wanted) L.autoWanted = true
    if (!quiet) {
      const w = this.laneWork(lane)
      const notes: string[] = []
      if (w.status === 'completed' && w.pr?.merged?.outside) {
        // 승인했지만 push·게시를 미룬 라운드(D193)는 머지에 들어가지 않았다
        const lost = deferredRounds(w).length
        notes.push(
          lost
            ? `밖에서 머지됨. 승인했지만 push·게시하지 못한 대응 라운드 ${lost}개는 머지에 들어가지 않음. [Work 정리]로 정리하세요`
            : '밖에서 머지됨. [Work 정리]로 정리하세요',
        )
      } else if (w.status === 'pr') {
        if (w.pr?.closed_at && !closedBefore) notes.push('PR이 닫혀 자동 읽기를 멈춤')
        // 자동 대응이 맡으면 들어옴 대신 자동 시작이나 멈춤을 알린다. 사람이 손대야 풀리면 알린다 (D184, D211)
        if (gathered.received.length && receivedNeedsNotice(w, next.items, this.ctx.config())) {
          notes.push(`대응 거리 ${gathered.received.length}개가 들어옴`)
        }
        if (!mergeableBefore && this.prGate(lane).enabled) notes.push('머지할 수 있음')
      }
      if (notes.length) this.notify(`PR #${number}: ${notes.join(' · ')}`)
    }
    this.changed()
    if (wanted) this.autoRespondSoon(lane)
    return { ok: true }
  }

  /**
   * 원격만 앞선 PR 브랜치를 받는다 (D193, S7 관찰 8). 읽은 뒤 바뀌었을 수 있어 로컬 Work 브랜치, worktree의 변경과
   * 브랜치를 다시 본다. 받은 커밋에 기준 브랜치 병합이 있으면 기준 브랜치를 fetch해 옮길 기준 커밋을 정한다 (D181)
   */
  private async fastForward(
    lane: string,
    local: string,
    remote: string,
    baseRef: string,
    at: string,
  ): Promise<PrSynced> {
    const opts = { env: this.ctx.env }
    const repo = this.laneRepo(lane)
    const branch = workBranch(this.laneWork(lane))
    if ((await refCommit(repo, `refs/heads/${branch}`, opts)) !== local) {
      throw new Error('읽은 뒤 로컬 Work 브랜치가 바뀜')
    }
    if ((await this.laneStatus(lane)).length) {
      throw new Error('읽은 뒤 worktree에 커밋 안 된 변경이 생김')
    }
    if ((await currentBranch(this.laneTree(lane), opts)) !== branch) {
      throw new Error('worktree가 Work 브랜치에 있지 않음')
    }
    await mergeFastForward(this.laneTree(lane), remote, opts)
    const ctx = { repo, env: this.ctx.env }
    const { received, base } = await receivedCommits(
      ctx,
      local,
      remote,
      this.laneWork(lane).base_commit,
      () => fetchTip(ctx, baseRef || targetBranch(this.laneWork(lane))),
    )
    return { at, from: local, commits: received, ...(base ? { base_commit: base } : {}) }
  }

  /**
   * 프로젝트 설정이 바뀌었다 (D185). 받을 봇이 바뀌었을 수 있어 PR 진행인 Work의 항목에 거르기 규칙을 다시 적용한다
   * (D161). 사람이 바꾼 것이라 알리지 않는다
   */
  projectSettingsChanged(): Promise<void> {
    return this.enqueue(async () => {
      // PR 카드마다 한다 (D480)
      for (const lane of this.work.status === 'pr' ? this.cardLanes() : []) {
        const L = this.laneState(lane)
        const file = await this.prItems(lane)
        const r = reapplyRules(file.items, this.prRules(lane))
        if (r.changed.length) {
          const next: PrItemsFile = { ...file, items: r.items }
          try {
            await this.files.writePrItems(next, lane)
            L.file = next
          } catch (e) {
            this.problem(`pr-items.json을 쓰지 못함: ${message(e)}`)
          }
        }
      }
      this.changed()
    })
  }

  /** PR 패널의 [제외], [다시 넣기], [받기] (D160, D161, D170, D189). PR 진행인 Work만 받는다 */
  prItem(id: string, action: PrItemAction, lane = ''): Promise<CommandResult> {
    const L = this.laneState(lane)
    return this.enqueue(async () => {
      if (this.laneWork(lane).status !== 'pr') return { ok: false, error: 'PR 진행인 Work가 아님' }
      if (cutOperation(this.laneWork(lane))) return { ok: false, error: OPERATION_BLOCKS }
      const file = await this.prItems(lane)
      const r = applyItemAction(file.items, id, action)
      if (!r.ok) return r
      const next: PrItemsFile = { ...file, items: r.items }
      try {
        await this.files.writePrItems(next, lane)
      } catch (e) {
        return { ok: false, error: `pr-items.json을 쓰지 못함: ${message(e)}` }
      }
      L.file = next
      this.changed()
      return { ok: true }
    })
  }

  /**
   * 머지 창 (D176, D177): 레포가 허용하는 방식을 gh로 읽고(S7 관찰 6), 기본 선택(프로젝트 설정이 허용되면 그것,
   * 아니면 허용하는 첫 방식)과 머지할 head, 지금 머지 조건을 준다
   */
  async prMergeInfo(lane = ''): Promise<MergeInfoResult> {
    const pr = this.laneWork(lane).pr
    if (this.laneWork(lane).status !== 'pr' || !pr)
      return { ok: false, error: 'PR 진행인 Work가 아님' }
    const location = prLocation(pr.url)
    if (!location) return { ok: false, error: `PR 주소를 읽지 못함: ${pr.url}` }
    let methods: MergeMethod[]
    try {
      methods = allowedMethods(
        await ghMergeSettings(this.ctx.ghBin, {
          repo: repoArg(location),
          cwd: this.laneRepo(lane),
          env: this.ctx.env,
        }),
      )
    } catch (e) {
      return { ok: false, error: `레포가 허용하는 머지 방식을 읽지 못함: ${message(e)}` }
    }
    if (!methods.length) return { ok: false, error: '레포가 허용하는 머지 방식이 없음' }
    // 대응 라운드가 push했거나 원격 커밋을 받았으면 판정표가 대응 전 코드 기준이다 (D180, D206)
    const lw = this.laneWork(lane)
    const verify = [...lw.tasks]
      .reverse()
      .find((t) => t.status !== 'discarded' && completesWork(lw, t))
    const table = verify
      ? verdicts((await this.files.taskFiles(verify))[VERIFICATION_FILE] ?? '')
      : []
    return {
      ok: true,
      info: {
        head: pr.head,
        methods,
        preferred: preferredMethod(methods, repoSettings(this.projectNow(), lane).mergeMethod),
        gate: this.prGate(lane),
        stale: staleVerdicts(await this.prItems(lane)),
        verdicts: table,
      },
    }
  }

  /** 머지 창의 [머지] (D176). 창에 보인 head와 지금 머지 조건을 machine이 본다. 실패하면 GitHub의 오류를 돌려준다 */
  prMerge(input: MergeInput): Promise<CommandResult> {
    const lane = input.repo ?? ''
    const L = this.laneState(lane)
    return this.enqueue(async () => {
      this.opError = null
      // 새 머지는 결과 다시 확인(D330)의 횟수를 처음부터 센다
      L.mergeConfirms = 0
      const r = await this.command({
        type: 'pr.merge',
        at: this.ctx.at(),
        method: input.method,
        head: input.head,
        gate: this.prGate(lane),
        ...this.laneTag(lane),
      })
      const failed = this.opError
      this.opError = null
      if (!r.ok) return r
      return failed ? { ok: false, error: failed } : { ok: true }
    })
  }

  /**
   * 머지 (D176~D178): gh pr merge --match-head-commit. TTY가 아니면 성공해도 출력이 없으므로 종료 코드와 다시 읽은
   * state로 판정한다(S7 관찰 6). 끊긴 머지를 다시 하면(resume) 먼저 읽어 이미 머지됐으면 성공으로 둔다 (D123).
   * 그사이 새 커밋이 생겨 GitHub가 거절하면 알리고 다시 읽는다
   */
  private async mergeCode(lane: string, e: Extract<Effect, { type: 'merge' }>): Promise<void> {
    const L = this.laneState(lane)
    const pr = this.laneWork(lane).pr
    const location = pr ? prLocation(pr.url) : null
    const fail = async (error: string) => {
      this.opError = error
      await this.feed({ type: 'pr.mergeFailed', at: this.ctx.at(), error })
    }
    if (!pr || !location) {
      await fail('PR 주소를 읽지 못함')
      return
    }
    const gh = {
      repo: repoArg(location),
      number: pr.number,
      cwd: this.laneRepo(lane),
      env: this.ctx.env,
    }
    const state = async () => (await ghPrView(this.ctx.ghBin, gh, ['state']))['state']
    // 머지 요청은 보냈는데 결과를 못 읽었다 (D330): 실패로 알리지 않고 끊긴 작업으로 남겨 다시 확인한다
    const unconfirmed = async (err: unknown) => {
      console.error(`[${this.key}] 머지 결과를 읽지 못함: ${message(err)}`)
      await this.feed({
        type: 'pr.mergeFailed',
        at: this.ctx.at(),
        error: message(err),
        unconfirmed: true,
      })
      this.scheduleMergeConfirm(lane)
    }
    try {
      if (e.resume) {
        let before: unknown
        try {
          before = await state()
        } catch (err) {
          // 결과를 모르는 머지를 확인하다 또 못 읽었으면 그대로 기다린다. 끊긴 머지는 지금처럼 실패다
          const op = this.work.operation
          if (op?.kind === 'merge' && op.unconfirmed) {
            await unconfirmed(err)
            return
          }
          throw err
        }
        if (before === 'MERGED') {
          L.mergeConfirms = 0
          await this.feed({ type: 'pr.merged', at: this.ctx.at() })
          return
        }
      }
      const r = await ghMerge(this.ctx.ghBin, { ...gh, method: e.method, head: e.head })
      if (!r.ok) {
        // 새 커밋이 생긴 직후에는 GitHub가 "Head branch was modified" 대신 "Pull Request is not mergeable"로
        // 거절하기도 한다(3절, M9 [실제]). 문구에 기대지 않고 head를 다시 읽어 가른다
        const moved = r.headMoved || (await this.headMoved(gh, e.head))
        await fail(
          moved
            ? `그사이 PR에 새 커밋이 생겨 머지하지 않음. 다시 읽은 뒤 머지 창을 다시 여세요 (${r.error})`
            : `머지 실패: ${r.error}`,
        )
        // 머지가 거절되면 PR이 바뀌었을 수 있어 곧 다시 읽는다
        setTimeout(() => void this.readPrNow(lane), 0)
        return
      }
      // 성공 문구는 TTY일 때만 찍으므로 다시 읽어 머지됐는지 본다 (S7 관찰 6, 3절)
      let now: unknown
      try {
        now = await state()
      } catch (err) {
        await unconfirmed(err)
        return
      }
      L.mergeConfirms = 0
      if (now !== 'MERGED') {
        await fail(`gh pr merge는 성공했지만 PR이 머지되지 않음 (state: ${String(now)})`)
        return
      }
      await this.feed({ type: 'pr.merged', at: this.ctx.at() })
    } catch (err) {
      await fail(`머지 실패: ${message(err)}`)
    }
  }

  /**
   * 결과를 모르는 머지를 잠시 뒤 다시 확인한다 (D330): 끊긴 작업의 [다시 시도]와 같다. 몇 번 해도 못 읽으면 사람의
   * [다시 시도]를 기다린다
   */
  private scheduleMergeConfirm(lane: string): void {
    const L = this.laneState(lane)
    if (L.mergeConfirms >= MERGE_CONFIRM_TRIES) return
    L.mergeConfirms++
    setTimeout(
      () => {
        const op = cutOperation(this.laneWork(lane))
        if (this.closing || op?.kind !== 'merge' || !op.unconfirmed) return
        void this.retryOperation()
      },
      Number(this.ctx.env['RELAY_MERGE_CONFIRM_MS']) || MERGE_CONFIRM_MS,
    )
  }

  /** PR의 지금 head가 머지하려던 head와 다른가. 읽지 못하면 모른다(false) */
  private async headMoved(gh: GhPrOptions, head: string): Promise<boolean> {
    try {
      const now = (await ghPrView(this.ctx.ghBin, gh, ['headRefOid']))['headRefOid']
      return typeof now === 'string' && now !== '' && now !== head
    } catch {
      return false
    }
  }

  /**
   * PR이 열려 있는지 다시 읽는다 (D208): 닫혔거나 머지됐거나 읽지 못하면 던진다. 대응의 push와 답글 게시 바로 전에 부른다.
   * 앱이 마지막으로 읽은 것은 읽기 주기만큼 늦을 수 있다
   */
  private async ensureOpen(lane: string, number: number, location: PrLocation): Promise<void> {
    const gh = {
      repo: repoArg(location),
      number,
      cwd: this.laneRepo(lane),
      env: this.ctx.env,
    }
    let state: unknown
    try {
      state = (await ghPrView(this.ctx.ghBin, gh, ['state']))['state']
    } catch (e) {
      throw new Error(`PR 상태를 읽지 못해 push·게시하지 않음 (D208): ${message(e)}`, {
        cause: e,
      })
    }
    if (state !== 'OPEN') {
      const what = state === 'MERGED' ? '머지됨' : state === 'CLOSED' ? '닫힘' : String(state)
      throw new Error(`PR이 열려 있지 않아(${what}) push·게시하지 않음 (D179, D208)`)
    }
  }

  /** [머지 없이 끝내기] (D179). 확인 창은 화면이 띄운다. GitHub의 PR은 건드리지 않는다 */
  prEnd(lane = ''): Promise<CommandResult> {
    return this.enqueue(() =>
      this.command({ type: 'pr.end', at: this.ctx.at(), ...this.laneTag(lane) }),
    )
  }

  /** 머지 뒤 정리 창을 열었다 (D178, D200) */
  prCleanOffered(lane = ''): Promise<CommandResult> {
    return this.enqueue(() =>
      this.command({ type: 'pr.cleanOffered', at: this.ctx.at(), ...this.laneTag(lane) }),
    )
  }

  // ---------- PR 대응 (시나리오 10-3~10-7, D168~D207) ----------

  /** pr-items.json을 쓰고 메모리에 둔다. 쓰지 못하면 던진다 */
  private async writePr(lane: string, next: PrItemsFile): Promise<void> {
    const L = this.laneState(lane)
    await this.files.writePrItems(next, lane)
    L.file = next
  }

  /** 항목의 대응 중·처리됨을 대응 task의 기록(work.json)에 맞춘다 (D189). 쓰지 못하면 알리고 다음에 다시 맞춘다 */
  private async syncItemStatus(lane: string): Promise<void> {
    const file = await this.prItems(lane)
    const r = reconcileItems(file.items, this.laneWork(lane))
    if (!r.changed.length) return
    try {
      await this.writePr(lane, { ...file, items: r.items })
    } catch (e) {
      this.problem(`pr-items.json을 쓰지 못함: ${message(e)}`)
    }
    this.changed()
  }

  /**
   * PR 패널의 [대응 시작] (시나리오 10-3, D170, D182). 먼저 기준 브랜치와 PR 브랜치를 fetch한다(네트워크라 처리 줄 밖, I51).
   * 실패해도 시작한다: 대응 task는 앱이 가진 원격 추적 브랜치로 한다. 줄에서 사람이 본 새 항목이 지금 새 항목과 같은지
   * 보고, 원격만 앞섰으면 받은 뒤(D181, D193) 대응 task를 시작한다. 넣은 항목은 대응 중이 된다 (D189)
   */
  async respond(input: RespondStartInput): Promise<CommandResult> {
    const lane = input.repo ?? ''
    const L = this.laneState(lane)
    const pre = respondStart(this.laneWork(lane), L.file?.items ?? [])
    if (!pre.enabled) return { ok: false, error: pre.reason ?? '대응을 시작할 수 없음' }
    if (this.cleanupOpen()) return { ok: false, error: CLEANUP_BLOCKS }
    const remote = await this.fetchForRound(lane)
    return this.enqueue(async () => {
      const file = await this.prItems(lane)
      const error = respondInputError(
        respondStart(this.laneWork(lane), file.items),
        input.items,
        input.instruction,
      )
      if (error) return { ok: false, error }
      return this.startRound(lane, { items: input.items, instruction: input.instruction }, remote)
    })
  }

  /**
   * 대응 라운드 전에 기준 브랜치와 PR 브랜치를 fetch한다 (시나리오 10-3). 네트워크라 처리 줄 밖에서 한다(I51). 실패해도
   * 시작한다: 대응 task는 앱이 가진 원격 추적 브랜치로 한다. PR 브랜치의 원격 끝이고, 읽지 못하면 null이다
   */
  private async fetchForRound(lane: string): Promise<string | null> {
    const ctx = { repo: this.laneRepo(lane), env: this.ctx.env }
    await fetchTip(ctx, targetBranch(this.laneWork(lane)))
    return fetchTip(ctx, workBranch(this.laneWork(lane)))
  }

  /**
   * 대응 라운드를 시작한다 (시나리오 10-3, D170, D181, D193). [대응 시작]과 자동 대응(D154)이 같이 쓰고, 판정(사람이 본
   * 항목, 자동 대응의 판정)과 실패했을 때의 처리는 부르는 쪽이 한다. 처리 줄 안에서 부른다. 정리 세션이 열려 있으면
   * 시작하지 않는다(D137). 원격만 앞섰으면 받고, 받지 못하면 시작하지 않는다: 새 항목은 남아 [대응 시작]할 수 있다.
   * 대응 task를 넣은 뒤 받은 커밋과 대응 중이 된 항목을 적는다 (D189)
   */
  private async startRound(
    lane: string,
    input: { items: readonly string[]; instruction: string; auto?: boolean },
    remote: string | null,
  ): Promise<CommandResult> {
    if (this.cleanupOpen()) return { ok: false, error: CLEANUP_BLOCKS }
    const at = this.ctx.at()
    let synced: PrSynced | null
    try {
      synced = remote ? await this.syncForRespond(lane, remote, at) : null
    } catch (e) {
      return { ok: false, error: `원격 PR 브랜치의 새 커밋을 받지 못함: ${message(e)}` }
    }
    const r = await this.command({
      type: 'pr.respond',
      ...this.laneTag(lane),
      at,
      items: [...input.items],
      instruction: input.instruction,
      ...(input.auto ? { auto: true } : {}),
      ...(synced && remote
        ? {
            synced: {
              head: remote,
              commits: synced.commits,
              ...(synced.base_commit ? { baseCommit: synced.base_commit } : {}),
            },
          }
        : {}),
    })
    // 상태의 기준은 work.json이라 쓰지 못하면 켤 때 맞춘다 (D189)
    const now = await this.prItems(lane)
    try {
      await this.writePr(lane, {
        ...now,
        items: reconcileItems(now.items, this.laneWork(lane)).items,
        synced: synced ? [...now.synced, synced] : now.synced,
      })
    } catch (e) {
      this.problem(`pr-items.json을 쓰지 못함: ${message(e)}`)
    }
    this.changed()
    return r
  }

  /**
   * [대응 시작] 전에 원격만 앞선 PR 브랜치를 받는다 (시나리오 10-3, D181, D193). 읽기의 fast-forward와 같은 규칙이다: 로컬
   * Work 브랜치가 원격의 조상이고 worktree가 깨끗하고 Work 브랜치에 있을 때만 받는다. 아니면 받지 않고 시작한다: 갈라짐은
   * 항목이 되고, 승인 뒤 push가 거절되면 라운드를 미룬다
   */
  private async syncForRespond(lane: string, remote: string, at: string): Promise<PrSynced | null> {
    const opts = { env: this.ctx.env }
    const repo = this.laneRepo(lane)
    const branch = workBranch(this.laneWork(lane))
    const local = await refCommit(repo, `refs/heads/${branch}`, opts)
    if (!local || local === remote) return null
    const localInRemote = await isAncestor(repo, local, remote, opts)
    if (!localInRemote) return null
    const clean = (await this.laneStatus(lane)).length === 0
    const onBranch = (await currentBranch(this.laneTree(lane), opts)) === branch
    const kind = syncKind({ local, remote, localInRemote, remoteInLocal: false, clean, onBranch })
    if (kind !== 'ff') return null
    return this.fastForward(lane, local, remote, targetBranch(this.laneWork(lane)), at)
  }

  // ---------- 자동 대응 (D154, D159, D171, D184, D210) ----------

  /**
   * 바라 둔 자동 대응을 판정한다. 바람이 없거나 판정하는 중이거나 앱을 끝내는 중이면 아무것도 하지 않는다. 기다리지
   * 않는다: 네트워크(fetch)는 처리 줄 밖에서 하고 시작은 줄에서 한다 (I51)
   */
  private autoRespondSoon(lane: string): void {
    const L = this.laneState(lane)
    if (!L.autoWanted || L.autoRunning || this.closing) return
    L.autoRunning = this.autoRespond(lane)
      .catch((e: unknown) => this.problem(`자동 대응을 시작하지 못함: ${message(e)}`))
      .finally(() => {
        L.autoRunning = null
      })
  }

  /** 자동 대응 (D154, D170, D171, D184, D210): 판정을 따라 시작하거나, 상한에서 멈추고 알리거나, 막힘이 풀리기를 기다린다 */
  private async autoRespond(lane: string): Promise<void> {
    const L = this.laneState(lane)
    const pre = autoPlan(this.laneWork(lane), L.file?.items ?? [], this.ctx.config())
    if (pre.kind === 'wait') return
    if (pre.kind === 'off' || pre.kind === 'none') {
      L.autoWanted = false
      return
    }
    // [대응 시작]처럼 시작하기 전에 기준 브랜치와 PR 브랜치를 fetch한다 (시나리오 10-3). 실패해도 시작한다
    const remote = pre.kind === 'start' ? await this.fetchForRound(lane) : null
    await this.enqueue(async () => {
      if (this.closing) return
      const file = await this.prItems(lane)
      // fetch하는 동안 바뀌었을 수 있어 줄에서 다시 판정한다
      const plan = autoPlan(this.laneWork(lane), file.items, this.ctx.config())
      if (plan.kind === 'wait') return
      L.autoWanted = false
      const pr = this.laneWork(lane).pr
      if (!pr) return
      if (plan.kind === 'paused') {
        await this.feed({
          type: 'pr.autoPaused',
          at: this.ctx.at(),
          items: plan.items,
          ...this.laneTag(lane),
        })
        this.notify(autoPausedNotice(pr.number, plan.max, plan.items.length))
        return
      }
      if (plan.kind !== 'start') return
      const r = await this.startRound(
        lane,
        { items: plan.items, instruction: '', auto: true },
        remote,
      )
      if (!r.ok) {
        // 사람이 누르지 않았는데 사람이 필요해졌다: 새 항목은 남아 [대응 시작]할 수 있다
        const error = `자동 대응을 시작하지 못함: ${r.error}`
        this.problem(error)
        this.notify(`PR #${pr.number}: ${error}`)
        return
      }
      this.notify(autoStartNotice(pr.number, plan.round, plan.items.length))
    })
  }

  /**
   * PR 대응의 push와 답글 게시 (시나리오 10-6, D169, D172~D174, D181, D193, D194, D205, D207). 게시할 답글을 적어 두고,
   * push를 미룬 앞 라운드와 함께 push하고, 답글을 하나씩 게시하며 게시할 때마다 코멘트 id를 적는다. 원격의 새 커밋 때문에
   * push가 거절되면 라운드를 미룬다. 실패하면 오류를 남기고 대응 task는 승인 대기로 남는다. 어느 쪽이든 곧 PR을 다시 읽는다
   */
  private async respondCode(lane: string, e: Extract<Effect, { type: 'respond' }>): Promise<void> {
    const op = this.laneWork(lane).operation
    if (op?.kind !== 'respond') return
    const pr = this.laneWork(lane).pr
    const location = pr ? prLocation(pr.url) : null
    try {
      if (!pr || !location) throw new Error(`PR 주소를 읽지 못함: ${pr?.url ?? ''}`)
      // 닫히거나 머지된 PR에는 push하지도 답글을 게시하지도 않는다. 앱이 닫힘을 읽기 전의 승인과 끊긴 작업의
      // [다시 시도]도 막는다 (D179, D208)
      await this.ensureOpen(lane, pr.number, location)
      await this.planReplies(lane, op, e.resume === true)
      if (op.stage === 'push') {
        const pushed = await this.respondPush(lane, op)
        if (!pushed) {
          const check = (await this.checkNow(op.task_id)) ?? null
          await this.feed({ type: 'respond.deferred', at: this.ctx.at(), check })
          setTimeout(() => void this.readPrNow(lane), 0)
          return
        }
        await this.feed({ type: 'respond.pushed', at: this.ctx.at(), ...pushed })
      }
      const replies = await this.postReplies(lane, op, location)
      const base = (await this.prItems(lane)).rounds.find((r) => r.task_id === op.task_id)?.pushed
        ?.base_commit
      const check = (await this.checkNow(op.task_id)) ?? null
      await this.feed({
        type: 'respond.published',
        at: this.ctx.at(),
        check,
        replies,
        ...(base && base !== this.laneWork(lane).base_commit ? { baseCommit: base } : {}),
      })
      await this.syncItemStatus(lane)
    } catch (err) {
      const now = this.laneWork(lane).operation
      const stage = now?.kind === 'respond' ? now.stage : op.stage
      this.opError = `PR 대응의 ${RESPOND_STAGE_LABEL[stage]} 실패: ${message(err)}`
      console.error(`[${this.key}] ${this.opError}`)
      await this.feed({ type: 'respond.failed', at: this.ctx.at(), error: message(err) })
      // 자동 승인한 라운드는 사람이 누르지 않았으니 실패를 알린다 (D81, D130과 같은 까닭). 사람이 누른 승인은 결과로 보인다
      if (op.by === 'auto') {
        const task = this.task(op.task_id)
        const label = task ? taskLabel(task) : op.task_id
        this.notify(
          `${pr ? `PR #${pr.number}: ` : ''}${label} 자동 승인한 대응의 ${RESPOND_STAGE_LABEL[stage]} 실패 — 승인 화면에서 [다시 시도]를 누르세요 (${message(err)})`,
        )
      }
    }
    // push나 게시로 PR이 바뀌었다: 새 head의 체크, 게시한 답글 거르기
    setTimeout(() => void this.readPrNow(lane), 0)
  }

  /**
   * 게시할 답글을 적어 둔다 (D172, D190, D194, D207). 승인한 라운드는 지금 replies.md로 정한다: 실패한 뒤 다시 승인했으면
   * 고친 초안을 쓴다. 게시했거나 건너뛴 답글은 그대로다. push를 미룬 앞 라운드와, 끊긴 작업을 잇는 경우(resume)는 적어 둔
   * 것을 쓴다: 사람이 승인한 본문이다. 적어 둔 것이 없는 라운드만 정한다
   */
  private async planReplies(lane: string, op: RespondOperation, resume: boolean): Promise<void> {
    const file = await this.prItems(lane)
    const rounds = [...file.rounds]
    let changed = false
    for (const id of op.rounds) {
      const task = this.task(id)
      if (!task?.respond) continue
      const i = rounds.findIndex((r) => r.task_id === id)
      const prior = i >= 0 ? rounds[i] : undefined
      if (prior && (resume || id !== op.task_id)) continue
      const files = await this.files.taskFiles(task)
      const next = planRound({
        workId: this.laneWork(lane).work_id,
        task: { id, respond: task.respond },
        items: file.items,
        replies: files[REPLIES_FILE],
        signature: this.ctx.config().reply_signature,
        prior,
      })
      if (i >= 0) rounds[i] = next
      else rounds.push(next)
      changed = true
    }
    if (changed) await this.writePr(lane, { ...file, rounds })
  }

  /**
   * push (시나리오 10-6): M5와 같은 일반 push다. 강제 push는 하지 않는다(D181). worktree가 Work 브랜치에 있지 않으면 하지
   * 않는다(D138). 원격에 이미 있는 커밋이면 보내지 않는다(끊긴 push를 다시 함). 거절되면 PR 브랜치를 fetch해 원격과 로컬
   * HEAD의 조상 관계로 가른다: 갈라졌으면 원격의 새 커밋 때문이라 null(라운드를 미룸, D193), 보낼 커밋이 이미 원격에
   * 있으면 push한 것으로 본다. 거절 문구에 기대지 않는다(M9의 머지와 같은 까닭, S7 관찰 8)
   */
  private async respondPush(
    lane: string,
    op: RespondOperation,
  ): Promise<{ head: string; commits: string[] } | null> {
    const opts = { env: this.ctx.env }
    const repo = this.laneRepo(lane)
    const ctx = { repo, env: this.ctx.env }
    const branch = workBranch(this.laneWork(lane))
    const off = offWorkBranch(branch, await currentBranch(this.laneTree(lane), opts))
    if (off) throw new Error(lane ? `${lane}: ${off}` : off)
    const head = await headCommit(this.laneTree(lane), opts)
    const inRemote = async (remote: string | null) =>
      remote !== null && (remote === head || (await isAncestor(repo, head, remote, opts)))
    const tip = await fetchTip(ctx, branch)
    // 실패한 뒤 다시 승인했고 그때 push한 head 그대로면 다시 적지 않는다: 이번에 올라간 커밋이 없다
    const pushed = (await this.prItems(lane)).rounds.find((r) => r.task_id === op.task_id)?.pushed
    if (pushed?.head === head && (await inRemote(tip))) return { head, commits: [] }
    if (!(await inRemote(tip))) {
      try {
        await pushBranch(this.laneTree(lane), branch, 'origin', opts)
      } catch (err) {
        const after = await fetchTip(ctx, branch)
        if (!(await inRemote(after))) {
          if (after && !(await isAncestor(repo, after, head, opts))) return null
          throw err
        }
      }
    }
    return this.recordPush(lane, op, head)
  }

  /**
   * push한 것을 라운드 기록에 적는다: 승인할 때 읽은 원격 head(from)에서 닿지 않는 커밋(원격에 없던 것)과, 이번에 push한
   * 라운드들이 기준 브랜치를 병합했으면 옮길 기준 커밋(D181. 원격을 병합해 들어온 기준 브랜치 병합도 본다). 미룬 앞 라운드에는
   * 함께 push한 라운드를 적는다 (D193)
   */
  private async recordPush(
    lane: string,
    op: RespondOperation,
    head: string,
  ): Promise<{ head: string; commits: string[] }> {
    const opts = { env: this.ctx.env }
    const repo = this.laneRepo(lane)
    const ctx = { repo, env: this.ctx.env }
    const firstTask = this.task(op.rounds[0] ?? op.task_id)
    const first = firstTask ? laneStart(firstTask, lane) : undefined
    const from = (await hasCommit(repo, op.from, opts)) ? op.from : first
    const commits = from
      ? (await commitsWithParents(repo, from, head, opts)).map((c) => c.commit)
      : []
    const base = first
      ? (
          await receivedCommits(ctx, first, head, this.laneWork(lane).base_commit, () =>
            fetchTip(ctx, targetBranch(this.laneWork(lane))),
          )
        ).base
      : null
    const file = await this.prItems(lane)
    const at = this.ctx.at()
    const rounds = file.rounds.map((r): PrRound =>
      r.task_id === op.task_id
        ? { ...r, pushed: { at, head, commits, ...(base ? { base_commit: base } : {}) } }
        : op.rounds.includes(r.task_id)
          ? { ...r, pushed_with: op.task_id }
          : r,
    )
    await this.writePr(lane, { ...file, rounds })
    return { head, commits }
  }

  /**
   * 라운드마다 답글을 하나씩 게시한다 (시나리오 10-6, D172~D174, D194, D205, D207). 게시했거나 건너뛴 답글을 돌려준다
   * (5.5 pr.replied). 끊긴 뒤 이었으면 앞서 게시한 답글도 넣는다
   */
  private async postReplies(
    lane: string,
    op: RespondOperation,
    location: PrLocation,
  ): Promise<{ item: string; commentId?: number; skipped?: string }[]> {
    // 코멘트 목록은 한 번의 게시에서 종류마다 한 번만 받는다: 찾는 표시는 앞선 시도에서 올린 답글이고, 없어졌는지는
    // 원래 코멘트만 본다. 실패하면 그 자리에서 멈추고 [다시 시도]가 새로 받는다
    const lists: ReplyLists = new Map()
    for (const id of op.rounds) {
      const round = (await this.prItems(lane)).rounds.find((r) => r.task_id === id)
      if (!round) continue
      for (const reply of unpostedReplies(round))
        await this.postReply(lane, id, reply, location, lists)
    }
    return (await this.prItems(lane)).rounds
      .filter((r) => op.rounds.includes(r.task_id))
      .flatMap((r) => r.replies)
      .flatMap((x): { item: string; commentId?: number; skipped?: string }[] =>
        x.comment_id !== undefined
          ? [{ item: x.item, commentId: x.comment_id }]
          : x.skipped !== undefined
            ? [{ item: x.item, skipped: x.skipped }]
            : [],
      )
  }

  /**
   * 답글 하나를 게시한다 (D194, D205, D207). GitHub에서 없어진 코멘트(앞 읽기에서 없어짐)면 건너뛴다. 시도했지만 결과를 모르는
   * 답글은 먼저 원격에서 보이지 않는 표시를 찾아 있으면 id만 적는다. 게시하기 전에 시도한 때를 적고, 게시하면 코멘트 id를
   * 바로 적는다. 인라인 답글이 GitHub의 오류로 실패했는데 다시 읽어도 그 코멘트가 없으면 건너뛴다
   */
  private async postReply(
    lane: string,
    taskId: string,
    reply: PrReply,
    location: PrLocation,
    lists: ReplyLists,
  ): Promise<void> {
    const file = await this.prItems(lane)
    const item = file.items.find((i) => i.id === reply.item)
    if (item?.gone) {
      await this.updateReply(lane, taskId, reply.item, { skipped: GONE_SKIP })
      return
    }
    if (reply.attempted_at) {
      const found = await this.findReply(lane, reply, location, lists)
      if (found) {
        await this.updateReply(lane, taskId, reply.item, {
          comment_id: found.id,
          ...(found.url ? { url: found.url } : {}),
          posted_at: this.ctx.at(),
        })
        return
      }
    }
    await this.updateReply(lane, taskId, reply.item, { attempted_at: this.ctx.at() })
    const rest = restRepo(location)
    const n = location.number
    const path =
      reply.thread === null
        ? `${rest}/issues/${n}/comments`
        : `${rest}/pulls/${n}/comments/${reply.thread}/replies`
    let res: Record<string, unknown>
    try {
      res = await ghApiPost(this.ctx.ghBin, {
        host: location.host,
        path,
        body: { body: reply.body },
        cwd: this.laneRepo(lane),
        env: this.ctx.env,
      })
    } catch (err) {
      const answered = err instanceof GhApiError && err.status !== null
      if (reply.thread !== null && answered) {
        let gone: boolean
        try {
          gone = await this.inlineGone(lane, reply, location, lists)
        } catch (listErr) {
          // 목록을 읽지 못해도 사람이 볼 것은 게시가 실패한 원래 까닭이다
          throw new Error(`${message(err)} (코멘트 목록도 읽지 못함: ${message(listErr)})`, {
            cause: listErr,
          })
        }
        if (gone) {
          await this.markGone(lane, reply.item)
          await this.updateReply(lane, taskId, reply.item, { skipped: GONE_SKIP })
          return
        }
      }
      throw err
    }
    const id = typeof res['id'] === 'number' ? res['id'] : null
    if (id === null) throw new Error(`게시한 답글의 id를 읽지 못함 (${reply.item})`)
    const url = typeof res['html_url'] === 'string' ? res['html_url'] : undefined
    await this.updateReply(lane, taskId, reply.item, {
      comment_id: id,
      ...(url ? { url } : {}),
      posted_at: this.ctx.at(),
    })
  }

  /** 답글이 올라갈 REST 목록 (스레드에 단 답글은 인라인 코멘트, 아니면 대화 코멘트). 한 번의 게시에서 종류마다 한 번 받는다 */
  private replyList(
    lane: string,
    reply: PrReply,
    location: PrLocation,
    lists: ReplyLists,
  ): Promise<unknown[]> {
    const kind = reply.thread === null ? 'convo' : 'inline'
    let list = lists.get(kind)
    if (!list) {
      list = listPrComments(
        { ghBin: this.ctx.ghBin, env: this.ctx.env, repo: this.laneRepo(lane), location },
        kind,
      )
      lists.set(kind, list)
    }
    return list
  }

  /** 게시 결과를 모르는 답글을 원격에서 보이지 않는 표시로 찾는다 (D194). 없으면 null */
  private async findReply(
    lane: string,
    reply: PrReply,
    location: PrLocation,
    lists: ReplyLists,
  ): Promise<{ id: number; url: string | null } | null> {
    for (const raw of await this.replyList(lane, reply, location, lists)) {
      const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
      const body = typeof c['body'] === 'string' ? c['body'] : ''
      if (typeof c['id'] === 'number' && body.includes(reply.marker)) {
        return { id: c['id'], url: typeof c['html_url'] === 'string' ? c['html_url'] : null }
      }
    }
    return null
  }

  /** 인라인 답글이 달릴 코멘트(항목의 코멘트나 스레드 첫 코멘트)가 GitHub에서 없어졌는가 (D205) */
  private async inlineGone(
    lane: string,
    reply: PrReply,
    location: PrLocation,
    lists: ReplyLists,
  ): Promise<boolean> {
    const ids = new Set(
      (await this.replyList(lane, reply, location, lists)).map((raw) =>
        raw && typeof raw === 'object' ? (raw as Record<string, unknown>)['id'] : null,
      ),
    )
    const own = Number(reply.item.slice('inline:'.length))
    return !ids.has(own) || !ids.has(reply.thread)
  }

  /** 없어진 코멘트를 적는다 (D205). 항목은 그 라운드를 게시하면 처리됨이다 */
  private async markGone(lane: string, itemId: string): Promise<void> {
    const file = await this.prItems(lane)
    await this.writePr(lane, {
      ...file,
      items: file.items.map((i) => (i.id === itemId ? { ...i, gone: true } : i)),
    })
  }

  /** 라운드 기록의 답글 하나를 고쳐 바로 쓴다 (D194: 게시할 때마다 적음) */
  private async updateReply(
    lane: string,
    taskId: string,
    itemId: string,
    patch: Partial<PrReply>,
  ): Promise<void> {
    const file = await this.prItems(lane)
    const rounds = file.rounds.map((r): PrRound =>
      r.task_id !== taskId
        ? r
        : { ...r, replies: r.replies.map((x) => (x.item === itemId ? { ...x, ...patch } : x)) },
    )
    await this.writePr(lane, { ...file, rounds })
    this.changed()
  }

  /**
   * PR 패널의 [실패한 체크 다시 실행] (D175, D203): 마지막으로 읽은 head에서 실패한 Actions 체크의 실행을 --failed로 다시
   * 돌린다. 실행 하나가 실패해도 나머지는 한다. 다시 실행한 것을 남기고 곧 PR을 다시 읽는다
   */
  rerunChecks(lane = ''): Promise<CommandResult> {
    const L = this.laneState(lane)
    return this.enqueue(async () => {
      const view = this.prPanel(lane)?.rerun
      if (!view) return { ok: false, error: '다시 실행할 실패한 Actions 체크가 없음' }
      if (!view.enabled) return { ok: false, error: view.reason ?? '다시 실행할 수 없음' }
      const pr = this.laneWork(lane).pr
      const location = pr ? prLocation(pr.url) : null
      if (!location) return { ok: false, error: `PR 주소를 읽지 못함: ${pr?.url ?? ''}` }
      const done: number[] = []
      const errors: string[] = []
      for (const run of view.runs) {
        const r = await ghRerunFailed(this.ctx.ghBin, {
          repo: repoArg(location),
          run,
          cwd: this.laneRepo(lane),
          env: this.ctx.env,
        })
        if (r.ok) done.push(run)
        else errors.push(`실행 ${run}: ${r.error}`)
      }
      if (done.length) {
        const checks = (L.read?.checks ?? [])
          .filter((c) => c.bucket === 'fail' && c.run !== null && done.includes(c.run))
          .map((c) => c.label)
        await this.feed({
          type: 'pr.checksRerun',
          at: this.ctx.at(),
          runs: done,
          checks,
          ...this.laneTag(lane),
        })
      }
      setTimeout(() => void this.readPrNow(lane), 0)
      return errors.length
        ? { ok: false, error: `다시 실행하지 못함: ${errors.join(' / ')}` }
        : { ok: true }
    })
  }

  // ---------- 터미널 ----------

  terminalKey(taskId: string): string {
    return `${this.key}/${taskId}`
  }

  /**
   * task 터미널의 보관. 이 앱에서 돌지 않은 task는 pty.log로 채운 읽기 전용 보관이다. 충돌로 끝이 잘렸으면
   * 경고 없이 남은 만큼 보인다 (시나리오 9-5)
   */
  private async terminalBuffer(task: TaskRecord): Promise<TerminalBuffer> {
    let buffer = this.terminals.get(task.id)
    if (!buffer) {
      const log = await this.files.readPtyLog(task)
      buffer = TerminalBuffer.fromLog(log ?? '')
      this.terminals.set(task.id, buffer)
    }
    return buffer
  }

  /** 탭이 붙을 때 지금까지의 출력. 끝난 task는 pty.log를 읽어 읽기 전용으로 보인다 */
  async attach(taskId: string): Promise<TerminalBacklog> {
    if (this.auxOf(taskId)) {
      return this.terminals.get(taskId)?.backlog() ?? noBacklog()
    }
    const task = this.task(taskId)
    if (!task) return noBacklog()
    return (await this.terminalBuffer(task)).backlog()
  }

  /** 터미널 id의 보조 세션 (정리 세션, 곁 세션). 새 종류는 여기에만 더한다 */
  private auxOf(terminalId: string): CleanupSession | SideSession | undefined {
    return [this.cleanup, this.side].find((s) => s?.id === terminalId) ?? undefined
  }

  /** 입력을 받는 PTY: task의 살아 있는 세션이나 보조 세션 */
  private ptyOf(taskId: string): PtySession | undefined {
    const aux = this.auxOf(taskId)
    if (aux) return aux.status === 'live' ? (aux.pty ?? undefined) : undefined
    return this.live.get(taskId)?.pty
  }

  write(taskId: string, data: string): void {
    this.ptyOf(taskId)?.write(data)
  }

  resize(taskId: string, cols: number, rows: number): void {
    const pty = this.ptyOf(taskId)
    if (!pty) return
    pty.resize(cols, rows)
    this.terminals.get(taskId)?.resized({ cols, rows })
  }

  /** 터미널의 폴더. task와 보조 세션 모두 worktree에서 돈다. 정리한 Work는 worktree가 없어 메인 체크아웃이다 */
  cwd(): string {
    return this.work.status === 'archived' ? this.project.repo_path : this.worktree
  }

  /** [파일] 탭이 보는 폴더 (D464). 정리한 Work는 worktree가 없어 null이다 */
  filesRoot(): string | null {
    return this.work.status === 'archived' ? null : this.worktree
  }

  /**
   * [파일] 탭 트리의 바뀐 파일 (D490): 기준 커밋과 지금 작업 트리의 차이(커밋한 것과 커밋 안 한 것 모두)와 추적하지 않는
   * 파일. 묶음 Work는 고른 서브모듈도 그 기준 커밋과 견주어 서브모듈 자리 아래에 붙인다(D471)
   */
  async filesChanges(): Promise<FileChangesResult> {
    const root = this.filesRoot()
    if (!root) return { ok: false, error: 'worktree가 없습니다 (정리한 Work)' }
    const opts = { env: this.ctx.env }
    const lanes = [
      { prefix: '', dir: root, base: this.work.base_commit },
      ...workRepos(this.work).map((r) => ({
        prefix: r.path,
        dir: this.repoTree(r.path),
        base: r.base_commit,
      })),
    ]
    // 서브모듈 하나를 읽지 못해도(체크아웃 안 됨, 기준 커밋이 없음) 나머지는 보인다. 메인을 읽지 못하면 실패다
    let error: string | null = null
    const read = await Promise.all(
      lanes.map(async (l, i) => {
        try {
          const [diff, untracked] = await Promise.all([
            changedPaths(l.dir, l.base, opts),
            untrackedPaths(l.dir, opts),
          ])
          return { prefix: l.prefix, diff, untracked }
        } catch (e) {
          if (i === 0) error = e instanceof Error ? e.message : String(e)
          return null
        }
      }),
    )
    if (error !== null) return { ok: false, error }
    return { ok: true, changes: treeChanges(read.filter((l) => l !== null)) }
  }

  // ---------- 이슈 기록 (설계 3.7, D336~D349, I98~I100) ----------

  /**
   * 대기열을 앞부터 게시한다 (I98). 이미 도는 줄이 있으면 그 줄이 끝난 뒤 한 번 더 돈다. 기다리지 않는다: 게시는 Work의
   * 처리 줄 밖에서 하고 결과만 줄로 넣는다(D344)
   */
  publishIssueSoon(): void {
    if (this.closing || !this.work.issue?.pending.length) return
    if (this.issueRunning) {
      this.issueAgain = true
      return
    }
    this.issueRunning = this.publishIssue()
      .catch((e: unknown) => this.problem(`이슈 게시 실패: ${message(e)}`))
      .finally(() => {
        this.issueRunning = null
        this.changed()
        if (this.issueAgain) {
          this.issueAgain = false
          this.publishIssueSoon()
        }
      })
    this.changed()
  }

  /** 패널의 [다시 시도] (D344): 대기열의 앞부터 다시 게시한다 */
  retryIssue(): Promise<CommandResult> {
    if (!this.work.issue?.pending.length)
      return Promise.resolve({ ok: false, error: '게시할 것이 없음' })
    this.publishIssueSoon()
    return Promise.resolve({ ok: true })
  }

  /** 하던 게시가 끝나기를 기다린다. 시험 도구가 임시 폴더를 지우기 전에 부른다 (prIdle과 같음) */
  async issueIdle(): Promise<void> {
    while (this.issueRunning) await this.issueRunning
  }

  /**
   * 앞부터 하나씩 게시한다. 실패하면 issue.failed를 넣고 멈춘다: 다음 할 일이나 [다시 시도]가 앞부터 다시 한다 (D344). gh에
   * 줄 레포(origin)는 한 번 도는 동안 한 번만 읽는다
   */
  private async publishIssue(): Promise<void> {
    let gh: GhRepoOptions | null = null
    for (;;) {
      const entry = this.work.issue?.pending[0]
      if (this.closing || !entry) return
      const key = issueKey(entry)
      try {
        gh ??= await this.issueRepo()
        await this.publishEntry(entry, key, gh)
      } catch (err) {
        const error = message(err)
        console.error(`[${this.key}] 이슈 게시 실패 (${key}): ${error}`)
        await this.enqueue(() => this.feed({ type: 'issue.failed', at: this.ctx.at(), key, error }))
        return
      }
      // 결과가 대기열 맨 앞을 빼지 않았으면(늦은 결과 등) 같은 것을 다시 게시하지 않게 멈춘다
      if (this.work.issue?.pending[0] === entry) return
    }
  }

  /** 이슈를 둘 레포: PR 만들기와 같은 origin의 --repo (I99) */
  private async issueRepo(): Promise<GhRepoOptions> {
    const repo = this.project.repo_path
    const origin = await remoteUrl(repo, 'origin', { env: this.ctx.env })
    if (!origin) throw new Error('origin 원격이 없음')
    return { repo: ghRepo(origin), cwd: repo, env: this.ctx.env }
  }

  /**
   * 항목 하나를 게시한다 (I99). 시도한 적이 있으면 결과를 모를 수 있어 먼저 원격에서 표시를 찾는다 (D349). 시도한 때를
   * 적은 뒤 게시하고, 결과를 줄로 넣는다
   */
  private async publishEntry(entry: IssueEntry, key: string, gh: GhRepoOptions): Promise<void> {
    const issue = this.work.issue
    if (!issue) return
    const bin = this.ctx.ghBin
    const marker = issueMarker(issue.mark, key)
    const tried = issue.attempted_at !== undefined
    const feed = (event: MachineEvent) => this.enqueue(() => this.feed(event))
    const attempt = () => feed({ type: 'issue.attempted', at: this.ctx.at(), key })
    if (entry.kind === 'issue') {
      if (tried) {
        const found = findMarked(await ghIssueList(bin, gh), marker)
        const number = found ? issueNumberOf(found.url) : null
        if (found && number !== null) {
          await feed({
            type: 'issue.created',
            at: this.ctx.at(),
            number,
            url: found.url,
            labeled: found.labels.includes(ISSUE_LABEL),
            found: true,
          })
          return
        }
      }
      const intent = await this.intentText(entry.intent_version)
      const title = issueTitle(intent, this.work.work_id)
      const body = issueBody({
        workId: this.work.work_id,
        mark: issue.mark,
        type: workType(this.work),
        typeName: workTypeLabel(this.work),
        intent,
      })
      // 라벨이 없으면 만든다 (D348). 만들지 못하면(권한) 라벨 없이 만든다 (D349)
      const labeled =
        (await ghLabelExists(bin, { ...gh, name: ISSUE_LABEL })) ||
        (await ghLabelCreate(bin, {
          ...gh,
          name: ISSUE_LABEL,
          color: ISSUE_LABEL_COLOR,
          description: ISSUE_LABEL_DESCRIPTION,
        }))
      await attempt()
      const url = await ghIssueCreate(bin, {
        ...gh,
        title,
        body,
        label: labeled ? ISSUE_LABEL : null,
      })
      const number = issueNumberOf(url)
      if (number === null) throw new Error(`이슈 주소에서 번호를 읽지 못함: ${url}`)
      await feed({ type: 'issue.created', at: this.ctx.at(), number, url, labeled })
      return
    }
    if (issue.number === null) throw new Error('이슈를 아직 만들지 못함')
    const target = { ...gh, number: issue.number }
    if (entry.kind === 'close') {
      await attempt()
      await ghIssueClose(bin, { ...target, reason: entry.reason })
      await feed({ type: 'issue.closed', at: this.ctx.at() })
      return
    }
    if (tried) {
      const found = findMarked(await ghIssueComments(bin, target), marker)
      if (found) {
        await feed({
          type: 'issue.posted',
          at: this.ctx.at(),
          key,
          commentId: commentIdOf(found.url),
          url: found.url,
          found: true,
        })
        return
      }
    }
    const body = await this.issueComment(entry, issue.mark)
    await attempt()
    const url = await ghIssueComment(bin, { ...target, body })
    await feed({ type: 'issue.posted', at: this.ctx.at(), key, commentId: commentIdOf(url), url })
  }

  /** 승인한 intent의 한 버전 (D339). 읽지 못하면 다른 버전으로 대신하지 않고 실패한다 */
  private async intentText(version: number): Promise<string> {
    const text = await this.files.readIntentVersion(version, this.work.intent?.version ?? null)
    if (text === null) throw new Error(`intent v${version}을 읽지 못함`)
    return text
  }

  /** 코멘트의 글 (D339, D341, D347). task의 파일은 게시할 때 읽는다 (D349) */
  private async issueComment(
    entry: Extract<IssueEntry, { kind: 'task' | 'step' | 'end' }>,
    mark: string,
  ): Promise<string> {
    if (entry.kind === 'end') return endComment(mark, entry.text)
    const task = this.task(entry.task_id)
    if (!task) throw new Error(`${entry.task_id} 없음`)
    if (entry.kind === 'step') {
      const discarded = (task.selection?.discarded ?? []).map((id) => {
        const t = this.task(id)
        return t ? `${t.id} ${nodeTitle(t)}` : id
      })
      return stepComment({ mark, task, discarded })
    }
    const order: readonly string[] = taskArtifacts(task)
    const rank = (n: string) => (order.includes(n) ? order.indexOf(n) : order.length)
    const artifacts: IssueArtifact[] = (await this.files.artifactTexts(task)).sort(
      (a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name),
    )
    const handoff = await readText(path.join(this.files.taskDir(task), 'handoff.md'))
    const version = entry.intent_version
    const issue = this.work.issue
    const intent =
      task.node === 'intake' && version !== undefined && issue && commentShowsIntent(issue, version)
        ? { version, text: await this.intentText(version) }
        : null
    return taskComment({ mark, task, handoff, artifacts, intent })
  }

  /** 패널의 이슈 줄 (설계 3.7, D344) */
  private issueView(): IssueView | null {
    const issue = this.work.issue
    if (!issue) return null
    return {
      number: issue.number,
      url: issue.url,
      linked: issue.linked,
      pending: issue.pending.length,
      publishing: this.issueRunning !== null,
      failure: issue.failure ? { at: issue.failure.at, error: issue.failure.error } : null,
      closed: issue.closed !== undefined,
    }
  }

  // ---------- 스냅샷 (I14) ----------

  private changed(): void {
    if (this.removed) return
    this.revision++
    this.ctx.ui.work(this.view())
  }

  private problem(text: string): void {
    console.error(`[${this.key}] ${text}`)
    this.problems.push(`${this.ctx.at()} ${text}`)
    if (this.problems.length > 20) this.problems.shift()
    this.changed()
  }

  view(): WorkView {
    const w = this.work
    return {
      key: this.key,
      projectId: this.project.project_id,
      projectName: projectName(this.project),
      workId: w.work_id,
      type: workType(w),
      customType: w.custom_type
        ? {
            id: w.custom_type.id,
            name: w.custom_type.name,
            source: w.custom_type.source,
            steps: w.custom_type.steps.map((s) => ({
              id: s.id,
              title: s.title,
              autoApprove: s.auto_approve,
            })),
          }
        : null,
      title: this.title,
      status: w.status,
      statusLabel: WORK_STATUS_LABEL[w.status],
      completedAt: w.completed_at ?? null,
      shelved: w.shelved_at !== undefined,
      canShelve: canShelve(w),
      canDelete: canDelete(w),
      badge: badge(w, this.cardBadge()),
      actions: this.cleanupOpen() ? cleanupActions(actions(w)) : actions(w),
      stopAfterStep: w.stop_after_step === true,
      settings: w.settings,
      baseBranch: w.base_branch,
      baseCommit: w.base_commit,
      branch: workBranch(w),
      targetBranch: targetBranch(w),
      canSetTarget: (w.status === 'active' || w.status === 'stopped') && !w.operation,
      integration:
        w.integration && this.integrationRoot
          ? {
              baseBranch: w.integration.base_branch,
              baseCommit: w.integration.base_commit,
              root: this.integrationRoot,
            }
          : null,
      repos: workRepos(w).map((r) => ({
        path: r.path,
        baseBranch: r.base_branch,
        baseCommit: r.base_commit,
        targetBranch: repoTarget(r),
        worktree: this.repoTree(r.path),
        delivery: deliveryView(r.delivery),
      })),
      mainFixed: !mainEditable(w),
      // 서브모듈이 있는 메인 레포의 Work만 (D473). 화면을 그릴 때마다 묻는 것이라 .gitmodules만 본다
      canAddRepo:
        !this.project.parent &&
        w.integration === undefined &&
        (w.status === 'active' || w.status === 'stopped') &&
        !w.operation &&
        existsSync(path.join(this.worktree, '.gitmodules')),
      intent: w.intent,
      stopNotice: stopNotice(w),
      stopHint: resumeHint(w),
      delivery: deliveryView(w.delivery),
      pr: this.prPanel(''),
      prs: workRepos(w).flatMap((r) => {
        const view = r.pr ? this.prPanel(r.path) : null
        return view ? [view] : []
      }),
      cleanup: this.cleanupView(),
      side: this.sideView(),
      drafts: this.drafts.list,
      operation: operationView(w),
      issue: this.issueView(),
      notices: this.noticeViews(),
      tasks: w.tasks.map((t) => this.taskView(t)),
      current: currentTask(w)?.id ?? null,
      problems: [...this.problems],
      revision: this.revision,
    }
  }

  /** 패널 맨 위의 알림 (D121): 끝낸 고아 프로세스, 바뀐 앱 소유 파일, 바뀐 work.json */
  private noticeViews(): NoticeView[] {
    const out: NoticeView[] = []
    if (this.orphans.length) out.push({ id: 'orphans', ...orphanNotice(this.orphans) })
    if (this.fileChanges.size) {
      const lines = [...this.fileChanges.values()].map((c) => c.line)
      out.push({ id: 'files', ...filesNotice(lines) })
    }
    if (this.workJsonChanges.length) {
      out.push({ id: 'work_json', ...workJsonNotice(this.workJsonChanges) })
    }
    return out
  }

  private cleanupView(): CleanupView | null {
    const c = this.cleanup
    if (!c) return null
    return {
      engineLabel: agentLabel(c),
      ...(c.engine === 'codex' && !c.hooksReady && c.status === 'live'
        ? { notice: 'Codex 터미널의 폴더 신뢰 확인 후 /hooks로 relay 훅을 검토·신뢰하세요.' }
        : {}),
      ...(c.question ? { question: c.question.view } : {}),
      terminal: this.terminalKey(c.id),
      status: c.status,
      choice: c.choice,
      clean: c.clean,
      uncommitted: [...c.uncommitted],
    }
  }

  private taskView(t: TaskRecord): TaskView {
    return {
      ...(this.live.get(t.id)?.question ? { question: this.live.get(t.id)?.question?.view } : {}),
      engineLabel: agentLabel(t),
      engineVersion: taskEngineVersion(t) ?? null,
      id: t.id,
      terminal: this.terminalKey(t.id),
      node: t.node,
      label: taskLabel(t),
      band: bandText(t),
      notice:
        knownTaskEngine(t) === null
          ? `${agentLabel(t)}. 이 세션은 재개할 수 없습니다.`
          : t.engine === 'codex' && this.live.has(t.id) && !this.live.get(t.id)?.hooksReady
            ? 'Codex 터미널의 폴더 신뢰 확인 후 /hooks로 relay 훅을 검토·신뢰하세요.'
            : permissionNotice(t),
      status: t.status,
      statusLabel: TASK_STATUS_LABEL[t.status],
      live: this.live.has(t.id),
      resumed: t.session?.resumed_at !== undefined,
      appEnded: t.session?.app_ended !== undefined,
      hasSession: !!t.session,
      sessionUnknown: sessionUnknown(t),
      error: t.error ?? null,
      errorCount: t.check?.errors.length ?? 0,
      bounces: t.bounce_count,
      bounceNotice: bounceNotice(t, this.ctx.config().format_error_bounce_max),
      countdown: t.countdown
        ? { seconds: t.countdown.seconds, endsAt: this.countdownEnds(t) }
        : null,
      activity: this.activityOf(t),
      review: reviewState(t),
    }
  }

  /**
   * 진행 표시 (D216). 작업 중인 task와 독립 리뷰 중인 task(D502)만 보인다. 첫 턴 전(세션을 띄우는 중)은 자리를 잡아 띄우기 시작한 때부터 센다:
   * 앱이 스킬과 context.md를 준비하는 시간도 사람에게는 기다리는 시간이다. 대기열에서 기다린 시간은 넣지 않는다
   */
  private activityOf(t: TaskRecord): ActivityView | null {
    // 독립 리뷰 중은 지금 호출의 진행이다 (D502): 출력 이벤트로 알고 세션의 훅은 없다
    const review = t.status === 'reviewing' ? this.reviewProgress.get(t.id) : undefined
    if (review)
      return {
        turn: true,
        since: review.since,
        tool: review.tool
          ? {
              label: review.tool.label,
              startedAt: review.tool.startedAt,
              endedAt: review.tool.endedAt,
            }
          : null,
        phase: REVIEW_PHASE[review.call],
        recent: review.recent,
      }
    if (t.status !== 'working') return null
    const session = this.live.get(t.id)
    const turn = session?.turnStartedAt ?? null
    const tool = session?.tool ?? null
    return {
      turn: turn !== null,
      since: turn ?? this.launchedAt.get(t.id) ?? Date.parse(t.created_at),
      tool: tool ? { label: tool.label, startedAt: tool.startedAt, endedAt: tool.endedAt } : null,
    }
  }
}
