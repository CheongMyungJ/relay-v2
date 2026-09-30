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
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { claudeVersion, deploySkill, findClaude } from '../adapters/claude'
import {
  GhApiError,
  ghApiPost,
  ghCreatePr,
  ghMerge,
  ghMergeSettings,
  ghOpenPr,
  ghPrView,
  ghRerunFailed,
  ghVersion,
  type GhPrOptions,
} from '../adapters/gh'
import {
  changedPaths,
  commitAll,
  commitInfo,
  commitsWithParents,
  countCommits,
  createBackup,
  currentBranch,
  deleteBranches,
  deleteRemoteBranch,
  diffFrom,
  hasCommit,
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
  repoRoot,
  resetHard,
  stashAll,
  stashEntries,
  statusLines,
  treeOf,
  worktreeTree,
} from '../adapters/git'
import type { HookReply, HookRequest, HookServer } from '../adapters/hooks'
import { processStartTime, startPty, type PtySession } from '../adapters/pty'
import {
  pathKey,
  readText,
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
  cleanPreview,
  halfRemovedHint,
  planClean,
  type CleanFacts,
} from '../core/cleanup'
import {
  buildContext,
  discardedAttempts,
  previousInputs,
  type PreviousRound,
  type PreviousTask,
  type RespondInput,
  type SelectionInput,
} from '../core/context'
import {
  actions,
  currentTask,
  transition,
  type DeliveryFound,
  type Effect,
  type InterruptReason,
  type MachineEvent,
} from '../core/machine'
import {
  CLEANUP_BLOCKS,
  DELIVERY_LABEL,
  approvalStops,
  cleanupActions,
  closingButtons,
  compareUrl,
  deliveryButtons,
  deliveryStart,
  deliveryView,
  ghRepo,
  prText,
  sameChanges,
  stoppedVerify,
} from '../core/delivery'
import { NODE_INFO, RESPOND } from '../core/pipeline'
import {
  CHECK_WAIT_MS,
  allowedMethods,
  applyItemAction,
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
  workBranch,
} from '../core/records'
import {
  OPERATION_BLOCKS,
  OWNED_FILES,
  backupHead,
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
  rewindResumePlan,
  workJsonNotice,
  type ActualHashes,
  type MadeBackup,
  type RecordedProcess,
  type RewindResumePlan,
  type WorkJsonChange,
} from '../core/recovery'
import {
  TASK_STATUS_LABEL,
  WORK_STATUS_LABEL,
  bandText,
  changeRange,
  emphasis,
  handoffSummary,
  humanNotice,
  permissionNotice,
  resumeHint,
  stopNotice,
  taskLabel,
  toolLabel,
  verdicts,
} from '../core/review'
import {
  GONE_SKIP,
  PR_CLOSED,
  RESPOND_STAGE_LABEL,
  autoPausedNotice,
  autoPlan,
  autoStartNotice,
  autoStartOn,
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
import { backupPattern, nextBackupBranch, planStep, stepChoices, stepPreview } from '../core/rewind'
import {
  cleanupArgs,
  continuePrompt,
  launchArgs,
  launchEnv,
  resumeArgs,
  taskSettings,
} from '../core/settings'
import {
  HANDOFF_FILE,
  INTENT_DRAFT_FILE,
  PR_FILE,
  REPLIES_FILE,
  RESPONSE_FILE,
  checkTask,
  sectionText,
  type TaskCheck,
} from '../core/validate'
import type { AppConfig, WorkSettingsPatch } from '../shared/config'
import type { NodeName, Size } from '../shared/contracts'
import {
  EMPTY_PR_ITEMS,
  type PrItem,
  type PrItemsFile,
  type PrReply,
  type PrRound,
  type PrSynced,
} from '../shared/pr'
import type { ProjectChecks, ProjectState } from '../shared/project'
import type {
  ActivityView,
  ApproveOptions,
  BadgeKind,
  CleanInput,
  CleanPreviewResult,
  CleanupView,
  CommandResult,
  Completion,
  DeliverInput,
  DeliverResult,
  MergeInfoResult,
  MergeInput,
  NoticeView,
  PrItemAction,
  PrView,
  RespondReview,
  RespondStartInput,
  ReviewView,
  SelectStepInput,
  StepPreviewResult,
  TaskView,
  TerminalBacklog,
  ToolActivityView,
  WorkView,
} from '../shared/views'
import type {
  DeliverOperation,
  DeliveryChoice,
  MergeMethod,
  OwnedFile,
  RespondOperation,
  RewindOperation,
  TaskRecord,
  UncommittedAction,
  WorkState,
} from '../shared/work'
import type { SessionPool } from './pool'
import type { UiPort } from './ports'
import { listPrComments, readPr, receivedCommits, fetchTip, type PrFetched } from './pr'
import { CLAUDE_INSTALL_GUIDE } from './projects'
import { TerminalBuffer } from './terminals'

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
  /** origin·gh를 다시 점검해 project.json을 고친다. verify를 시작할 때와 [다시 점검]에서 부른다 (D118) */
  recheck(projectId: string): Promise<void>
  /** 지금 시각. 현지 시각과 오프셋을 담은 ISO 8601 */
  at(): string
  /** 새 PTY의 크기. 탭이 크기를 알리면 그 크기를 쓴다 */
  size(): { cols: number; rows: number }
}

interface LiveSession {
  pty: PtySession
  log: PtyLog
  unregister: () => void
  unwatch: () => void
  /** PTY가 끝나면 풀린다 */
  exited: Promise<void>
  /** 직전 UserPromptSubmit이나 Stop 때의 handoff.md(intake는 intent 초안도) (D21, D107) */
  turnFiles: string
  stopped: boolean
  /** 띄운 때 (Date.now()). 첫 출력과 첫 훅까지 걸린 시간을 잰다 (D217) */
  spawnedAt: number
  /** 첫 PTY 출력과 첫 훅을 이미 알렸다 (D217) */
  sawOutput: boolean
  sawHook: boolean
  /** 진행 표시 (D216): 이번 턴이 시작한 때(UserPromptSubmit)와 마지막 도구. 기록하지 않고 살아 있는 동안만 둔다 */
  turnStartedAt: number | null
  tool: (ToolActivityView & { id?: string; name: string }) | null
}

/**
 * 정리 세션: [AI 세션 열기]로 연, 기록하지 않는 일반 터미널의 Claude Code (시나리오 7-5).
 * task가 아니라 events.jsonl, pty.log에 남기지 않는다. 앱을 다시 켜면 없다. 살아 있는 동안만 프로세스 ID와
 * 시작 시각을 work.json에 두어 앱이 충돌한 뒤 살아남으면 재시작 때 끝낸다 (D126).
 */
interface CleanupSession {
  /** 터미널 id: cleanup-<n>. 다시 열면 새 터미널이다 */
  id: string
  choice: DeliveryChoice
  status: CleanupView['status']
  /** 마지막 Stop 때 git status가 깨끗했다 */
  clean: boolean
  /** 세션이 끝난 뒤 남은 커밋 안 된 변경 */
  uncommitted: string[]
  pty: PtySession | null
  exited: Promise<void> | null
  unregister: () => void
  /** 설정 파일을 둔 임시 폴더 */
  dir: string | null
  /** 끝난 세션을 앱이 이미 처리했다. 늦게 온 PTY 종료는 무시한다 */
  handled: boolean
}

/** 정리 세션의 훅 URL(/hook/cleanup/<Event>)의 id. 터미널 id는 cleanup-<n>이다 */
const CLEANUP_ID = 'cleanup'
const CONTEXT_FILE = 'context.md'
const SETTINGS_FILE = 'task.settings.json'
const MAX_DIFF_CHARS = 2_000_000
const KILL_WAIT_MS = 10_000

/** 다시 연 세션의 출력 앞에 넣는 줄. 이전 화면 뒤에 이어 보인다 (시나리오 3-4) */
const RESUME_MARK = '\r\n\x1b[0m\x1b[2m── relay: 세션 재개 (--resume) ──\x1b[0m\r\n'

/** 새 세션의 출력 앞에 넣는 줄. CLI가 첫 화면을 그리기 전의 빈 화면을 채운다 (시나리오 2-5, D215) */
const startMark = (task: TaskRecord) =>
  `\x1b[0m\x1b[2m── relay: ${taskLabel(task)} · 새 세션을 띄우는 중 ──\x1b[0m\r\n`

/** 앱이 꺼지며 끝난 세션의 pty.log 끝에 넣는 줄 (D219). 다시 그린 옛 화면이 어디서 끝났는지 보인다 */
const APP_END_MARK = '\r\n\x1b[0m\x1b[2m── relay: 앱이 꺼져 세션이 여기서 끝났습니다 ──\x1b[0m\r\n'

/** 질문 도구. 질문 대기 표시는 core가 한다 (D24, D35). 나머지 도구의 훅은 진행 표시만 바꾼다 (D216) */
const ASK_TOOL = 'AskUserQuestion'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const exists = (p: string) =>
  fsp.stat(p).then(
    () => true,
    () => false,
  )

function clip(text: string): string {
  return text.length > MAX_DIFF_CHARS
    ? `${text.slice(0, MAX_DIFF_CHARS)}\n… (잘림: 전체 ${text.length}자)`
    : text
}

/** handoffChanged를 정할 때 비교하는 파일 (D21): handoff.md, intake는 intent 초안도 */
function turnSnapshot(task: TaskRecord, files: Readonly<Record<string, string>>): string {
  const draft = task.node === 'intake' ? (files[INTENT_DRAFT_FILE] ?? null) : null
  return JSON.stringify([files[HANDOFF_FILE] ?? null, draft])
}

/** 한 번의 답글 게시에서 받아 둔 코멘트 목록 (인라인 코멘트, 대화 코멘트) */
type ReplyLists = Map<'inline' | 'convo', Promise<unknown[]>>

/** 요청의 첫 줄. 사이드바의 Work 제목이다 */
export function workTitle(request: string): string {
  const line = request.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const t = line.trim()
  return t.length > 80 ? `${t.slice(0, 80)}…` : t
}

export class WorkRunner {
  readonly key: string
  private queue: Promise<unknown> = Promise.resolve()
  private readonly live = new Map<string, LiveSession>()
  private readonly terminals = new Map<string, TerminalBuffer>()
  /**
   * 다시 열 세션에 이어서 하라는 첫 입력을 줄지 (D218). [재개]·[세션 재개]마다 core가 정한 것을 두고, 세션을 다시 열
   * 때 쓴다. 대기열에서 기다리는 동안에도 남는다
   */
  private readonly resumeContinue = new Map<string, boolean>()
  private readonly problems: string[] = []
  private revision = 0
  /** 이번 명령의 되감기가 git에서 실패한 이유. [단계 선택]의 결과로 돌려준다 */
  private rewindError: string | null = null
  /** 이번 명령의 전달이나 정리가 실패한 이유. 명령의 결과로 돌려준다 */
  private opError: string | null = null
  /** 정리 세션 ([AI 세션 열기], 7-5) */
  private cleanup: CleanupSession | null = null
  private cleanupSeq = 0
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
  /** pr-items.json의 내용 (D191). 처음 쓸 때 읽는다 */
  private prFile: PrItemsFile | null = null
  /** 마지막으로 읽은 PR (D159: 메모리에만 두고 앱을 켜면 다시 읽는다) */
  private prRead: PrReadState | null = null
  /** 마지막 읽기 때의 로컬 Work 브랜치 커밋 */
  private prLocal: string | null = null
  /** 마지막 읽기의 오류나 경고 */
  private prError: string | null = null
  /** 읽는 중인 읽기. 한 Work의 읽기는 한 번에 하나다 (I51) */
  private prReading: Promise<CommandResult> | null = null
  /** 주기 읽기의 타이머 (D158) */
  private prTimer: NodeJS.Timeout | null = null
  /** head를 처음 읽은 때 (D196). 메모리에만 두어 앱을 다시 켜면 다시 잰다 */
  private readonly headSeen = new Map<string, number>()
  /**
   * Actions 실행 id → 이벤트 (D201, I52). 실행의 이벤트는 바뀌지 않아 메모리에 두고 처음 보는 실행만 읽는다. 앱을 다시
   * 켜면 CI 실패 항목에 적힌 것부터 채운다
   */
  private readonly runEvents = new Map<number, string>()
  /** 앱을 끝낸다. 읽기를 더 걸지 않는다 */
  private closing = false
  /**
   * 자동 대응을 바란다 (D210): 읽기가 받은 새 항목이 있을 때 대응 자동 시작이 켜져 있었다. 시작하거나 상한에서 멈추거나
   * 넣을 새 항목이 없어지거나 자동 시작이 꺼지면 버린다. 도는 대응 task, 진행 중 작업, 닫힌 PR로 막히면 남겨 두고 풀리면
   * 시작한다. 메모리에만 둔다: 앱을 다시 켜면 쌓인 항목만으로는 시작하지 않는다 (D159)
   */
  private autoWanted = false
  /** 자동 대응을 판정하고 시작하는 중. 한 번에 하나다 */
  private autoRunning: Promise<void> | null = null
  /**
   * 앱을 켤 때의 읽기를 아직 반영하지 못했다 (D159). 켤 때의 읽기가 실패하거나 끊긴 작업 때문에 읽지 못하면, 반영에 성공한
   * 첫 읽기가 켤 때의 읽기다: 그 읽기까지는 알리지 않고 자동 대응을 바라지 않는다. 꺼져 있던 동안 쌓인 항목으로는 자동
   * 시작하지 않는다
   */
  private prStartRead = false

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
    private readonly title: string,
    private workText: string | null = null,
  ) {
    this.key = `${project.project_id}/${work.work_id}`
  }

  /** 이 앱에서 살아 있는 세션이 있다 (앱 종료 확인, 시나리오 3-6). 정리 세션도 센다 */
  hasLiveSession(): boolean {
    return this.live.size > 0 || this.cleanup?.status === 'live'
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
    const t = transition(this.work, event, this.ctx.config())
    const reply = await this.apply(t.work, t.effects, opts)
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
    if (work === this.work && effects.length === 0) return null
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
    this.autoRespondSoon()
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
            at: e.at,
            by: e.by,
            decisions: e.decisions,
          }),
        )
        await this.ownedWritten('decisions.md', written)
        return
      }
      case 'confirmIntent':
        await this.confirmIntent(e.taskId, e.version, e.size)
        return
      case 'startTask':
        await this.requestSession(e.taskId)
        return
      case 'resumeTask':
        this.resumeContinue.set(e.taskId, e.continue)
        await this.requestSession(e.taskId)
        return
      case 'dequeue':
        this.ctx.pool.remove(this.slotKey(e.taskId))
        return
      case 'rewindCode':
        await this.rewindCode(e)
        return
      case 'resumeRewind':
        await this.resumeRewind(e)
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
        await this.mergeCode(e)
        return
      case 'respond':
        await this.respondCode(e)
        return
    }
  }

  private task(taskId: string): TaskRecord | undefined {
    return this.work.tasks.find((t) => t.id === taskId)
  }

  private check(task: TaskRecord, files: Readonly<Record<string, string>>): TaskCheck {
    return checkTask({
      node: task.node,
      size: this.work.intent?.size,
      files,
      config: this.ctx.config(),
      formatVersion: task.format_version,
      // PR 대응 task는 이번 라운드의 코멘트 항목마다 replies.md의 절을 본다 (D190)
      ...(task.respond ? { replyItems: replyItemIds(task.respond.items) } : {}),
    })
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
      return this.check(task, await this.files.taskFiles(task))
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
      const startCommit = await headCommit(this.worktree, { env })
      const bin = findClaude({ env })
      if (!bin) throw new Error(CLAUDE_INSTALL_GUIDE)
      const skill = NODE_INFO[task.node].skill
      const deployed = await deploySkill({
        source: this.ctx.skills,
        workDir: this.files.dir,
        skill,
      })
      const version = await claudeVersion(bin, env)

      // verify의 마무리 안내 문구(D104)와 Work 완료 화면의 전달 버튼이 쓸 점검을 새로 한다 (D118)
      if (task.node === 'verify') await this.recheckProject()
      const settingsPath = await this.writeSettings(task)
      const contextPath = path.join(dir, CONTEXT_FILE)
      await writeFileAtomic(contextPath, await this.context(task, dir, this.approvedBefore(task)))

      const sessionId = randomUUID()
      const token = randomBytes(32).toString('hex')
      const args = launchArgs({
        sessionId,
        workDir: this.files.dir,
        settingsPath,
        skill,
        contextPath,
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
        skillHash: deployed.hash,
        claudeVersion: version,
      })
      return true
    } catch (err) {
      return this.launchFailed(task.id, err)
    }
  }

  /**
   * 끝난 세션을 같은 옵션과 --resume <세션 id>로 다시 연다 (시나리오 3-4, 3-5, 6절).
   * 설정 파일은 새로 쓴다(훅 서버의 포트와 토큰이 바뀔 수 있음, I13). 스킬과 context.md는 그대로 둔다.
   * 탭에는 이전 화면을 먼저 보이고 그 뒤에 다시 연 세션의 출력을 잇는다.
   */
  private async resumeSession(task: TaskRecord): Promise<boolean> {
    const { env } = this.ctx
    const sessionId = task.session?.id
    try {
      if (!sessionId) throw new Error('다시 열 세션이 없음')
      const bin = findClaude({ env })
      if (!bin) throw new Error(CLAUDE_INSTALL_GUIDE)
      const version = await claudeVersion(bin, env)
      const settingsPath = await this.writeSettings(task)
      const files = await this.files.taskFiles(task)
      // 이전 화면을 먼저 보인다. 이 앱에서 돌던 task면 버퍼가 남아 있고, 아니면 pty.log에서 읽는다
      await this.terminalBuffer(task)
      const token = randomBytes(32).toString('hex')
      // 중단됨의 [재개]는 이어서 하라고 알린다 (D218)
      const prompt = this.resumeContinue.get(task.id)
        ? continuePrompt(task.session?.app_ended !== undefined)
        : undefined
      this.resumeContinue.delete(task.id)
      const args = resumeArgs({
        sessionId,
        workDir: this.files.dir,
        settingsPath,
        ...(prompt ? { prompt } : {}),
      })
      const session = this.launch(task, bin, token, args, turnSnapshot(task, files), RESUME_MARK)
      const processStartedAt = await processStartTime(session.pty.pid)
      await this.feed({
        type: 'session.resumed',
        taskId: task.id,
        at: this.ctx.at(),
        pid: session.pty.pid,
        ...(processStartedAt ? { processStartedAt } : {}),
        claudeVersion: version,
        check: this.check(task, files),
      })
      return true
    } catch (err) {
      return this.launchFailed(task.id, err)
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
      taskSettings({
        port: this.ctx.hooks.port,
        taskId: task.id,
        workDir: this.files.dir,
        previousTaskDirs: earlier.map((t) => this.files.taskDir(t)),
      }),
    )
    return settingsPath
  }

  /** task의 handoff.md. 없으면 undefined */
  private async handoffOf(task: TaskRecord): Promise<string | undefined> {
    return (await readText(path.join(this.files.taskDir(task), HANDOFF_FILE))) ?? undefined
  }

  /**
   * context.md의 내용 (시나리오 2-4). 폐기된 task는 입력에서 빠진다: 결정 로그의 항목(5.4)과,
   * 승인됨이 아니라 기각 목록, 직전 handoff, 산출물에서도 빠진다. 단계 선택으로 들어온 task는
   * 사람 추가 지시와 폐기된 시도 요약을 맨 위에 넣는다 (6.2).
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
        ...(handoff === undefined ? {} : { handoff }),
        artifacts: await this.files.artifacts(t),
      })
    }
    const discarded = this.work.tasks.filter((t) => t.status === 'discarded').map((t) => t.id)
    // 읽은 앱 소유 파일을 적힌 해시와 비교한다. 다르면 알리고 그 내용을 쓴다 (D124)
    const request = await this.files.readOwned('request.md')
    const intent = await this.files.readOwned('intent.md')
    const decisions = await this.files.readOwned('decisions.md')
    this.compareOwned({
      'request.md': request?.hash ?? null,
      'intent.md': intent?.hash ?? null,
      'decisions.md': decisions?.hash ?? null,
    })
    return buildContext({
      work: this.work,
      task,
      config: this.ctx.config(),
      taskDir: dir,
      request: { path: this.files.request, text: request?.text ?? '' },
      intent: intent?.text ?? null,
      decisionLog: decisionsWithout(decisions?.text ?? '', discarded),
      ...previousInputs(earlier),
      selection: await this.selectionInput(task),
      ...(task.node === 'verify' ? { delivery: closingButtons(this.checks()) } : {}),
      respond: await this.respondInput(task),
    })
  }

  /**
   * PR 대응 task의 입력 (D192, 시나리오 10-4): 이번 라운드의 항목, 사람 지시, PR 정보와 앱이 fetch한 원격 브랜치의 커밋,
   * 앞 대응 라운드의 handoff 요약. 대응 task가 아니면 null
   */
  private async respondInput(task: TaskRecord): Promise<RespondInput | null> {
    const r = task.respond
    const pr = this.work.pr
    if (task.node !== RESPOND || !r || !pr) return null
    const file = await this.prItems()
    const items = r.items
      .map((id) => file.items.find((i) => i.id === id))
      .filter((i): i is PrItem => i !== undefined)
    const previous: PreviousRound[] = []
    for (const t of respondTasks(this.work)) {
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
    const repo = this.project.repo_path
    const branch = workBranch(this.work.work_id)
    return {
      round: r.round,
      ...(task.reason === 'auto_respond' ? { auto: true } : {}),
      instruction: r.instruction,
      pr: { number: pr.number, url: pr.url, head: pr.head },
      branch,
      remote: {
        base: await refCommit(repo, `refs/remotes/origin/${this.work.base_branch}`, opts),
        branch: await refCommit(repo, `refs/remotes/origin/${branch}`, opts),
      },
      items,
      previous,
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

  /** 단계 선택으로 들어온 task의 입력 (6.2): 사람 추가 지시와, 되감기면 폐기된 시도 요약 */
  private async selectionInput(task: TaskRecord): Promise<SelectionInput | null> {
    const sel = task.selection
    if (!sel) return null
    const reason = task.reason === 'rewind' || task.reason === 'skip' ? task.reason : 'default'
    const tasks = sel.discarded
      .map((id) => this.task(id))
      .filter((t): t is TaskRecord => t !== undefined)
    const attempts =
      reason === 'rewind'
        ? discardedAttempts(
            await Promise.all(
              tasks.map(async (t) => {
                const handoff = await this.handoffOf(t)
                return { taskId: t.id, node: t.node, ...(handoff === undefined ? {} : { handoff }) }
              }),
            ),
          )
        : []
    return {
      reason,
      from: { taskId: sel.from_task, node: this.task(sel.from_task)?.node ?? task.node },
      instruction: sel.instruction,
      discarded: attempts,
      dropped: reason === 'skip' ? tasks.map((t) => ({ taskId: t.id, node: t.node })) : [],
      skipped: sel.skipped,
      keepCode: sel.keep_code,
      reset: sel.reset !== null,
    }
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
      env: { ...this.ctx.env, ...launchEnv(token) },
      cols,
      rows,
      answerQueries: true,
    })
    // 출력 구독은 같은 틱에 건다. PTY를 띄우지 못하면 로그를 열지 않는다
    const log = this.files.openPtyLog(task)
    const buffer = this.terminals.get(task.id) ?? new TerminalBuffer()
    buffer.live = true
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
      if (!session.sawOutput) {
        session.sawOutput = true
        this.timing(task.id, session, 'output')
      }
    })
    pty.onExit(() => {
      exited()
      void this.enqueue(() => this.onExit(task.id, session))
    })
    session.unregister = this.ctx.hooks.register(token, task.id, (req) =>
      this.hookArrived(task.id, req, session),
    )
    session.unwatch = watchDir(this.files.taskDir(task), () => {
      void this.enqueue(() => this.onWatch(task.id))
    })
    this.live.set(task.id, session)
    return session
  }

  // ---------- 세션 동안 (시나리오 3) ----------

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

  /**
   * 훅을 받았다. 진행 표시(D216)를 먼저 바꾸고, 질문 도구가 아닌 도구의 훅은 줄에 넣지 않고 바로 답한다: 도구를 쓸
   * 때마다 오므로 앞선 처리(PR 읽기 등)를 기다리게 하면 에이전트가 늦어진다. core는 이 훅으로 상태를 바꾸지 않는다
   */
  private hookArrived(taskId: string, req: HookRequest, session: LiveSession): Promise<HookReply> {
    if (!session.sawHook) {
      session.sawHook = true
      this.timing(taskId, session, 'hook', req.event)
    }
    const b = req.body
    const now = Date.now()
    if (req.event === 'UserPromptSubmit') {
      session.turnStartedAt = now
      session.tool = null
    }
    if (req.event === 'PreToolUse' || req.event === 'PostToolUse') {
      const name = str(b['tool_name']) ?? ''
      const id = str(b['tool_use_id'])
      if (req.event === 'PreToolUse') {
        const label = toolLabel(name, b['tool_input'], str(b['cwd']))
        session.tool = { name, label, startedAt: now, endedAt: null, ...(id ? { id } : {}) }
      } else if (
        session.tool?.endedAt === null &&
        (id ? session.tool.id === id : session.tool.name === name)
      ) {
        session.tool = { ...session.tool, endedAt: now }
      }
      if (name !== ASK_TOOL) {
        if (this.live.get(taskId) === session) {
          const task = this.task(taskId)
          if (task)
            this.ctx.ui.activity({ workKey: this.key, taskId, activity: this.activityOf(task) })
        }
        return Promise.resolve(null)
      }
    }
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
    // 훅 본문의 세션 id. /clear 등으로 CLI가 다른 대화로 옮기면 core가 따른다 (D110)
    const sessionId = str(b['session_id'])
    const agentId = str(b['agent_id'])
    const base = {
      taskId,
      at: this.ctx.at(),
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(agentId === undefined ? {} : { agentId }),
    }
    switch (req.event) {
      case 'UserPromptSubmit': {
        if (session) session.turnFiles = turnSnapshot(task, await this.files.taskFiles(task))
        const mode = str(b['permission_mode'])
        return (
          await this.feed({
            type: 'UserPromptSubmit',
            ...base,
            ...(mode === undefined ? {} : { permissionMode: mode }),
          })
        ).reply
      }
      // 질문 도구만 온다. 나머지 도구는 hookArrived가 진행 표시만 바꾸고 답했다 (D216)
      case 'PreToolUse':
      case 'PostToolUse':
        return (await this.feed({ type: req.event, ...base, toolName: str(b['tool_name']) ?? '' }))
          .reply
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
        const files = await this.files.taskFiles(task)
        const snapshot = turnSnapshot(task, files)
        const changed = session !== undefined && snapshot !== session.turnFiles
        if (session) session.turnFiles = snapshot
        return (
          await this.feed({
            type: 'Stop',
            ...base,
            stopHookActive: b['stop_hook_active'] === true,
            handoffChanged: changed,
            check: this.check(task, files),
            // 백그라운드 작업이나 예약된 깨우기를 기다리며 쉬는 중이면 자동 승인하지 않는다 (D129)
            background: pendingBackground(b),
          })
        ).reply
      }
      case 'SessionEnd': {
        const reason = str(b['reason'])
        // Stop 없이 끝났어도 유효한 handoff가 있으면 승인 대기나 막힘이다 (3.3, D146)
        const check = await this.checkNow(taskId)
        return (
          await this.feed({
            type: 'SessionEnd',
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
    const check = this.check(task, await this.files.taskFiles(task))
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

  /** 세션의 프로세스 트리를 끝내고 pty.log를 닫는다 (시나리오 5-1, 7절) */
  private async endSession(taskId: string): Promise<void> {
    const session = this.live.get(taskId)
    if (!session) return
    await session.pty.killTree()
    await Promise.race([session.exited, sleep(KILL_WAIT_MS)])
    await this.release(taskId, session)
  }

  // ---------- 승인 (시나리오 4, 5) ----------

  /** intent 초안으로 intent.md를 확정한다 (4.1, 5.3) */
  private async confirmIntent(taskId: string, version: number, size: Size): Promise<void> {
    const task = this.task(taskId)
    if (!task) throw new Error(`${taskId} 없음`)
    const draft = await readText(path.join(this.files.taskDir(task), INTENT_DRAFT_FILE))
    if (draft === null) throw new Error('intent 초안이 없음')
    const written = await this.files.writeIntent(confirmedIntent(draft, { version, size }), version)
    await this.ownedWritten('intent.md', written)
  }

  /** [승인], [의도 승인], [완료만], [오류 무시하고 승인] (시나리오 4-3, 4.1) */
  approve(taskId: string, opts: ApproveOptions): Promise<CommandResult> {
    return this.enqueue(async () => {
      if (this.cleanupOpen()) return { ok: false, error: CLEANUP_BLOCKS }
      const task = this.task(taskId)
      if (!task) return { ok: false, error: `${taskId} 없음` }
      const check = this.check(task, await this.files.taskFiles(task))
      // PR 대응 task는 승인하면 push하고 답글을 게시한다. 실패하면 그 오류를 돌려준다 (시나리오 10-6)
      this.opError = null
      const r = await this.command({
        type: 'approve',
        taskId,
        at: this.ctx.at(),
        check,
        ...(opts.size ? { size: opts.size } : {}),
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
      if (this.prTimer) this.schedulePr()
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

  /** [이 단계 새 세션으로 다시] (D114) */
  retry(taskId: string): Promise<CommandResult> {
    return this.enqueue(() => this.unlessCleanup({ type: 'retry', taskId, at: this.ctx.at() }))
  }

  /** [이 단계 끝나면 멈춤]을 켜거나 끈다 */
  stopAfter(on: boolean): Promise<CommandResult> {
    return this.enqueue(() => this.command({ type: 'stopAfter', at: this.ctx.at(), on }))
  }

  /** 멈춘 Work의 [재개]: 기본 다음 단계를 시작한다 */
  resumeWork(): Promise<CommandResult> {
    return this.enqueue(() => this.unlessCleanup({ type: 'resumeWork', at: this.ctx.at() }))
  }

  /** [Work 포기]. 끝난 정리 세션이 남아 있으면 치운다. 열려 있으면 받지 않는다 (D137) */
  abandon(): Promise<CommandResult> {
    return this.enqueue(async () => {
      const r = await this.unlessCleanup({ type: 'abandon', at: this.ctx.at() })
      if (r.ok && this.cleanup) {
        await this.endCleanup()
        this.cleanup = null
        this.changed()
      }
      return r
    })
  }

  // ---------- 단계 선택 (6.2) ----------

  /** 이 Work의 백업 브랜치 (D115). 새 백업 브랜치의 번호를 정한다 */
  private backups(): Promise<string[]> {
    return refNames(this.worktree, backupPattern(this.work.work_id), { env: this.ctx.env })
  }

  /**
   * 단계 선택 대화상자의 미리 보기 (D82). core/rewind의 계산에 git과 파일에서 읽은 것을 더한다:
   * 되돌릴 커밋 수, 커밋 안 된 변경, 폐기될 산출물 파일.
   */
  async stepPreview(node: NodeName, keepCode: boolean): Promise<StepPreviewResult> {
    const { env } = this.ctx
    try {
      const r = planStep(this.work, node, { keepCode, backups: await this.backups() })
      if (!r.ok) return r
      const plan = r.plan
      const uncommitted = await statusLines(this.worktree, { env })
      const commits =
        plan.code.kind === 'reset'
          ? await countCommits(this.worktree, plan.code.to, 'HEAD', { env })
          : 0
      const artifacts: Record<string, string[]> = {}
      for (const t of plan.discard) {
        artifacts[t.id] = (await this.files.artifacts(t)).map((p) => path.basename(p))
      }
      return {
        ok: true,
        preview: stepPreview(this.work, plan, { commits, uncommitted, artifacts }),
      }
    } catch (e) {
      return { ok: false, error: `미리 보기를 만들지 못함: ${message(e)}` }
    }
  }

  /**
   * [단계 선택]의 [확인] (6.2). 진행 중인 task를 끝내고, 코드를 되돌리는 되감기면 백업하고 되돌린 뒤,
   * 폐기하고 고른 단계를 시작한다. 새 task도 세션 상한을 따른다 (D18). git이 실패하면 오류를 돌려준다.
   */
  selectStep(input: SelectStepInput): Promise<CommandResult> {
    return this.enqueue(async () => {
      if (this.cleanupOpen()) return { ok: false, error: CLEANUP_BLOCKS }
      this.rewindError = null
      let backups: string[]
      try {
        backups = await this.backups()
      } catch (e) {
        return { ok: false, error: `백업 브랜치를 읽지 못함: ${message(e)}` }
      }
      const r = await this.command({
        type: 'selectStep',
        at: this.ctx.at(),
        node: input.node,
        keepCode: input.keepCode,
        instruction: input.instruction,
        expect: input.expect,
        backups,
      })
      const failed = this.rewindError
      this.rewindError = null
      return r.ok && failed ? { ok: false, error: failed } : r
    })
  }

  /**
   * 되감기의 코드 (6.2, D115~D117). 되돌릴 커밋이나 커밋 안 된 변경이 있으면 먼저 백업 브랜치를 만들고
   * (커밋 안 된 변경은 커밋 하나로 담는다, D116), 되돌릴 커밋으로 worktree를 되돌린다. 단계가 끝날 때마다
   * machine에 알려 진행 중 작업 기록을 옮긴다(D77). git이 실패하면 알리고 기록을 지운다. 코드를 되돌리다 실패했는데
   * 코드가 이미 바뀌었으면 기록을 지우지 않고 끊긴 되감기로 남긴다 (D136).
   */
  private async rewindCode(e: Extract<Effect, { type: 'rewindCode' }>): Promise<void> {
    const opts = { env: this.ctx.env }
    let head: string
    let dirty: boolean
    let branch: string | null
    let commit: string | null = null
    try {
      const off = await this.offBranch()
      if (off) throw new Error(off)
      head = await headCommit(this.worktree, opts)
      dirty = (await statusLines(this.worktree, opts)).length > 0
      const commits = head === e.to ? 0 : await countCommits(this.worktree, e.to, 'HEAD', opts)
      branch = commits > 0 || dirty ? e.backupBranch : null
      if (branch) {
        commit = await createBackup(this.worktree, branch, {
          ...opts,
          uncommitted: dirty,
          message: e.message,
        })
      }
    } catch (err) {
      await this.rewindFailed(err)
      return
    }
    await this.feed({ type: 'rewind.backedUp', at: this.ctx.at(), branch, commit, head })
    if (head !== e.to || dirty) {
      const reset = await this.resetCode(e.to, dirty)
      if (reset) {
        await this.rewindFailed(reset.err, reset.cut)
        return
      }
    }
    await this.feed({ type: 'rewind.applied', at: this.ctx.at(), head })
  }

  /**
   * 코드를 되돌린다. 실패하면 오류와, 실패하기 전에 코드가 이미 바뀌었는지(cut)를 돌려준다 (D136).
   * reset은 됐는데 clean이 실패하거나 reset이 도중에 실패하면 HEAD나 작업 트리가 되돌리기 전과 다르다.
   * 바뀌었는지 확인하지 못하면 바뀐 것으로 본다
   */
  private async resetCode(
    to: string,
    dirty: boolean,
  ): Promise<{ err: unknown; cut: boolean } | null> {
    const opts = { env: this.ctx.env }
    let before: { head: string; tree: string } | null = null
    try {
      before = {
        head: await headCommit(this.worktree, opts),
        tree: await worktreeTree(this.worktree, opts),
      }
      await resetHard(this.worktree, to, { ...opts, clean: dirty })
      return null
    } catch (err) {
      if (!before) return { err, cut: false }
      try {
        const head = await headCommit(this.worktree, opts)
        const tree = await worktreeTree(this.worktree, opts)
        return { err, cut: head !== before.head || tree !== before.tree }
      } catch {
        return { err, cut: true }
      }
    }
  }

  /** worktree가 Work 브랜치에 있지 않으면 그 오류 (D138) */
  private async offBranch(): Promise<string | null> {
    const current = await currentBranch(this.worktree, { env: this.ctx.env })
    return offWorkBranch(this.work.work_id, current)
  }

  private async rewindFailed(err: unknown, cut = false): Promise<void> {
    this.rewindError = `되감기 실패: ${message(err)}`
    this.problem(this.rewindError)
    await this.feed({
      type: 'rewind.failed',
      at: this.ctx.at(),
      error: message(err),
      ...(cut ? { cut } : {}),
    })
  }

  /**
   * 끊긴 되감기를 끊긴 곳부터 잇는다 (D123). 이미 만든 백업과 지금 코드를 보고 core/recovery의 rewindResumePlan대로
   * 한다: 백업이 지금 코드(HEAD와 커밋 안 된 변경)와 다르면 다음 번호로 한 번 더 백업하고, 되돌릴 커밋이 아니면
   * 되돌린다. rewindCode처럼 단계가 끝날 때마다 machine에 알린다 (D77).
   */
  private async resumeRewind(e: Extract<Effect, { type: 'resumeRewind' }>): Promise<void> {
    const opts = { env: this.ctx.env }
    const op = e.operation
    let plan: RewindResumePlan
    let dirty: boolean
    let made: MadeBackup | null
    let extra: { branch: string; commit: string } | null = null
    // 끊긴 되감기는 코드를 이미 되돌렸을 수 있어 Work 브랜치가 아니면 끊긴 채로 둔다 (D138, D136)
    const off = await this.offBranch().catch((err: unknown) => message(err))
    if (off) {
      await this.rewindFailed(new Error(off), true)
      return
    }
    try {
      const head = await headCommit(this.worktree, opts)
      dirty = (await statusLines(this.worktree, opts)).length > 0
      made = await this.madeBackup(op)
      const tree = made ? await worktreeTree(this.worktree, opts) : null
      plan = rewindResumePlan(op, { head, dirty, tree, made })
      if (plan.backup) {
        const branch = nextBackupBranch(this.work.work_id, await this.backups())
        const commit = await createBackup(this.worktree, branch, {
          ...opts,
          uncommitted: dirty,
          message: e.message,
        })
        extra = { branch, commit }
      }
    } catch (err) {
      await this.rewindFailed(err)
      return
    }
    if (op.stage === 'backup') {
      const kept = plan.keep === 'made' ? made : plan.keep === 'new' ? extra : null
      await this.feed({
        type: 'rewind.backedUp',
        at: this.ctx.at(),
        branch: kept?.branch ?? null,
        commit: kept?.commit ?? null,
        head: plan.from,
      })
    }
    if (plan.reset) {
      const reset = await this.resetCode(op.reset_to, dirty)
      if (reset) {
        await this.rewindFailed(reset.err, reset.cut)
        return
      }
    }
    await this.feed({
      type: 'rewind.applied',
      at: this.ctx.at(),
      head: plan.from,
      ...(extra && plan.keep !== 'new' ? { extraBackup: extra.branch } : {}),
    })
  }

  /**
   * 끊긴 되감기가 이미 만든 백업 (core/recovery MadeBackup). reset 단계면 기록에 있고, backup 단계면 계획한 이름의
   * 브랜치가 git에 있을 때다(기록하기 전에 끊김). 없으면 null
   */
  private async madeBackup(op: RewindOperation): Promise<MadeBackup | null> {
    const opts = { env: this.ctx.env }
    const branch = op.backup_branch
    if (!branch) return null
    const commit =
      op.stage === 'reset'
        ? op.backup_commit
        : await refCommit(this.worktree, `refs/heads/${branch}`, opts)
    if (!commit) return null
    const info = await commitInfo(this.worktree, commit, opts)
    return {
      branch,
      commit,
      head: op.head ?? backupHead(this.work.work_id, info),
      tree: await treeOf(this.worktree, commit, opts),
    }
  }

  // ---------- 전달 (시나리오 7) ----------

  /** 지금 task가 verify면 그 형식 검사. 전달을 시작할 수 있는지 core/delivery가 판정한다 */
  private async verifyCheck(): Promise<TaskCheck | null> {
    const task = currentTask(this.work)
    if (task?.node !== 'verify') return null
    return this.check(task, await this.files.taskFiles(task))
  }

  /**
   * [push]·[PR 생성] (7-4~7-6, D119, D120). 커밋 안 된 변경이 있으면 사람이 고르게 변경 목록을 돌려준다
   * (7-5). 고른 처리는 사람에게 보인 목록과 지금 목록이 같을 때만 받는다. 전달이 실패하면 오류를 돌려주고,
   * 실패는 Work 완료 화면에도 남는다.
   */
  deliver(input: DeliverInput): Promise<DeliverResult> {
    return this.enqueue(() => this.deliverNow(input.choice, input.uncommitted))
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
        const stash = await stashAll(this.worktree, e.message ?? '', { env })
        await this.feed({ type: 'delivery.stage', at: this.ctx.at(), stage: 'push', stash })
      }
      if (e.uncommitted === 'commit') {
        const commit = await commitAll(this.worktree, e.message ?? '', { env })
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
          facts.prUrl = await ghCreatePr(this.ctx.ghBin, {
            ...gh,
            base: e.base,
            head: e.branch,
            title: pr.title,
            body: pr.body,
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
    const check = task ? this.check(task, await this.files.taskFiles(task)) : null
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

  // ---------- 정리 세션 ([AI 세션 열기], 7-5) ----------

  /**
   * [AI 세션 열기] (7-5): verify 세션을 끝내고, 기록하지 않는 일반 터미널로 Claude Code를 worktree에서 연다.
   * push와 PR은 계속 막혀 있다(deny 규칙). 세션 상한(D18)을 따라 자리가 없으면 대기열에서 기다린다.
   */
  openCleanup(choice: DeliveryChoice): Promise<CommandResult> {
    return this.enqueue(async () => {
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
      const bin = findClaude({ env })
      if (!bin) throw new Error(CLAUDE_INSTALL_GUIDE)
      c.dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'relay-cleanup-'))
      const settingsPath = path.join(c.dir, SETTINGS_FILE)
      await writeJson(
        settingsPath,
        taskSettings({
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
        args: cleanupArgs(settingsPath),
        cwd: this.worktree,
        env: { ...env, ...launchEnv(token) },
        cols,
        rows,
        answerQueries: true,
      })
      const buffer = this.terminals.get(c.id) ?? new TerminalBuffer()
      buffer.live = true
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
      // 도구 훅은 쓰지 않는다. 도구를 쓸 때마다 오므로 줄에 넣지 않고 바로 답한다 (D216)
      c.unregister = this.ctx.hooks.register(token, CLEANUP_ID, (req) =>
        req.event === 'PreToolUse' || req.event === 'PostToolUse'
          ? Promise.resolve(null)
          : this.enqueue(() => this.onCleanupHook(c, req)),
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

  /** 정리 세션의 훅: 턴이 끝날 때(Stop)마다 git status가 깨끗한지 본다. 새 요청이 오면 강조를 끈다 (7-5) */
  private async onCleanupHook(c: CleanupSession, req: HookRequest): Promise<HookReply> {
    if (this.cleanup !== c || c.status !== 'live') return null
    if (req.event === 'UserPromptSubmit' && c.clean) {
      c.clean = false
      this.changed()
    }
    if (req.event === 'Stop') {
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
    c.handled = true
    c.status = 'ended'
    c.unregister()
    const buffer = this.terminals.get(c.id)
    if (buffer) buffer.live = false
    if (c.dir) await fsp.rm(c.dir, { recursive: true, force: true }).catch(() => undefined)
    c.dir = null
    this.changed()
    await this.feed({ type: 'cleanup.ended', at: this.ctx.at() })
  }

  /** 살아 있거나 대기열에 있는 정리 세션을 끝낸다 */
  private async endCleanup(): Promise<void> {
    const c = this.cleanup
    if (!c || c.handled) return
    if (c.status === 'queued') {
      this.ctx.pool.remove(this.slotKey(c.id))
    } else if (c.pty) {
      await c.pty.killTree()
      await Promise.race([c.exited, sleep(KILL_WAIT_MS)])
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

  // ---------- 정리 (시나리오 8) ----------

  /** 정리 요약의 사실: git과 이 앱의 세션에서 읽는다 (8-1) */
  private async cleanFacts(): Promise<CleanFacts> {
    const opts = { env: this.ctx.env }
    const repo = this.project.repo_path
    const worktree = await fsp
      .stat(this.worktree)
      .then((st) => st.isDirectory())
      .catch(() => false)
    if (worktree && (await this.halfRemoved())) throw new Error(halfRemovedHint(this.worktree))
    const name = workBranch(this.work.work_id)
    const head = await refCommit(repo, `refs/heads/${name}`, opts)
    const contains = async (ref: string) => {
      const tip = await refCommit(repo, ref, opts)
      return !!head && !!tip && (await isAncestor(repo, head, tip, opts))
    }
    const base = this.work.base_branch
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
    return {
      worktree,
      uncommitted: worktree ? await statusLines(this.worktree, opts) : [],
      locks: worktree ? await lockFiles(this.worktree, opts) : [],
      live: this.live.size + (this.cleanup?.status === 'live' ? 1 : 0),
      branch: {
        name,
        exists: head !== null,
        pushed: await contains(`refs/remotes/origin/${name}`),
        merged:
          (await contains(`refs/heads/${base}`)) || (await contains(`refs/remotes/origin/${base}`)),
      },
      backups: await refNames(repo, backupPattern(this.work.work_id), opts),
      merged,
      remote,
    }
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
      const r = await this.command({
        type: 'clean',
        at: this.ctx.at(),
        force: plan.force,
        deleteBranches: plan.deleteBranches,
        ...(plan.deleteRemote ? { deleteRemote: plan.deleteRemote } : {}),
        head,
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
      if (e.resume === undefined) {
        if (await exists(this.worktree)) {
          await removeWorktree(repo, this.worktree, { ...opts, force: e.force })
        } else {
          await pruneWorktrees(repo, opts)
        }
      } else if (e.resume === 'worktree') {
        await this.removeCutWorktree(e.force)
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
      } catch (err) {
        await this.cleanFailed(err)
        return
      }
    }
    if (e.deleteRemote) {
      await this.feed({ type: 'clean.branchesDeleted', at: this.ctx.at() })
      try {
        if (await remoteBranchExists(repo, e.deleteRemote, 'origin', opts)) {
          await deleteRemoteBranch(repo, e.deleteRemote, 'origin', opts)
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
      await fsp.rm(this.worktree, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
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
      const task = currentTask(this.work)
      const check = task ? this.check(task, await this.files.taskFiles(task)) : null
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
        return this.deliverNow(op.choice, null)
      }
      this.rewindError = null
      this.opError = null
      const r = await this.command({ type: 'operationRetry', at: this.ctx.at() })
      const failed = this.rewindError ?? this.opError
      this.rewindError = null
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
    this.closing = true
    if (this.prTimer) clearTimeout(this.prTimer)
    this.prTimer = null
    return this.enqueue(async () => {
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
      await Promise.all([...this.live.keys()].map((id) => this.endSession(id)))
      await this.endCleanup()
    })
  }

  /** 승인 화면(D83)과 Work 완료 화면(시나리오 7-3)에 보일 것. 파일을 다시 읽어 만든다 */
  async review(taskId: string): Promise<ReviewView | null> {
    const task = this.task(taskId)
    if (!task) return null
    const { env } = this.ctx
    const files = await this.files.taskFiles(task)
    const check = this.check(task, files)
    // 끝난 task는 그 task가 끝났을 때의 코드까지 본다. 작업 트리는 지금 코드의 마지막 task만 본다.
    // 정리한 Work는 worktree가 없어 메인 체크아웃에서 커밋끼리 비교한다 (시나리오 8)
    const range = changeRange(this.work, task.id)
    const latest = range?.to === null
    const cwd = this.work.status === 'archived' ? this.project.repo_path : this.worktree
    const uncommitted = latest ? await statusLines(this.worktree, { env }).catch(() => []) : []
    const diffTo = (from: string) =>
      diffFrom(cwd, from, range?.to ?? null, { env }).catch(
        (e: unknown) => `변경을 읽지 못함: ${message(e)}`,
      )
    const diff = range ? await diffTo(range.from) : ''
    const handoffText = files[HANDOFF_FILE]
    const header = check.handoffHeader
    const gate = (size?: Size) => approvalGate(task, check, size)
    const respond = task.respond ? await this.respondReview(task, files) : null
    let completion: Completion | null = null
    if (task.node === 'verify') {
      const workDiff = await diffTo(this.work.base_commit)
      // Work 완료 화면 (시나리오 7-3): 승인할 수 있는 verify는 전달 버튼이나(승인하면 멈추면
      // [승인하고 멈춤]), verify에서 멈춘 Work는 전달 버튼이다 (D119)
      const stopped = stoppedVerify(this.work)?.id === task.id
      const current =
        this.work.status === 'active' &&
        currentTask(this.work)?.id === task.id &&
        REVIEWABLE.includes(task.status)
      completion = {
        verdicts: verdicts(files['verification.md'] ?? ''),
        diff: clip(workDiff),
        mode:
          stopped || (current && !approvalStops(this.work, task.node, header))
            ? 'deliver'
            : current
              ? 'stop'
              : null,
        stopped,
        buttons: deliveryButtons(this.checks()),
        delivery: deliveryView(this.work.delivery),
      }
    }
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
      errors: check.errors,
      warnings: check.warnings,
      emphasis: emphasis({
        node: task.node,
        handoff: header,
        errors: check.errors,
        uncommitted,
        ...(respond ? { tests: respond.tests, failure: respond.view.failure } : {}),
      }),
      artifacts: Object.entries(files)
        .filter(([name]) => name !== CONTEXT_FILE && name !== HANDOFF_FILE)
        .map(([name, text]) => ({ name, text })),
      diff: clip(diff),
      draftSize: task.node === 'intake' ? (check.intentDraft?.size ?? null) : null,
      gates: { none: gate(), S: gate('S'), M: gate('M'), L: gate('L') },
      autoApprove: autoApproveNote(this.work, task, this.ctx.config()),
      completion,
      respond: respond?.view ?? null,
    }
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
    const file = await this.prItems()
    const prior = file.rounds.find((x) => x.task_id === task.id)
    const pending = pendingRespond(this.work)?.id === task.id
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
    if (pending && task.start_commit) {
      try {
        tests = existingTestChanges(
          await changedPaths(this.worktree, task.start_commit, { env: this.ctx.env }),
        )
      } catch (e) {
        this.problem(`기존 테스트 변경을 읽지 못함: ${message(e)}`)
      }
    }
    const rules = this.prRules()
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
        deferred: pending ? deferredRounds(this.work).map((t) => taskLabel(t)) : [],
        failure: respondFailureView(r.failure),
        blocked: pending && this.work.pr?.closed_at ? PR_CLOSED : null,
      },
    }
  }

  // ---------- PR 진행 (시나리오 10, D152~D200) ----------

  /** 지금 프로젝트. 프로젝트 설정은 실행 중에 바뀐다 (D185) */
  private projectNow(): ProjectState {
    return this.ctx.project(this.project.project_id) ?? this.project
  }

  /** 코멘트의 거르기 규칙: 프로젝트 설정의 받을 봇 (D161, D197) */
  private prRules(): ItemRules {
    return { allowedBots: this.projectNow().allowed_bots ?? [] }
  }

  /** pr-items.json. 처음 쓸 때 읽는다. 읽지 못하면 알리고 빈 목록으로 둔다 */
  private async prItems(): Promise<PrItemsFile> {
    if (!this.prFile) {
      try {
        this.prFile = await this.files.readPrItems()
      } catch (e) {
        this.problem(`pr-items.json을 읽지 못함: ${message(e)}`)
        this.prFile = { ...EMPTY_PR_ITEMS, items: [], synced: [], rounds: [] }
      }
    }
    return this.prFile
  }

  /** 머지 조건 (D176, D196) */
  private prGate(): Gate {
    return mergeGate({
      work: this.work,
      read: this.prRead,
      items: this.prFile?.items ?? [],
      localHead: this.prLocal,
    })
  }

  /** PR 진행인 Work의 배지 (D183) */
  private prBadge(): BadgeKind | undefined {
    if (this.work.status !== 'pr') return undefined
    const items = this.prFile?.items ?? []
    // 상한에 닿아 자동 시작을 멈췄으면 "자동 대응 멈춤"이 앞선다 (D171, D183)
    const paused = autoPlan(this.work, items, this.ctx.config()).kind === 'paused'
    return prBadgeKind(items, this.work.pr?.closed_at !== undefined, this.prGate(), paused)
  }

  /** PR 패널 (시나리오 10, D183) */
  private prPanel(): PrView | null {
    return prView({
      work: this.work,
      config: this.ctx.config(),
      read: this.prRead,
      file: this.prFile ?? EMPTY_PR_ITEMS,
      rules: this.prRules(),
      localHead: this.prLocal,
      reading: this.prReading !== null,
      error: this.prError,
    })
  }

  /**
   * PR 진행을 시작했거나 앱을 켰다 (시나리오 10-1, D158, D159). 항목을 읽어 두고, 닫히지 않은 PR이면 바로 한 번 읽고
   * 주기 읽기를 건다. 닫힌 PR은 [새로 고침]으로만 읽는다(D179). quiet면(앱을 켤 때) 반영에 성공한 첫 읽기까지 알리지
   * 않고 자동 대응을 바라지 않는다 (D159, D121). 읽기는 기다리지 않는다: 반영은 이 Work의 처리 줄에서 한다(I51)
   */
  async startPr(opts: { quiet?: boolean } = {}): Promise<void> {
    if (!this.work.pr) return
    if (opts.quiet) this.prStartRead = true
    await this.prItems()
    // 항목의 대응 중·처리됨을 대응 task의 기록(work.json)에 맞춘다: 앱이 둘 사이에 꺼졌을 수 있다 (D189)
    await this.syncItemStatus()
    this.changed()
    if (this.work.status !== 'pr' || this.work.pr.closed_at) return
    void this.readPrNow()
  }

  /** 주기 읽기를 건다 (D158). PR 진행이 아니거나 닫혔거나 앱을 끝내면 걸지 않는다 */
  private schedulePr(): void {
    if (this.prTimer) clearTimeout(this.prTimer)
    this.prTimer = null
    const w = this.work
    if (this.closing || w.status !== 'pr' || !w.pr || w.pr.closed_at) return
    this.prTimer = setTimeout(() => {
      this.prTimer = null
      void this.readPrNow()
    }, this.ctx.config().pr_poll_interval_sec * 1000)
  }

  /**
   * 하던 PR 읽기가 끝나기를 기다린다. 앱을 끝낼 때는 기다리지 않는다(네트워크를 기다려 종료가 늦어짐). 끝난 읽기는
   * 반영하지 않는다. 시험 도구가 임시 폴더를 지우기 전에 부른다: Windows는 gh·git이 작업 폴더로 쓰는 폴더를 지우지
   * 못한다
   */
  async prIdle(): Promise<void> {
    while (this.prReading) await this.prReading
  }

  /** PR 패널의 [새로 고침] (D158). 닫힌 PR도 읽어 다시 열렸는지 본다 (D179) */
  refreshPr(): Promise<CommandResult> {
    return this.readPrNow()
  }

  /**
   * PR을 한 번 읽는다 (시나리오 10-2, I51). 네트워크 부분은 처리 줄 밖에서 하고 반영은 줄에서 한다. 읽는 중이면 그
   * 읽기가 끝난 뒤 다시 읽는다. 끝나면 다음 주기 읽기를 건다
   */
  private async readPrNow(): Promise<CommandResult> {
    while (this.prReading) await this.prReading
    if (this.closing) return { ok: false, error: '앱을 끝내는 중' }
    const run = this.readPrOnce().catch((e: unknown): CommandResult =>
      this.prFailed(`PR을 읽지 못함: ${message(e)}`),
    )
    this.prReading = run
    this.changed()
    try {
      return await run
    } finally {
      this.prReading = null
      this.changed()
      this.schedulePr()
    }
  }

  private prFailed(error: string): CommandResult {
    this.prError = error
    console.error(`[${this.key}] ${error}`)
    return { ok: false, error }
  }

  private async readPrOnce(): Promise<CommandResult> {
    const pr = this.work.pr
    if (this.work.status !== 'pr' || !pr) return { ok: false, error: 'PR 진행인 Work가 아님' }
    // 끊긴 작업의 기록이 있는 동안은 읽지 않는다 (I51, D122). 진행 중인 머지는 처리 줄이 끝나야 읽는다
    if (cutOperation(this.work)) return { ok: false, error: OPERATION_BLOCKS }
    const location = prLocation(pr.url)
    if (!location) return this.prFailed(`PR 주소를 읽지 못함: ${pr.url}`)
    const file = await this.prItems()
    // CI 실패 항목에 적힌 이벤트를 다시 읽지 않는다. 읽기에 실패해도 항목의 id가 바뀌지 않는다 (I52)
    for (const item of file.items) {
      const c = item.check
      if (c && c.run !== null && c.event) this.runEvents.set(c.run, c.event)
    }
    let fetched: PrFetched
    try {
      fetched = await readPr(
        {
          ghBin: this.ctx.ghBin,
          env: this.ctx.env,
          repo: this.project.repo_path,
          worktree: this.worktree,
          branch: workBranch(this.work.work_id),
          location,
          runEvents: this.runEvents,
        },
        (id) => file.items.some((i) => i.id === id && i.log !== undefined),
      )
    } catch (e) {
      return this.prFailed(`PR을 읽지 못함: ${message(e)}`)
    }
    return this.enqueue(() => this.applyRead(pr.number, fetched))
  }

  /**
   * 읽은 결과를 반영한다 (처리 줄 안, I51). 새 head를 처음 읽은 때로 CI를 정하고(D196), 원격만 앞섰으면 fast-forward로
   * 받고(D193) 기준 브랜치 병합이 있으면 기준 커밋을 옮기고(D181), 항목을 모아(D189, D199) pr-items.json에 쓰고,
   * 읽은 결과를 machine에 넣는다. 사람이 움직여야 하면 알린다(D184): 대응 거리가 들어옴, 머지할 수 있음, 닫힘,
   * 밖에서 머지됨. 앱을 켤 때의 읽기(반영에 성공한 첫 읽기)는 알리지 않는다(D159)
   */
  private async applyRead(number: number, f: PrFetched): Promise<CommandResult> {
    const pr = this.work.pr
    // 앱을 끝내는 동안 끝난 읽기는 반영하지 않는다. 다음에 켤 때 다시 읽는다 (D159)
    if (this.closing) return { ok: false, error: '앱을 끝내는 중' }
    if (this.work.status !== 'pr' || !pr || pr.number !== number || this.work.operation) {
      return { ok: false, error: '읽는 동안 Work가 바뀌어 반영하지 않음' }
    }
    const at = this.ctx.at()
    const now = Date.now()
    const mergeableBefore = this.prGate().enabled
    const closedBefore = pr.closed_at !== undefined
    // D196: 새 head를 처음 읽은 때부터 60초는 체크가 없어도 통과로 보지 않는다
    const seen = this.headSeen.get(f.view.head) ?? now
    this.headSeen.set(f.view.head, seen)
    const warnings = [...f.warnings]
    let local = f.local
    let sync = f.sync
    let synced: PrSynced | null = null
    // PR 대응 task가 끝나기 전에는 fast-forward하지 않는다 (D193): 대응 task가 코드를 바꾸는 중이다
    if (sync === 'ff' && local && !pendingRespond(this.work)) {
      try {
        synced = await this.fastForward(local, f.view.head, f.view.baseRef, at)
        local = f.view.head
        sync = 'same'
      } catch (e) {
        warnings.push(`원격 커밋을 받지 못함: ${message(e)}`)
        sync = null
      }
    }
    const file = await this.prItems()
    // 앱이 게시한 답글은 항목으로 보지 않는다: 적어 둔 코멘트 id와 보이지 않는 표시로 가린다 (D194)
    const comments = f.comments.filter((c) => !isAppReply(c, this.work.work_id, file))
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
      this.prRules(),
    )
    const next: PrItemsFile = {
      ...file,
      items: gathered.items,
      synced: synced ? [...file.synced, synced] : file.synced,
    }
    try {
      await this.files.writePrItems(next)
    } catch (e) {
      return this.prFailed(`pr-items.json을 쓰지 못함: ${message(e)}`)
    }
    this.prFile = next
    this.prLocal = local
    this.prRead = {
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
    this.prError = warnings.length ? warnings.join(' / ') : null
    const quiet = this.prStartRead
    await this.feed(
      {
        type: 'pr.read',
        at,
        number,
        state: f.view.state,
        head: f.view.head,
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
    this.prStartRead = false
    // 받은 새 항목으로 자동 대응을 바란다. 앱을 켤 때의 읽기는 보이기만 한다 (D159, D210)
    const autoOn = autoStartOn(this.ctx.config(), this.work.settings)
    const wanted = wantsAutoStart({ quiet, received: gathered.received.length, on: autoOn })
    if (wanted) this.autoWanted = true
    if (!quiet) {
      const w = this.work
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
        if (!mergeableBefore && this.prGate().enabled) notes.push('머지할 수 있음')
      }
      if (notes.length) this.notify(`PR #${number}: ${notes.join(' · ')}`)
    }
    this.changed()
    if (wanted) this.autoRespondSoon()
    return { ok: true }
  }

  /**
   * 원격만 앞선 PR 브랜치를 받는다 (D193, S7 관찰 8). 읽은 뒤 바뀌었을 수 있어 로컬 Work 브랜치, worktree의 변경과
   * 브랜치를 다시 본다. 받은 커밋에 기준 브랜치 병합이 있으면 기준 브랜치를 fetch해 옮길 기준 커밋을 정한다 (D181)
   */
  private async fastForward(
    local: string,
    remote: string,
    baseRef: string,
    at: string,
  ): Promise<PrSynced> {
    const opts = { env: this.ctx.env }
    const repo = this.project.repo_path
    const branch = workBranch(this.work.work_id)
    if ((await refCommit(repo, `refs/heads/${branch}`, opts)) !== local) {
      throw new Error('읽은 뒤 로컬 Work 브랜치가 바뀜')
    }
    if ((await statusLines(this.worktree, opts)).length) {
      throw new Error('읽은 뒤 worktree에 커밋 안 된 변경이 생김')
    }
    if ((await currentBranch(this.worktree, opts)) !== branch) {
      throw new Error('worktree가 Work 브랜치에 있지 않음')
    }
    await mergeFastForward(this.worktree, remote, opts)
    const ctx = { repo, env: this.ctx.env }
    const { received, base } = await receivedCommits(
      ctx,
      local,
      remote,
      this.work.base_commit,
      () => fetchTip(ctx, baseRef || this.work.base_branch),
    )
    return { at, from: local, commits: received, ...(base ? { base_commit: base } : {}) }
  }

  /**
   * 프로젝트 설정이 바뀌었다 (D185). 받을 봇이 바뀌었을 수 있어 PR 진행인 Work의 항목에 거르기 규칙을 다시 적용한다
   * (D161). 사람이 바꾼 것이라 알리지 않는다
   */
  projectSettingsChanged(): Promise<void> {
    return this.enqueue(async () => {
      if (this.work.status === 'pr' && this.work.pr) {
        const file = await this.prItems()
        const r = reapplyRules(file.items, this.prRules())
        if (r.changed.length) {
          const next: PrItemsFile = { ...file, items: r.items }
          try {
            await this.files.writePrItems(next)
            this.prFile = next
          } catch (e) {
            this.problem(`pr-items.json을 쓰지 못함: ${message(e)}`)
          }
        }
      }
      this.changed()
    })
  }

  /** PR 패널의 [제외], [다시 넣기], [받기] (D160, D161, D170, D189). PR 진행인 Work만 받는다 */
  prItem(id: string, action: PrItemAction): Promise<CommandResult> {
    return this.enqueue(async () => {
      if (this.work.status !== 'pr') return { ok: false, error: 'PR 진행인 Work가 아님' }
      if (cutOperation(this.work)) return { ok: false, error: OPERATION_BLOCKS }
      const file = await this.prItems()
      const r = applyItemAction(file.items, id, action)
      if (!r.ok) return r
      const next: PrItemsFile = { ...file, items: r.items }
      try {
        await this.files.writePrItems(next)
      } catch (e) {
        return { ok: false, error: `pr-items.json을 쓰지 못함: ${message(e)}` }
      }
      this.prFile = next
      this.changed()
      return { ok: true }
    })
  }

  /**
   * 머지 창 (D176, D177): 레포가 허용하는 방식을 gh로 읽고(S7 관찰 6), 기본 선택(프로젝트 설정이 허용되면 그것,
   * 아니면 허용하는 첫 방식)과 머지할 head, 지금 머지 조건을 준다
   */
  async prMergeInfo(): Promise<MergeInfoResult> {
    const pr = this.work.pr
    if (this.work.status !== 'pr' || !pr) return { ok: false, error: 'PR 진행인 Work가 아님' }
    const location = prLocation(pr.url)
    if (!location) return { ok: false, error: `PR 주소를 읽지 못함: ${pr.url}` }
    let methods: MergeMethod[]
    try {
      methods = allowedMethods(
        await ghMergeSettings(this.ctx.ghBin, {
          repo: repoArg(location),
          cwd: this.project.repo_path,
          env: this.ctx.env,
        }),
      )
    } catch (e) {
      return { ok: false, error: `레포가 허용하는 머지 방식을 읽지 못함: ${message(e)}` }
    }
    if (!methods.length) return { ok: false, error: '레포가 허용하는 머지 방식이 없음' }
    // 대응 라운드가 push했거나 원격 커밋을 받았으면 판정표가 대응 전 코드 기준이다 (D180, D206)
    const verify = [...this.work.tasks].reverse().find((t) => t.node === 'verify')
    const table = verify
      ? verdicts((await this.files.taskFiles(verify))['verification.md'] ?? '')
      : []
    return {
      ok: true,
      info: {
        head: pr.head,
        methods,
        preferred: preferredMethod(methods, this.projectNow().merge_method),
        gate: this.prGate(),
        stale: staleVerdicts(await this.prItems()),
        verdicts: table,
      },
    }
  }

  /** 머지 창의 [머지] (D176). 창에 보인 head와 지금 머지 조건을 machine이 본다. 실패하면 GitHub의 오류를 돌려준다 */
  prMerge(input: MergeInput): Promise<CommandResult> {
    return this.enqueue(async () => {
      this.opError = null
      const r = await this.command({
        type: 'pr.merge',
        at: this.ctx.at(),
        method: input.method,
        head: input.head,
        gate: this.prGate(),
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
  private async mergeCode(e: Extract<Effect, { type: 'merge' }>): Promise<void> {
    const pr = this.work.pr
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
      cwd: this.project.repo_path,
      env: this.ctx.env,
    }
    const state = async () => (await ghPrView(this.ctx.ghBin, gh, ['state']))['state']
    try {
      if (e.resume && (await state()) === 'MERGED') {
        await this.feed({ type: 'pr.merged', at: this.ctx.at() })
        return
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
        setTimeout(() => void this.readPrNow(), 0)
        return
      }
      // 성공 문구는 TTY일 때만 찍으므로 다시 읽어 머지됐는지 본다 (S7 관찰 6, 3절)
      const now = await state()
      if (now !== 'MERGED') {
        await fail(`gh pr merge는 성공했지만 PR이 머지되지 않음 (state: ${String(now)})`)
        return
      }
      await this.feed({ type: 'pr.merged', at: this.ctx.at() })
    } catch (err) {
      await fail(`머지 실패: ${message(err)}`)
    }
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
  private async ensureOpen(number: number, location: PrLocation): Promise<void> {
    const gh = {
      repo: repoArg(location),
      number,
      cwd: this.project.repo_path,
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
  prEnd(): Promise<CommandResult> {
    return this.enqueue(() => this.command({ type: 'pr.end', at: this.ctx.at() }))
  }

  /** 머지 뒤 정리 창을 열었다 (D178, D200) */
  prCleanOffered(): Promise<CommandResult> {
    return this.enqueue(() => this.command({ type: 'pr.cleanOffered', at: this.ctx.at() }))
  }

  // ---------- PR 대응 (시나리오 10-3~10-7, D168~D207) ----------

  /** pr-items.json을 쓰고 메모리에 둔다. 쓰지 못하면 던진다 */
  private async writePr(next: PrItemsFile): Promise<void> {
    await this.files.writePrItems(next)
    this.prFile = next
  }

  /** 항목의 대응 중·처리됨을 대응 task의 기록(work.json)에 맞춘다 (D189). 쓰지 못하면 알리고 다음에 다시 맞춘다 */
  private async syncItemStatus(): Promise<void> {
    const file = await this.prItems()
    const r = reconcileItems(file.items, this.work)
    if (!r.changed.length) return
    try {
      await this.writePr({ ...file, items: r.items })
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
    const pre = respondStart(this.work, this.prFile?.items ?? [])
    if (!pre.enabled) return { ok: false, error: pre.reason ?? '대응을 시작할 수 없음' }
    if (this.cleanupOpen()) return { ok: false, error: CLEANUP_BLOCKS }
    const remote = await this.fetchForRound()
    return this.enqueue(async () => {
      const file = await this.prItems()
      const error = respondInputError(
        respondStart(this.work, file.items),
        input.items,
        input.instruction,
      )
      if (error) return { ok: false, error }
      return this.startRound({ items: input.items, instruction: input.instruction }, remote)
    })
  }

  /**
   * 대응 라운드 전에 기준 브랜치와 PR 브랜치를 fetch한다 (시나리오 10-3). 네트워크라 처리 줄 밖에서 한다(I51). 실패해도
   * 시작한다: 대응 task는 앱이 가진 원격 추적 브랜치로 한다. PR 브랜치의 원격 끝이고, 읽지 못하면 null이다
   */
  private async fetchForRound(): Promise<string | null> {
    const ctx = { repo: this.project.repo_path, env: this.ctx.env }
    await fetchTip(ctx, this.work.base_branch)
    return fetchTip(ctx, workBranch(this.work.work_id))
  }

  /**
   * 대응 라운드를 시작한다 (시나리오 10-3, D170, D181, D193). [대응 시작]과 자동 대응(D154)이 같이 쓰고, 판정(사람이 본
   * 항목, 자동 대응의 판정)과 실패했을 때의 처리는 부르는 쪽이 한다. 처리 줄 안에서 부른다. 정리 세션이 열려 있으면
   * 시작하지 않는다(D137). 원격만 앞섰으면 받고, 받지 못하면 시작하지 않는다: 새 항목은 남아 [대응 시작]할 수 있다.
   * 대응 task를 넣은 뒤 받은 커밋과 대응 중이 된 항목을 적는다 (D189)
   */
  private async startRound(
    input: { items: readonly string[]; instruction: string; auto?: boolean },
    remote: string | null,
  ): Promise<CommandResult> {
    if (this.cleanupOpen()) return { ok: false, error: CLEANUP_BLOCKS }
    const at = this.ctx.at()
    let synced: PrSynced | null
    try {
      synced = remote ? await this.syncForRespond(remote, at) : null
    } catch (e) {
      return { ok: false, error: `원격 PR 브랜치의 새 커밋을 받지 못함: ${message(e)}` }
    }
    const r = await this.command({
      type: 'pr.respond',
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
    const now = await this.prItems()
    try {
      await this.writePr({
        ...now,
        items: reconcileItems(now.items, this.work).items,
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
  private async syncForRespond(remote: string, at: string): Promise<PrSynced | null> {
    const opts = { env: this.ctx.env }
    const repo = this.project.repo_path
    const branch = workBranch(this.work.work_id)
    const local = await refCommit(repo, `refs/heads/${branch}`, opts)
    if (!local || local === remote) return null
    const localInRemote = await isAncestor(repo, local, remote, opts)
    if (!localInRemote) return null
    const clean = (await statusLines(this.worktree, opts)).length === 0
    const onBranch = (await currentBranch(this.worktree, opts)) === branch
    const kind = syncKind({ local, remote, localInRemote, remoteInLocal: false, clean, onBranch })
    if (kind !== 'ff') return null
    return this.fastForward(local, remote, this.work.base_branch, at)
  }

  // ---------- 자동 대응 (D154, D159, D171, D184, D210) ----------

  /**
   * 바라 둔 자동 대응을 판정한다. 바람이 없거나 판정하는 중이거나 앱을 끝내는 중이면 아무것도 하지 않는다. 기다리지
   * 않는다: 네트워크(fetch)는 처리 줄 밖에서 하고 시작은 줄에서 한다 (I51)
   */
  private autoRespondSoon(): void {
    if (!this.autoWanted || this.autoRunning || this.closing) return
    this.autoRunning = this.autoRespond()
      .catch((e: unknown) => this.problem(`자동 대응을 시작하지 못함: ${message(e)}`))
      .finally(() => {
        this.autoRunning = null
      })
  }

  /** 자동 대응 (D154, D170, D171, D184, D210): 판정을 따라 시작하거나, 상한에서 멈추고 알리거나, 막힘이 풀리기를 기다린다 */
  private async autoRespond(): Promise<void> {
    const pre = autoPlan(this.work, this.prFile?.items ?? [], this.ctx.config())
    if (pre.kind === 'wait') return
    if (pre.kind === 'off' || pre.kind === 'none') {
      this.autoWanted = false
      return
    }
    // [대응 시작]처럼 시작하기 전에 기준 브랜치와 PR 브랜치를 fetch한다 (시나리오 10-3). 실패해도 시작한다
    const remote = pre.kind === 'start' ? await this.fetchForRound() : null
    await this.enqueue(async () => {
      if (this.closing) return
      const file = await this.prItems()
      // fetch하는 동안 바뀌었을 수 있어 줄에서 다시 판정한다
      const plan = autoPlan(this.work, file.items, this.ctx.config())
      if (plan.kind === 'wait') return
      this.autoWanted = false
      const pr = this.work.pr
      if (!pr) return
      if (plan.kind === 'paused') {
        await this.feed({ type: 'pr.autoPaused', at: this.ctx.at(), items: plan.items })
        this.notify(autoPausedNotice(pr.number, plan.max, plan.items.length))
        return
      }
      if (plan.kind !== 'start') return
      const r = await this.startRound({ items: plan.items, instruction: '', auto: true }, remote)
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
  private async respondCode(e: Extract<Effect, { type: 'respond' }>): Promise<void> {
    const op = this.work.operation
    if (op?.kind !== 'respond') return
    const pr = this.work.pr
    const location = pr ? prLocation(pr.url) : null
    try {
      if (!pr || !location) throw new Error(`PR 주소를 읽지 못함: ${pr?.url ?? ''}`)
      // 닫히거나 머지된 PR에는 push하지도 답글을 게시하지도 않는다. 앱이 닫힘을 읽기 전의 승인과 끊긴 작업의
      // [다시 시도]도 막는다 (D179, D208)
      await this.ensureOpen(pr.number, location)
      await this.planReplies(op, e.resume === true)
      if (op.stage === 'push') {
        const pushed = await this.respondPush(op)
        if (!pushed) {
          const check = (await this.checkNow(op.task_id)) ?? null
          await this.feed({ type: 'respond.deferred', at: this.ctx.at(), check })
          setTimeout(() => void this.readPrNow(), 0)
          return
        }
        await this.feed({ type: 'respond.pushed', at: this.ctx.at(), ...pushed })
      }
      const replies = await this.postReplies(op, location)
      const base = (await this.prItems()).rounds.find((r) => r.task_id === op.task_id)?.pushed
        ?.base_commit
      const check = (await this.checkNow(op.task_id)) ?? null
      await this.feed({
        type: 'respond.published',
        at: this.ctx.at(),
        check,
        replies,
        ...(base && base !== this.work.base_commit ? { baseCommit: base } : {}),
      })
      await this.syncItemStatus()
    } catch (err) {
      const now = this.work.operation
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
    setTimeout(() => void this.readPrNow(), 0)
  }

  /**
   * 게시할 답글을 적어 둔다 (D172, D190, D194, D207). 승인한 라운드는 지금 replies.md로 정한다: 실패한 뒤 다시 승인했으면
   * 고친 초안을 쓴다. 게시했거나 건너뛴 답글은 그대로다. push를 미룬 앞 라운드와, 끊긴 작업을 잇는 경우(resume)는 적어 둔
   * 것을 쓴다: 사람이 승인한 본문이다. 적어 둔 것이 없는 라운드만 정한다
   */
  private async planReplies(op: RespondOperation, resume: boolean): Promise<void> {
    const file = await this.prItems()
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
        workId: this.work.work_id,
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
    if (changed) await this.writePr({ ...file, rounds })
  }

  /**
   * push (시나리오 10-6): M5와 같은 일반 push다. 강제 push는 하지 않는다(D181). worktree가 Work 브랜치에 있지 않으면 하지
   * 않는다(D138). 원격에 이미 있는 커밋이면 보내지 않는다(끊긴 push를 다시 함). 거절되면 PR 브랜치를 fetch해 원격과 로컬
   * HEAD의 조상 관계로 가른다: 갈라졌으면 원격의 새 커밋 때문이라 null(라운드를 미룸, D193), 보낼 커밋이 이미 원격에
   * 있으면 push한 것으로 본다. 거절 문구에 기대지 않는다(M9의 머지와 같은 까닭, S7 관찰 8)
   */
  private async respondPush(
    op: RespondOperation,
  ): Promise<{ head: string; commits: string[] } | null> {
    const opts = { env: this.ctx.env }
    const repo = this.project.repo_path
    const ctx = { repo, env: this.ctx.env }
    const branch = workBranch(this.work.work_id)
    const off = await this.offBranch()
    if (off) throw new Error(off)
    const head = await headCommit(this.worktree, opts)
    const inRemote = async (remote: string | null) =>
      remote !== null && (remote === head || (await isAncestor(repo, head, remote, opts)))
    const tip = await fetchTip(ctx, branch)
    // 실패한 뒤 다시 승인했고 그때 push한 head 그대로면 다시 적지 않는다: 이번에 올라간 커밋이 없다
    const pushed = (await this.prItems()).rounds.find((r) => r.task_id === op.task_id)?.pushed
    if (pushed?.head === head && (await inRemote(tip))) return { head, commits: [] }
    if (!(await inRemote(tip))) {
      try {
        await pushBranch(this.worktree, branch, 'origin', opts)
      } catch (err) {
        const after = await fetchTip(ctx, branch)
        if (!(await inRemote(after))) {
          if (after && !(await isAncestor(repo, after, head, opts))) return null
          throw err
        }
      }
    }
    return this.recordPush(op, head)
  }

  /**
   * push한 것을 라운드 기록에 적는다: 승인할 때 읽은 원격 head(from)에서 닿지 않는 커밋(원격에 없던 것)과, 이번에 push한
   * 라운드들이 기준 브랜치를 병합했으면 옮길 기준 커밋(D181. 원격을 병합해 들어온 기준 브랜치 병합도 본다). 미룬 앞 라운드에는
   * 함께 push한 라운드를 적는다 (D193)
   */
  private async recordPush(
    op: RespondOperation,
    head: string,
  ): Promise<{ head: string; commits: string[] }> {
    const opts = { env: this.ctx.env }
    const repo = this.project.repo_path
    const ctx = { repo, env: this.ctx.env }
    const first = this.task(op.rounds[0] ?? op.task_id)?.start_commit
    const from = (await hasCommit(repo, op.from, opts)) ? op.from : first
    const commits = from
      ? (await commitsWithParents(repo, from, head, opts)).map((c) => c.commit)
      : []
    const base = first
      ? (
          await receivedCommits(ctx, first, head, this.work.base_commit, () =>
            fetchTip(ctx, this.work.base_branch),
          )
        ).base
      : null
    const file = await this.prItems()
    const at = this.ctx.at()
    const rounds = file.rounds.map((r): PrRound =>
      r.task_id === op.task_id
        ? { ...r, pushed: { at, head, commits, ...(base ? { base_commit: base } : {}) } }
        : op.rounds.includes(r.task_id)
          ? { ...r, pushed_with: op.task_id }
          : r,
    )
    await this.writePr({ ...file, rounds })
    return { head, commits }
  }

  /**
   * 라운드마다 답글을 하나씩 게시한다 (시나리오 10-6, D172~D174, D194, D205, D207). 게시했거나 건너뛴 답글을 돌려준다
   * (5.5 pr.replied). 끊긴 뒤 이었으면 앞서 게시한 답글도 넣는다
   */
  private async postReplies(
    op: RespondOperation,
    location: PrLocation,
  ): Promise<{ item: string; commentId?: number; skipped?: string }[]> {
    // 코멘트 목록은 한 번의 게시에서 종류마다 한 번만 받는다: 찾는 표시는 앞선 시도에서 올린 답글이고, 없어졌는지는
    // 원래 코멘트만 본다. 실패하면 그 자리에서 멈추고 [다시 시도]가 새로 받는다
    const lists: ReplyLists = new Map()
    for (const id of op.rounds) {
      const round = (await this.prItems()).rounds.find((r) => r.task_id === id)
      if (!round) continue
      for (const reply of unpostedReplies(round)) await this.postReply(id, reply, location, lists)
    }
    return (await this.prItems()).rounds
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
    taskId: string,
    reply: PrReply,
    location: PrLocation,
    lists: ReplyLists,
  ): Promise<void> {
    const file = await this.prItems()
    const item = file.items.find((i) => i.id === reply.item)
    if (item?.gone) {
      await this.updateReply(taskId, reply.item, { skipped: GONE_SKIP })
      return
    }
    if (reply.attempted_at) {
      const found = await this.findReply(reply, location, lists)
      if (found) {
        await this.updateReply(taskId, reply.item, {
          comment_id: found.id,
          ...(found.url ? { url: found.url } : {}),
          posted_at: this.ctx.at(),
        })
        return
      }
    }
    await this.updateReply(taskId, reply.item, { attempted_at: this.ctx.at() })
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
        cwd: this.project.repo_path,
        env: this.ctx.env,
      })
    } catch (err) {
      const answered = err instanceof GhApiError && err.status !== null
      if (reply.thread !== null && answered && (await this.inlineGone(reply, location, lists))) {
        await this.markGone(reply.item)
        await this.updateReply(taskId, reply.item, { skipped: GONE_SKIP })
        return
      }
      throw err
    }
    const id = typeof res['id'] === 'number' ? res['id'] : null
    if (id === null) throw new Error(`게시한 답글의 id를 읽지 못함 (${reply.item})`)
    const url = typeof res['html_url'] === 'string' ? res['html_url'] : undefined
    await this.updateReply(taskId, reply.item, {
      comment_id: id,
      ...(url ? { url } : {}),
      posted_at: this.ctx.at(),
    })
  }

  /** 답글이 올라갈 REST 목록 (스레드에 단 답글은 인라인 코멘트, 아니면 대화 코멘트). 한 번의 게시에서 종류마다 한 번 받는다 */
  private replyList(reply: PrReply, location: PrLocation, lists: ReplyLists): Promise<unknown[]> {
    const kind = reply.thread === null ? 'convo' : 'inline'
    let list = lists.get(kind)
    if (!list) {
      list = listPrComments(
        { ghBin: this.ctx.ghBin, env: this.ctx.env, repo: this.project.repo_path, location },
        kind,
      )
      lists.set(kind, list)
    }
    return list
  }

  /** 게시 결과를 모르는 답글을 원격에서 보이지 않는 표시로 찾는다 (D194). 없으면 null */
  private async findReply(
    reply: PrReply,
    location: PrLocation,
    lists: ReplyLists,
  ): Promise<{ id: number; url: string | null } | null> {
    for (const raw of await this.replyList(reply, location, lists)) {
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
    reply: PrReply,
    location: PrLocation,
    lists: ReplyLists,
  ): Promise<boolean> {
    const ids = new Set(
      (await this.replyList(reply, location, lists)).map((raw) =>
        raw && typeof raw === 'object' ? (raw as Record<string, unknown>)['id'] : null,
      ),
    )
    const own = Number(reply.item.slice('inline:'.length))
    return !ids.has(own) || !ids.has(reply.thread)
  }

  /** 없어진 코멘트를 적는다 (D205). 항목은 그 라운드를 게시하면 처리됨이다 */
  private async markGone(itemId: string): Promise<void> {
    const file = await this.prItems()
    await this.writePr({
      ...file,
      items: file.items.map((i) => (i.id === itemId ? { ...i, gone: true } : i)),
    })
  }

  /** 라운드 기록의 답글 하나를 고쳐 바로 쓴다 (D194: 게시할 때마다 적음) */
  private async updateReply(
    taskId: string,
    itemId: string,
    patch: Partial<PrReply>,
  ): Promise<void> {
    const file = await this.prItems()
    const rounds = file.rounds.map((r): PrRound =>
      r.task_id !== taskId
        ? r
        : { ...r, replies: r.replies.map((x) => (x.item === itemId ? { ...x, ...patch } : x)) },
    )
    await this.writePr({ ...file, rounds })
    this.changed()
  }

  /**
   * PR 패널의 [실패한 체크 다시 실행] (D175, D203): 마지막으로 읽은 head에서 실패한 Actions 체크의 실행을 --failed로 다시
   * 돌린다. 실행 하나가 실패해도 나머지는 한다. 다시 실행한 것을 남기고 곧 PR을 다시 읽는다
   */
  rerunChecks(): Promise<CommandResult> {
    return this.enqueue(async () => {
      const view = this.prPanel()?.rerun
      if (!view) return { ok: false, error: '다시 실행할 실패한 Actions 체크가 없음' }
      if (!view.enabled) return { ok: false, error: view.reason ?? '다시 실행할 수 없음' }
      const pr = this.work.pr
      const location = pr ? prLocation(pr.url) : null
      if (!location) return { ok: false, error: `PR 주소를 읽지 못함: ${pr?.url ?? ''}` }
      const done: number[] = []
      const errors: string[] = []
      for (const run of view.runs) {
        const r = await ghRerunFailed(this.ctx.ghBin, {
          repo: repoArg(location),
          run,
          cwd: this.project.repo_path,
          env: this.ctx.env,
        })
        if (r.ok) done.push(run)
        else errors.push(`실행 ${run}: ${r.error}`)
      }
      if (done.length) {
        const checks = (this.prRead?.checks ?? [])
          .filter((c) => c.bucket === 'fail' && c.run !== null && done.includes(c.run))
          .map((c) => c.label)
        await this.feed({ type: 'pr.checksRerun', at: this.ctx.at(), runs: done, checks })
      }
      setTimeout(() => void this.readPrNow(), 0)
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
    if (taskId.startsWith(`${CLEANUP_ID}-`)) {
      return this.terminals.get(taskId)?.backlog() ?? { data: '', next: 0, live: false }
    }
    const task = this.task(taskId)
    if (!task) return { data: '', next: 0, live: false }
    return (await this.terminalBuffer(task)).backlog()
  }

  /** 입력을 받는 PTY: task의 살아 있는 세션이나 정리 세션 */
  private ptyOf(taskId: string): PtySession | undefined {
    const c = this.cleanup
    if (c && taskId === c.id) return c.status === 'live' ? (c.pty ?? undefined) : undefined
    return this.live.get(taskId)?.pty
  }

  write(taskId: string, data: string): void {
    this.ptyOf(taskId)?.write(data)
  }

  resize(taskId: string, cols: number, rows: number): void {
    this.ptyOf(taskId)?.resize(cols, rows)
  }

  // ---------- 스냅샷 (I14) ----------

  private changed(): void {
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
      projectName: path.basename(this.project.repo_path),
      workId: w.work_id,
      title: this.title,
      status: w.status,
      statusLabel: WORK_STATUS_LABEL[w.status],
      completedAt: w.completed_at ?? null,
      badge: badge(w, this.prBadge()),
      actions: this.cleanupOpen() ? cleanupActions(actions(w)) : actions(w),
      stopAfterStep: w.stop_after_step === true,
      settings: w.settings,
      baseBranch: w.base_branch,
      baseCommit: w.base_commit,
      intent: w.intent,
      stopNotice: stopNotice(w),
      stopHint: resumeHint(w),
      steps: stepChoices(w),
      delivery: deliveryView(w.delivery),
      pr: this.prPanel(),
      cleanup: this.cleanupView(),
      operation: operationView(w),
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
      terminal: this.terminalKey(c.id),
      status: c.status,
      choice: c.choice,
      clean: c.clean,
      uncommitted: [...c.uncommitted],
    }
  }

  private taskView(t: TaskRecord): TaskView {
    return {
      id: t.id,
      terminal: this.terminalKey(t.id),
      node: t.node,
      label: taskLabel(t),
      band: bandText(t),
      notice: permissionNotice(t),
      status: t.status,
      statusLabel: TASK_STATUS_LABEL[t.status],
      live: this.live.has(t.id),
      resumed: t.session?.resumed_at !== undefined,
      appEnded: t.session?.app_ended !== undefined,
      error: t.error ?? null,
      errorCount: t.check?.errors.length ?? 0,
      bounces: t.bounce_count,
      countdown: t.countdown
        ? { seconds: t.countdown.seconds, endsAt: this.countdownEnds(t) }
        : null,
      activity: this.activityOf(t),
    }
  }

  /**
   * 진행 표시 (D216). 작업 중인 task만 보인다. 첫 턴 전(세션을 띄우는 중)은 task를 만든 때부터 센다: 앱이 스킬과
   * context.md를 준비하는 시간도 사람에게는 기다리는 시간이다
   */
  private activityOf(t: TaskRecord): ActivityView | null {
    if (t.status !== 'working') return null
    const session = this.live.get(t.id)
    const turn = session?.turnStartedAt ?? null
    const tool = session?.tool ?? null
    return {
      turn: turn !== null,
      since: turn ?? Date.parse(t.created_at),
      tool: tool ? { label: tool.label, startedAt: tool.startedAt, endedAt: tool.endedAt } : null,
    }
  }
}
