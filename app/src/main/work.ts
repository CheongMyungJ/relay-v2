// Work 하나의 흐름 (시나리오 2~7). 훅 신호, 사람 버튼, 프로세스 종료, 감시를 이벤트로 바꿔
// core/machine에 넣고, 전이마다 work.json을 쓰고(I11) 돌려받은 할 일을 차례로 실행한다.
// 이벤트는 Work마다 한 줄로 처리한다. 할 일(task 시작 등)이 끝날 때까지 다음 이벤트는 기다린다.
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
import { REVIEWABLE, approvalGate } from '../core/approval'
import { buildContext, previousInputs, type PreviousTask } from '../core/context'
import { currentTask, transition, type Effect, type MachineEvent } from '../core/machine'
import { NODE_INFO } from '../core/pipeline'
import { confirmedIntent, decisionsBlock } from '../core/records'
import {
  TASK_STATUS_LABEL,
  WORK_STATUS_LABEL,
  bandText,
  emphasis,
  handoffSummary,
  permissionNotice,
  stopNotice,
  taskLabel,
  verdicts,
} from '../core/review'
import { launchArgs, launchEnv, taskSettings } from '../core/settings'
import { HANDOFF_FILE, INTENT_DRAFT_FILE, checkTask, type TaskCheck } from '../core/validate'
import type { AppConfig } from '../shared/config'
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
const MAX_DIFF_CHARS = 2_000_000
const KILL_WAIT_MS = 10_000

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

  /** 이 앱에서 살아 있는 세션이 있다. M2는 한 번에 Work 하나만 진행한다 */
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
  private async feed(event: MachineEvent) {
    const t = transition(this.work, event, this.ctx.config())
    const reply = await this.apply(t.work, t.effects)
    return { t, reply }
  }

  /**
   * 새 상태를 work.json에 쓰고(I11) 할 일을 차례로 실행한다.
   * blockStop이 있으면 Stop 요청에 돌려줄 응답을 돌려준다 (D21, S2).
   */
  async apply(work: WorkState, effects: readonly Effect[]): Promise<HookReply> {
    if (work === this.work && effects.length === 0) return null
    this.work = work
    await this.files.save(work)
    this.changed()
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
        await this.startTask(e.taskId)
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

  // ---------- task 시작 (시나리오 2) ----------

  /**
   * task 디렉터리와 시작 커밋, 스킬 배포, 설정 파일, context.md, PTY 실행 (시나리오 2).
   * PTY를 띄운 직후 첫 훅보다 먼저 session.started를 넣는다. 훅은 이 처리가 끝날 때까지 줄에서 기다린다.
   */
  private async startTask(taskId: string): Promise<void> {
    const task = this.task(taskId)
    if (!task) return
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

      const previous = this.work.tasks.filter((t) => t.seq < task.seq && t.status === 'approved')
      const settingsPath = path.join(dir, SETTINGS_FILE)
      const token = randomBytes(32).toString('hex')
      await writeJson(
        settingsPath,
        taskSettings({
          port: this.ctx.hooks.port,
          taskId: task.id,
          workDir: this.files.dir,
          previousTaskDirs: previous.map((t) => this.files.taskDir(t)),
        }),
      )
      const contextPath = path.join(dir, CONTEXT_FILE)
      await writeFileAtomic(contextPath, await this.context(task, dir, previous))

      const sessionId = randomUUID()
      const session = this.launch(task, bin, token, {
        sessionId,
        workDir: this.files.dir,
        settingsPath,
        skill,
        contextPath,
      })
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
    } catch (err) {
      // PTY를 띄운 뒤에 실패했으면 남기지 않는다
      await this.endSession(taskId)
      await this.feed({ type: 'session.failed', taskId, at: this.ctx.at(), error: message(err) })
    }
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

  /** PTY로 claude를 띄우고 훅 토큰, 감시, pty.log를 건다 (시나리오 2-5, I13, I15) */
  private launch(
    task: TaskRecord,
    bin: string,
    token: string,
    args: Parameters<typeof launchArgs>[0],
  ): LiveSession {
    const log = this.files.openPtyLog(task)
    const buffer = new TerminalBuffer()
    this.terminals.set(task.id, buffer)
    const key = this.terminalKey(task.id)
    const { cols, rows } = this.ctx.size()
    const pty = startPty({
      bin,
      args: launchArgs(args),
      cwd: this.worktree,
      env: { ...this.ctx.env, ...launchEnv(token) },
      cols,
      rows,
      answerQueries: true,
    })
    let exited!: () => void
    const session: LiveSession = {
      pty,
      log,
      unregister: () => {},
      unwatch: () => {},
      exited: new Promise((r) => (exited = r)),
      turnFiles: turnSnapshot(task, {}),
      stopped: false,
    }
    pty.onData((data) => {
      log.write(data)
      this.ctx.ui.terminal(key, buffer.push(data))
    })
    pty.onExit(() => {
      buffer.live = false
      exited()
      void this.enqueue(() => this.onExit(task.id))
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

  private async onExit(taskId: string): Promise<void> {
    await this.release(taskId)
    await this.feed({ type: 'pty.exit', taskId, at: this.ctx.at() })
  }

  /** 세션에 걸어 둔 것을 푼다: 훅 토큰, 감시, pty.log */
  private async release(taskId: string): Promise<void> {
    const session = this.live.get(taskId)
    if (!session || session.stopped) return
    session.stopped = true
    session.unregister()
    session.unwatch()
    this.live.delete(taskId)
    await session.log.close()
    this.changed()
  }

  /** 세션의 프로세스 트리를 끝내고 pty.log를 닫는다 (시나리오 5-1, 7절) */
  private async endSession(taskId: string): Promise<void> {
    const session = this.live.get(taskId)
    if (!session) return
    await session.pty.killTree()
    await Promise.race([session.exited, sleep(KILL_WAIT_MS)])
    await this.release(taskId)
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

  /** [승인], [의도 승인], [Work 완료]([완료만]), [오류 무시하고 승인] (시나리오 4-3, 4.1) */
  approve(taskId: string, opts: ApproveOptions): Promise<CommandResult> {
    return this.enqueue(async () => {
      const task = this.task(taskId)
      if (!task) return { ok: false, error: `${taskId} 없음` }
      const check = this.check(task, await this.files.taskFiles(task))
      const { t } = await this.feed({
        type: 'approve',
        taskId,
        at: this.ctx.at(),
        check,
        ...(opts.size ? { size: opts.size } : {}),
        ...(opts.force ? { force: true } : {}),
      })
      if (t.rejected) return { ok: false, error: t.rejected }
      const notice = stopNotice(this.work)
      if (notice) this.ctx.ui.notify({ title: `relay: ${this.title}`, body: notice })
      return { ok: true }
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
      reviewable: REVIEWABLE.includes(task.status),
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

  /** 탭이 붙을 때 지금까지의 출력. 이 앱에서 돌지 않은 task는 pty.log를 읽는다 */
  async attach(taskId: string): Promise<TerminalBacklog> {
    let buffer = this.terminals.get(taskId)
    if (!buffer) {
      const task = this.task(taskId)
      const log = task ? await readText(path.join(this.files.taskDir(task), 'pty.log')) : null
      buffer = TerminalBuffer.fromLog(log ?? '')
      this.terminals.set(taskId, buffer)
    }
    return buffer.backlog()
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
      baseBranch: w.base_branch,
      baseCommit: w.base_commit,
      intent: w.intent,
      stopNotice: stopNotice(w),
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
      error: t.error ?? null,
      errorCount: t.check?.errors.length ?? 0,
      bounces: t.bounce_count,
    }
  }

  /** 앱을 끝낼 때 살아 있는 세션의 프로세스 트리를 끝낸다. 재시작 처리는 M3에서 넣는다 */
  async shutdown(): Promise<void> {
    await Promise.all([...this.live.keys()].map((id) => this.endSession(id)))
  }
}
