// Work 하나의 흐름 (시나리오 2~7, 9). 훅 신호, 사람 버튼, 프로세스 종료, 감시, 재시작을 이벤트로 바꿔
// core/machine에 넣고, 전이마다 work.json을 쓰고(I11) 돌려받은 할 일을 차례로 실행한다.
// 이벤트는 Work마다 한 줄로 처리한다. 할 일(task 시작 등)이 끝날 때까지 다음 이벤트는 기다린다.
// 세션 상한(D18)은 Relay의 SessionPool이 모든 Work에 걸쳐 센다. 자리가 없으면 대기열에 넣는다.
import { randomBytes, randomUUID } from 'node:crypto'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { claudeVersion, deploySkill, findClaude } from '../adapters/claude'
import { diffFrom, headCommit, statusLines } from '../adapters/git'
import type { HookReply, HookRequest, HookServer } from '../adapters/hooks'
import { processStartTime, startPty, type PtySession } from '../adapters/pty'
import {
  readText,
  writeFileAtomic,
  writeJson,
  type PtyLog,
  type WorkFiles,
} from '../adapters/store'
import { watchDir } from '../adapters/watch'
import { REVIEWABLE, approvalGate, badge } from '../core/approval'
import { buildContext, previousInputs, type PreviousTask } from '../core/context'
import {
  actions,
  currentTask,
  transition,
  type Effect,
  type InterruptReason,
  type MachineEvent,
} from '../core/machine'
import { NODE_INFO } from '../core/pipeline'
import { confirmedIntent, decisionsBlock } from '../core/records'
import {
  TASK_STATUS_LABEL,
  WORK_STATUS_LABEL,
  bandText,
  emphasis,
  handoffSummary,
  humanNotice,
  permissionNotice,
  stopNotice,
  taskLabel,
  verdicts,
} from '../core/review'
import { launchArgs, launchEnv, resumeArgs, taskSettings } from '../core/settings'
import { HANDOFF_FILE, INTENT_DRAFT_FILE, checkTask, type TaskCheck } from '../core/validate'
import type { AppConfig, WorkSettings } from '../shared/config'
import type { Size } from '../shared/contracts'
import type { ProjectState } from '../shared/project'
import type {
  ApproveOptions,
  CommandResult,
  ReviewView,
  TaskView,
  TerminalBacklog,
  WorkView,
} from '../shared/views'
import type { TaskRecord, WorkState } from '../shared/work'
import type { SessionPool } from './pool'
import type { UiPort } from './ports'
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
}

const CONTEXT_FILE = 'context.md'
const SETTINGS_FILE = 'task.settings.json'
const PTY_LOG = 'pty.log'
const MAX_DIFF_CHARS = 2_000_000
const KILL_WAIT_MS = 10_000

/** 다시 연 세션의 출력 앞에 넣는 줄. 이전 화면 뒤에 이어 보인다 (시나리오 3-4) */
const RESUME_MARK = '\r\n\x1b[0m\x1b[2m── relay: 세션 재개 (--resume) ──\x1b[0m\r\n'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
  private readonly problems: string[] = []
  private revision = 0

  constructor(
    private readonly ctx: RunnerContext,
    readonly project: ProjectState,
    readonly files: WorkFiles,
    readonly worktree: string,
    public work: WorkState,
    private readonly title: string,
  ) {
    this.key = `${project.project_id}/${work.work_id}`
  }

  /** 이 앱에서 살아 있는 세션이 있다 (앱 종료 확인, 시나리오 3-6) */
  hasLiveSession(): boolean {
    return this.live.size > 0
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
   * 새 상태를 work.json에 쓰고(I11) 할 일을 차례로 실행한다.
   * 사람이 움직여야 하는 상태로 바뀌었으면 알린다(D81). 재시작 조정은 알리지 않는다(quiet).
   * blockStop이 있으면 Stop 요청에 돌려줄 응답을 돌려준다 (D21, S2).
   */
  async apply(
    work: WorkState,
    effects: readonly Effect[],
    opts: { quiet?: boolean } = {},
  ): Promise<HookReply> {
    if (work === this.work && effects.length === 0) return null
    const before = this.work
    this.work = work
    await this.files.save(work)
    this.changed()
    const notice = opts.quiet ? null : humanNotice(before, work)
    if (notice) this.notify(notice)
    let reply: HookReply = null
    for (const e of effects) {
      try {
        reply = (await this.run(e)) ?? reply
      } catch (err) {
        this.problem(`${e.type} 실패: ${message(err)}`)
      }
    }
    return reply
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
      case 'appendDecisions':
        await this.files.appendDecisions(
          decisionsBlock({
            taskId: e.taskId,
            node: e.node,
            at: e.at,
            by: e.by,
            decisions: e.decisions,
          }),
        )
        return
      case 'confirmIntent':
        await this.confirmIntent(e.taskId, e.version, e.size)
        return
      case 'startTask':
      case 'resumeTask':
        await this.requestSession(e.taskId)
        return
      case 'dequeue':
        this.ctx.pool.remove(this.slotKey(e.taskId))
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

      const previous = this.approvedBefore(task)
      const settingsPath = await this.writeSettings(task, previous)
      const contextPath = path.join(dir, CONTEXT_FILE)
      await writeFileAtomic(contextPath, await this.context(task, dir, previous))

      const sessionId = randomUUID()
      const token = randomBytes(32).toString('hex')
      const args = launchArgs({
        sessionId,
        workDir: this.files.dir,
        settingsPath,
        skill,
        contextPath,
      })
      const session = this.launch(task, bin, token, args, turnSnapshot(task, {}))
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
      const settingsPath = await this.writeSettings(task, this.approvedBefore(task))
      const files = await this.files.taskFiles(task)
      // 이전 화면을 먼저 보인다. 이 앱에서 돌던 task면 버퍼가 남아 있고, 아니면 pty.log에서 읽는다
      await this.terminalBuffer(task)
      const token = randomBytes(32).toString('hex')
      const args = resumeArgs({ sessionId, workDir: this.files.dir, settingsPath })
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

  /** 이 task보다 앞의 승인된 task. 입력과 deny 규칙에 쓴다. 폐기된 task는 M4에서 뺀다 */
  private approvedBefore(task: TaskRecord): TaskRecord[] {
    return this.work.tasks.filter((t) => t.seq < task.seq && t.status === 'approved')
  }

  /** task 설정 파일을 쓴다 (시나리오 2-3, D113) */
  private async writeSettings(task: TaskRecord, previous: readonly TaskRecord[]): Promise<string> {
    const settingsPath = path.join(this.files.taskDir(task), SETTINGS_FILE)
    await writeJson(
      settingsPath,
      taskSettings({
        port: this.ctx.hooks.port,
        taskId: task.id,
        workDir: this.files.dir,
        previousTaskDirs: previous.map((t) => this.files.taskDir(t)),
      }),
    )
    return settingsPath
  }

  /** context.md의 내용 (시나리오 2-4). 폐기된 task는 M4에서 뺀다 */
  private async context(
    task: TaskRecord,
    dir: string,
    previous: readonly TaskRecord[],
  ): Promise<string> {
    const earlier: PreviousTask[] = []
    for (const t of previous) {
      const handoff = await readText(path.join(this.files.taskDir(t), HANDOFF_FILE))
      earlier.push({
        taskId: t.id,
        node: t.node,
        ...(handoff === null ? {} : { handoff }),
        artifacts: await this.files.artifacts(t),
      })
    }
    return buildContext({
      work: this.work,
      task,
      config: this.ctx.config(),
      taskDir: dir,
      request: { path: this.files.request, text: await this.files.readRequest() },
      intent: await this.files.readIntent(),
      decisionLog: await this.files.readDecisions(),
      ...previousInputs(earlier),
    })
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
    }
    const write = (data: string) => {
      log.write(data)
      this.ctx.ui.terminal(key, buffer.push(data))
    }
    if (mark) write(mark)
    pty.onData((data) => {
      // 끝낸 세션의 늦은 출력은 다시 연 세션의 화면에 섞지 않는다
      if (!session.stopped) write(data)
    })
    pty.onExit(() => {
      exited()
      void this.enqueue(() => this.onExit(task.id, session))
    })
    session.unregister = this.ctx.hooks.register(token, task.id, (req) =>
      this.enqueue(() => this.onHook(task.id, req)),
    )
    session.unwatch = watchDir(this.files.taskDir(task), () => {
      void this.enqueue(() => this.onWatch(task.id))
    })
    this.live.set(task.id, session)
    return session
  }

  // ---------- 세션 동안 (시나리오 3) ----------

  /** 훅 신호 (시나리오 3의 표). Stop이면 파일을 다시 읽어 검사한다 (I15) */
  private async onHook(taskId: string, req: HookRequest): Promise<HookReply> {
    const task = this.task(taskId)
    const session = this.live.get(taskId)
    if (!task) return null
    const at = this.ctx.at()
    const b = req.body
    switch (req.event) {
      case 'UserPromptSubmit': {
        if (session) session.turnFiles = turnSnapshot(task, await this.files.taskFiles(task))
        const mode = str(b['permission_mode'])
        return (
          await this.feed({
            type: 'UserPromptSubmit',
            taskId,
            at,
            ...(mode === undefined ? {} : { permissionMode: mode }),
          })
        ).reply
      }
      case 'PreToolUse':
      case 'PostToolUse':
        return (
          await this.feed({ type: req.event, taskId, at, toolName: str(b['tool_name']) ?? '' })
        ).reply
      case 'Notification': {
        const kind = str(b['notification_type'])
        return (
          await this.feed({
            type: 'Notification',
            taskId,
            at,
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
            taskId,
            at,
            stopHookActive: b['stop_hook_active'] === true,
            handoffChanged: changed,
            check: this.check(task, files),
          })
        ).reply
      }
      case 'SessionEnd': {
        const reason = str(b['reason'])
        return (
          await this.feed({
            type: 'SessionEnd',
            taskId,
            at,
            ...(reason === undefined ? {} : { reason }),
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
    await this.feed({ type: 'pty.exit', taskId, at: this.ctx.at(), pid: session.pty.pid })
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
    await this.files.writeIntent(confirmedIntent(draft, { version, size }), version)
  }

  /** [승인], [의도 승인], [완료만], [오류 무시하고 승인] (시나리오 4-3, 4.1) */
  approve(taskId: string, opts: ApproveOptions): Promise<CommandResult> {
    return this.enqueue(async () => {
      const task = this.task(taskId)
      if (!task) return { ok: false, error: `${taskId} 없음` }
      const check = this.check(task, await this.files.taskFiles(task))
      return this.command({
        type: 'approve',
        taskId,
        at: this.ctx.at(),
        check,
        ...(opts.size ? { size: opts.size } : {}),
        ...(opts.force ? { force: true } : {}),
      })
    })
  }

  // ---------- 사람 조작 (시나리오 3-4, 3-5, 3-6, 4.4) ----------

  /** 명령을 넣고 받아들였는지 돌려준다 */
  private async command(event: MachineEvent): Promise<CommandResult> {
    const { t } = await this.feed(event)
    return t.rejected ? { ok: false, error: t.rejected } : { ok: true }
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
    return this.enqueue(() => this.command({ type: 'resume', taskId, at: this.ctx.at() }))
  }

  /** [이 단계 새 세션으로 다시] (D114) */
  retry(taskId: string): Promise<CommandResult> {
    return this.enqueue(() => this.command({ type: 'retry', taskId, at: this.ctx.at() }))
  }

  /** [이 단계 끝나면 멈춤]을 켜거나 끈다 */
  stopAfter(on: boolean): Promise<CommandResult> {
    return this.enqueue(() => this.command({ type: 'stopAfter', at: this.ctx.at(), on }))
  }

  /** 멈춘 Work의 [재개]: 기본 다음 단계를 시작한다 */
  resumeWork(): Promise<CommandResult> {
    return this.enqueue(() => this.command({ type: 'resumeWork', at: this.ctx.at() }))
  }

  /** [Work 포기] */
  abandon(): Promise<CommandResult> {
    return this.enqueue(() => this.command({ type: 'abandon', at: this.ctx.at() }))
  }

  /** Work별 설정 (D72). 검사한 값을 받는다. 질문 방식은 다음에 시작하는 task부터 쓴다 (D73) */
  updateSettings(settings: WorkSettings): Promise<CommandResult> {
    return this.enqueue(() =>
      this.command({
        type: 'settings.update',
        at: this.ctx.at(),
        settings: { ...this.work.settings, ...settings },
      }),
    )
  }

  /**
   * 앱을 다시 켰을 때의 조정 (시나리오 9, D75, D78). 실행 중이던 task는 중단됨이나(유효한 handoff가 있으면)
   * 승인 대기로, 대기열의 task는 중단됨으로 바꾼다. 알리지 않고, 자동으로 재개하거나 승인하지 않는다.
   */
  reconcile(): Promise<void> {
    return this.enqueue(async () => {
      const task = currentTask(this.work)
      const check = task ? this.check(task, await this.files.taskFiles(task)) : null
      await this.feed({ type: 'app.restarted', at: this.ctx.at(), check }, { quiet: true })
    })
  }

  /**
   * 앱을 끝낸다 (시나리오 3-6). 살아 있는 세션은 중단됨으로 남기고 트리째 끝낸다.
   * 대기열의 task는 그대로 두고 다음 실행 때 중단됨으로 바꾼다 (D78).
   */
  shutdown(): Promise<void> {
    return this.enqueue(async () => {
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
    })
  }

  /** 승인 화면(D83)과 Work 완료 화면(시나리오 7-3)에 보일 것. 파일을 다시 읽어 만든다 */
  async review(taskId: string): Promise<ReviewView | null> {
    const task = this.task(taskId)
    if (!task) return null
    const { env } = this.ctx
    const files = await this.files.taskFiles(task)
    const check = this.check(task, files)
    const uncommitted = await statusLines(this.worktree, { env }).catch(() => [])
    const diff = task.start_commit
      ? await diffFrom(this.worktree, task.start_commit, { env }).catch(
          (e: unknown) => `변경을 읽지 못함: ${message(e)}`,
        )
      : ''
    const header = check.handoffHeader
    const handoffText = files[HANDOFF_FILE]
    const gate = (size?: Size) => approvalGate(task, check, size)
    let completion: ReviewView['completion'] = null
    if (task.node === 'verify') {
      const workDiff = await diffFrom(this.worktree, this.work.base_commit, { env }).catch(
        (e: unknown) => `변경을 읽지 못함: ${message(e)}`,
      )
      completion = { verdicts: verdicts(files['verification.md'] ?? ''), diff: clip(workDiff) }
    }
    return {
      workKey: this.key,
      taskId,
      node: task.node,
      label: taskLabel(task),
      taskStatus: task.status,
      reviewable: REVIEWABLE.includes(task.status) && this.work.status === 'active',
      handoffPresent: check.handoff_present,
      handoffStatus: check.status,
      summary: handoffText === undefined ? null : handoffSummary(handoffText),
      decisions: header?.decisions ?? [],
      assumptions: header?.assumptions ?? [],
      risks: header?.risks ?? [],
      errors: check.errors,
      warnings: check.warnings,
      emphasis: emphasis({ node: task.node, handoff: header, errors: check.errors, uncommitted }),
      artifacts: Object.entries(files)
        .filter(([name]) => name !== CONTEXT_FILE && name !== HANDOFF_FILE)
        .map(([name, text]) => ({ name, text })),
      diff: clip(diff),
      draftSize: task.node === 'intake' ? (check.intentDraft?.size ?? null) : null,
      gates: { none: gate(), S: gate('S'), M: gate('M'), L: gate('L') },
      completion,
    }
  }

  // ---------- 터미널 ----------

  terminalKey(taskId: string): string {
    return `${this.key}/${taskId}`
  }

  /** task 터미널의 보관. 이 앱에서 돌지 않은 task는 pty.log로 채운 읽기 전용 보관이다 */
  private async terminalBuffer(task: TaskRecord): Promise<TerminalBuffer> {
    let buffer = this.terminals.get(task.id)
    if (!buffer) {
      const log = await readText(path.join(this.files.taskDir(task), PTY_LOG))
      buffer = TerminalBuffer.fromLog(log ?? '')
      this.terminals.set(task.id, buffer)
    }
    return buffer
  }

  /** 탭이 붙을 때 지금까지의 출력. 끝난 task는 pty.log를 읽어 읽기 전용으로 보인다 */
  async attach(taskId: string): Promise<TerminalBacklog> {
    const task = this.task(taskId)
    if (!task) return { data: '', next: 0, live: false }
    return (await this.terminalBuffer(task)).backlog()
  }

  write(taskId: string, data: string): void {
    this.live.get(taskId)?.pty.write(data)
  }

  resize(taskId: string, cols: number, rows: number): void {
    this.live.get(taskId)?.pty.resize(cols, rows)
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
      badge: badge(w),
      actions: actions(w),
      stopAfterStep: w.stop_after_step === true,
      settings: w.settings,
      baseBranch: w.base_branch,
      baseCommit: w.base_commit,
      intent: w.intent,
      stopNotice: stopNotice(w),
      stopKind: w.status === 'stopped' ? (w.stop?.kind ?? null) : null,
      tasks: w.tasks.map((t) => this.taskView(t)),
      current: currentTask(w)?.id ?? null,
      problems: [...this.problems],
      revision: this.revision,
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
      error: t.error ?? null,
      errorCount: t.check?.errors.length ?? 0,
      bounces: t.bounce_count,
    }
  }
}
