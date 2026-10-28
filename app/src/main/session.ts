// 기본 세션 하나 (시나리오 12, D397~D406, I132). 프로젝트나 Work에 매이지 않고 사람이 언제든 열고 닫는 에이전트 세션이다.
// task가 아니므로 파이프라인, handoff, 승인, 세션 상한(D18)과 무관하고 이벤트와 터미널 기록을 남기지 않는다. 기록은
// sessions/<session-id>/session.json이고(D402), 띄우기·훅·끝내기는 곁 세션과 함께 쓴다(main/chat). 목록은 Relay가 가진다.
// 세션 디렉터리의 work-drafts/를 보고 Work 초안을 카드로 보인다 (D404, I135).
import { randomUUID } from 'node:crypto'
import fsp from 'node:fs/promises'
import path from 'node:path'
import type { HookReply, HookRequest, HookServer } from '../adapters/hooks'
import { processStartTime } from '../adapters/pty'
import { saveSession } from '../adapters/store'
import { codexSessionToolDenial } from '../core/codex'
import { DRAFTS_DIR } from '../core/draft'
import { clipSessionName, sessionGuide, sessionName, type SessionGuideWork } from '../core/session'
import { SESSION_HOOK_ID } from '../core/settings'
import { AGENT_LABELS, resolveAgent, type AgentEngine } from '../shared/agent'
import type { AppConfig } from '../shared/config'
import type { ProjectState } from '../shared/project'
import { NEW_SESSION_NAME, type SessionRecord } from '../shared/session'
import type { CommandResult, SessionView, TerminalBacklog, TerminalChunk } from '../shared/views'
import {
  chatHook,
  chatMark,
  chatNotice,
  chatSession,
  dropAux,
  killAux,
  openChat,
  type ChatSession,
} from './chat'
import { noBacklog, type TerminalBuffer } from './terminals'
import { DraftFolder } from './drafts'

export interface SessionContext {
  /** RELAY_HOME. --add-dir로 붙인다 (D399) */
  home: string
  /** 앱에 묶은 사용자 문서 (I134) */
  readme: string
  env: NodeJS.ProcessEnv
  hooks: HookServer
  config: () => AppConfig
  at: () => string
  size: () => { cols: number; rows: number }
  /** 등록된 프로젝트 (초안 검사, 안내) */
  projects: () => readonly ProjectState[]
  /** 열 때의 Work (안내) */
  works: () => readonly SessionGuideWork[]
  /** 모든 기본 세션의 id (Codex 도구 보호, D401) */
  sessionIds: () => readonly string[]
  /** 터미널 출력 */
  terminal: (key: string, chunk: TerminalChunk) => void
  /** 이 세션의 화면이 바뀌었다 */
  changed: () => void
}

const NAME = '기본 세션'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** 살아 있는 동안의 프로세스를 뺀 기록 */
function withoutProcess(r: SessionRecord): SessionRecord {
  const out = { ...r }
  delete out.process
  return out
}

/** 폴더가 있는가 (D398) */
async function isDir(p: string): Promise<boolean> {
  return fsp.stat(p).then(
    (st) => st.isDirectory(),
    () => false,
  )
}

export class SessionRunner {
  /** 터미널 키의 앞부분: sessions/<session-id>. 프로젝트 id는 늘 -<해시>로 끝나 겹치지 않는다 */
  readonly key: string
  private queue: Promise<unknown> = Promise.resolve()
  private chat: ChatSession | null = null
  private seq = 0
  private readonly terminals = new Map<string, TerminalBuffer>()
  private readonly drafts: DraftFolder
  /** [지우기]로 세션 디렉터리를 지우는 중이거나 지웠다. 더는 기록을 쓰지 않고 명령을 받지 않는다 */
  private removed = false

  constructor(
    private readonly ctx: SessionContext,
    public record: SessionRecord,
    /** 세션 디렉터리 (sessions/<session-id>) */
    readonly dir: string,
  ) {
    this.key = `sessions/${record.id}`
    this.drafts = new DraftFolder({
      dir: path.join(dir, DRAFTS_DIR),
      source: { kind: 'session', id: record.id },
      projectIds: () => this.ctx.projects().map((p) => p.project_id),
      changed: () => this.ctx.changed(),
      live: () => !this.removed,
    })
  }

  get draftsDir(): string {
    return this.drafts.dir
  }

  /** 초안 폴더를 만들고 보기 시작한다 (I135). 바뀌면 다시 읽어 화면에 넣는다 */
  async start(): Promise<void> {
    await this.watchDrafts()
    await this.refreshDrafts()
  }

  /**
   * 초안 폴더를 (다시) 만들고 새로 본다. 감시는 폴더가 지워졌다 다시 생기거나 시작에 실패하면 알리지 않으므로(watchDir),
   * 사람의 요청과 [열기] 때마다 다시 건다
   */
  private watchDrafts(): Promise<void> {
    return this.drafts.watch()
  }

  /** 이벤트를 하나씩 처리한다 */
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn)
    this.queue = run.catch(() => undefined)
    return run
  }

  private async save(): Promise<void> {
    // 지운 세션의 기록을 되살리지 않는다
    if (this.removed) return
    await saveSession(this.ctx.home, this.record)
    this.ctx.changed()
  }

  hasLiveSession(): boolean {
    return this.chat?.status === 'live'
  }

  /** 재시작 조정 (D76, D402): 적어 둔 프로세스는 끝냈거나 이미 없으므로 지운다. 대화는 남긴다 */
  async reconcile(): Promise<void> {
    if (!this.record.process) return
    this.record = withoutProcess(this.record)
    await this.save()
  }

  // ---------- 열기와 닫기 (시나리오 12-6) ----------

  /** 이어 갈 대화: 적어 둔 대화가 있고 그 엔진이 지금 설정의 엔진과 같다 (D399) */
  private resumeId(engine: AgentEngine): string | null {
    const r = this.record
    return r.session_id !== undefined && (r.engine ?? 'claude') === engine ? r.session_id : null
  }

  /**
   * [열기]·[새 대화로 열기] (시나리오 12-6). 엔진·모델·추론 수준은 열 때의 설정이다(D399). 적어 둔 대화가 있고 그 엔진이
   * 같으면 이어 가고, fresh거나 없거나 엔진이 다르면 새 대화다. 폴더가 없으면 띄우지 않는다 (D398). 세션 상한을 거치지
   * 않는다 (D397)
   */
  open(fresh: boolean): Promise<CommandResult> {
    return this.enqueue(async () => {
      if (this.removed) return { ok: false, error: '지운 기본 세션임' }
      if (this.chat?.status === 'live') return { ok: false, error: '기본 세션이 이미 열려 있음' }
      if (!(await isDir(this.record.cwd)))
        return {
          ok: false,
          error: `폴더가 없어 열지 않음: ${this.record.cwd}. 폴더는 만든 뒤 바꾸지 않으니 폴더를 되살리거나 새 세션을 만드세요`,
        }
      await this.watchDrafts().catch(() => undefined)
      void this.refreshDrafts()
      return this.launch(fresh)
    })
  }

  private async launch(fresh: boolean): Promise<CommandResult> {
    const config = this.ctx.config()
    const agent = resolveAgent(config, 'session')
    const previous = fresh ? null : this.resumeId(agent.engine)
    const resume = previous !== null
    // Claude는 새 대화의 id를 정해 준다. Codex는 훅이 알려 주는 id를 첫 요청 때 적는다 (D391과 같음)
    const sessionId = previous ?? randomUUID()
    const id = `session-${++this.seq}`
    const c = chatSession(
      id,
      agent.engine,
      sessionGuide({
        home: this.ctx.home,
        readme: this.ctx.readme,
        cwd: this.record.cwd,
        draftsDir: this.draftsDir,
        projects: this.ctx.projects(),
        works: this.ctx.works(),
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
        session: c,
        env: this.ctx.env,
        hooks: this.ctx.hooks,
        hookId: SESSION_HOOK_ID,
        name: 'session',
        cwd: this.record.cwd,
        settings: (driver) =>
          driver.sessionSettings({ port: this.ctx.hooks.port, home: this.ctx.home, ...model }),
        args: (driver, files) =>
          driver.sessionArgs({ sessionId, resume, home: this.ctx.home, ...files, ...model }),
        size: this.ctx.size(),
        terminals: this.terminals,
        terminalKey: this.terminalKey(id),
        mark: chatMark(NAME, resume),
        output: (key, chunk) => this.ctx.terminal(key, chunk),
        onExit: () => void this.enqueue(() => this.onExit(c)),
        onHook: (req) => this.hook(c, req),
      })
    } catch (err) {
      return { ok: false, error: `기본 세션을 열지 못함: ${message(err)}` }
    }
    // 끝난 앞 세션의 터미널은 새 터미널로 바꾼다
    if (this.chat) this.terminals.delete(this.chat.id)
    this.chat = c
    this.ctx.changed()
    // 살아 있는 동안 프로세스 ID와 시작 시각을 적는다. 앱이 충돌한 뒤 살아남으면 재시작 때 끝낸다 (D402)
    const startedAt = await processStartTime(pid)
    if (this.chat === c && !c.handled) {
      this.record = {
        ...this.record,
        process: {
          pid,
          ...(startedAt ? { process_started_at: startedAt } : {}),
          started_at: this.ctx.at(),
        },
      }
      await this.save()
    }
    return { ok: true }
  }

  /** 훅 (D401): 함께 쓰는 처리(chatHook)에 기본 세션의 도구 보호와 기록 적기를 준다 */
  private hook(c: ChatSession, req: HookRequest): Promise<HookReply> {
    return chatHook(c, req, {
      current: () => this.chat === c,
      changed: () => this.ctx.changed(),
      toolReply: (r, allowPush) => this.toolReply(r, allowPush),
      conversation: (sessionId, prompt) =>
        void this.enqueue(async () => {
          if (this.chat !== c || c.handled) return
          await this.conversation(c, sessionId, prompt)
          // 사람이 요청할 때마다 초안 폴더를 다시 걸고 읽는다: 감시를 놓쳤어도 다음 요청에 카드가 맞는다 (I140)
          await this.watchDrafts().catch(() => undefined)
          void this.refreshDrafts()
        }),
    })
  }

  /** 요청마다 다시 열 대화를 적고, 이름이 없으면 첫 요청으로 짓는다(앱이 짓는 것은 한 번뿐, D403) */
  private async conversation(c: ChatSession, sessionId: string, prompt?: string): Promise<void> {
    const r = this.record
    // 녹화본이 없는 Codex처럼 prompt가 없으면 이름을 짓지 않는다 (D403)
    const name = r.name === undefined && prompt !== undefined ? sessionName(prompt) : null
    if (r.session_id === sessionId && r.engine === c.engine && !name) return
    this.record = {
      ...r,
      ...(name ? { name, named_by: 'app' as const } : {}),
      engine: c.engine,
      session_id: sessionId,
    }
    await this.save()
  }

  /** Codex PreToolUse의 도구 보호 (D401, I141) */
  private toolReply(req: HookRequest, allowPush: boolean): HookReply {
    const b = req.body
    const args = b['tool_input']
    const cwd = typeof b['cwd'] === 'string' ? b['cwd'] : undefined
    const reason = codexSessionToolDenial(
      {
        home: this.ctx.home,
        cwd: this.record.cwd,
        ...(cwd ? { hookCwd: cwd } : {}),
        sessionIds: this.ctx.sessionIds(),
        allowPush,
      },
      typeof b['tool_name'] === 'string' ? b['tool_name'] : '',
      typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {},
    )
    return reason
      ? {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: reason,
          },
        }
      : null
  }

  /** 세션이 스스로 끝났다(/exit, 이어 갈 대화를 찾지 못함) */
  private async onExit(c: ChatSession): Promise<void> {
    if (this.chat !== c || c.handled) return
    await this.release(c)
  }

  /** 걸어 둔 것을 푼다(dropAux)와 적어 둔 프로세스. 끝난 것으로 둔다 */
  private async release(c: ChatSession): Promise<void> {
    c.status = 'ended'
    await dropAux(c, this.terminals)
    if (this.record.process) {
      this.record = withoutProcess(this.record)
      await this.save()
    }
    this.ctx.changed()
  }

  /** 살아 있는 세션의 프로세스 트리를 끝내고 기다린 뒤 푼다 */
  private async end(): Promise<void> {
    const c = this.chat
    if (!c || c.handled) return
    await killAux(c)
    await this.release(c)
  }

  /** [닫기] (시나리오 12-6). 탭은 끝난 터미널로 남는다 */
  close(): Promise<CommandResult> {
    return this.enqueue(async () => {
      if (this.chat?.status !== 'live') return { ok: false, error: '기본 세션이 열려 있지 않음' }
      await this.end()
      return { ok: true }
    })
  }

  /** 앱을 끝낸다 (D406). 살아 있으면 끝내고, 초안 폴더를 그만 본다 */
  shutdown(): Promise<void> {
    this.drafts.stop()
    return this.enqueue(() => this.end())
  }

  // ---------- 이름과 지우기 (시나리오 12-7) ----------

  /** [이름 바꾸기] (D403): 같은 20자 제한. 사람이 고친 이름은 앱이 다시 바꾸지 않는다 */
  rename(name: string): Promise<CommandResult> {
    return this.enqueue(async () => {
      if (this.removed) return { ok: false, error: '지운 기본 세션임' }
      const clipped = clipSessionName(name.replace(/\s*[\r\n]+\s*/g, ' '))
      if (!clipped) return { ok: false, error: '이름을 입력하세요' }
      this.record = { ...this.record, name: clipped, named_by: 'human' }
      await this.save()
      return { ok: true }
    })
  }

  /**
   * [지우기] (D402): 끝난 세션만. 세션 디렉터리와 초안을 지운다(CLI의 대화 파일과 고른 폴더는 그대로). 지우는 동안과 지운
   * 뒤에는 기록을 쓰지 않는다. 지우지 못하면 세션을 되살리고 초안 폴더를 다시 본다
   */
  remove(): Promise<CommandResult> {
    return this.enqueue(async () => {
      if (this.removed) return { ok: false, error: '지운 기본 세션임' }
      if (this.chat?.status === 'live')
        return { ok: false, error: '열려 있는 기본 세션은 지울 수 없음. 먼저 닫으세요' }
      this.removed = true
      this.drafts.stop()
      try {
        await fsp.rm(this.dir, { recursive: true, force: true })
      } catch (e) {
        this.removed = false
        // 일부만 지웠으면 기록을 다시 쓰고 초안 폴더를 다시 본다
        await this.save().catch(() => undefined)
        await this.start().catch(() => undefined)
        return { ok: false, error: `세션 디렉터리를 지우지 못함: ${message(e)}` }
      }
      return { ok: true }
    })
  }

  // ---------- Work 초안 (D404, I135) ----------

  /** 초안 폴더를 다시 읽는다. 읽는 중에 또 바뀌면 끝난 뒤 한 번 더 읽는다 */
  refreshDrafts(): Promise<void> {
    return this.drafts.refresh()
  }

  /** 초안을 지운다: [버리기], 그 초안으로 Work를 만든 뒤 (D404) */
  removeDraft(name: string): Promise<CommandResult> {
    return this.drafts.remove(name)
  }

  // ---------- 화면 ----------

  view(): SessionView {
    const c = this.chat
    // 열린 세션은 그 엔진, 아니면 지금 열 때 쓸 설정의 엔진이다 (D399)
    const next = resolveAgent(this.ctx.config(), 'session').engine
    const engine = c?.status === 'live' ? c.engine : next
    return {
      id: this.record.id,
      name: this.record.name ?? NEW_SESSION_NAME,
      cwd: this.record.cwd,
      created_at: this.record.created_at,
      engineLabel: AGENT_LABELS[engine],
      status: c?.status ?? null,
      terminal: c ? this.terminalKey(c.id) : null,
      resumable: this.resumeId(next) !== null,
      ...(c ? chatNotice(c, NAME) : {}),
      drafts: this.drafts.list,
    }
  }

  // ---------- 터미널 ----------

  terminalKey(id: string): string {
    return `${this.key}/${id}`
  }

  async attach(id: string): Promise<TerminalBacklog> {
    return this.terminals.get(id)?.backlog() ?? noBacklog()
  }

  private ptyOf(id: string) {
    const c = this.chat
    return c?.id === id && c.status === 'live' ? (c.pty ?? undefined) : undefined
  }

  write(id: string, data: string): void {
    this.ptyOf(id)?.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    const pty = this.ptyOf(id)
    if (!pty) return
    pty.resize(cols, rows)
    this.terminals.get(id)?.resized({ cols, rows })
  }

  cwd(): string {
    return this.record.cwd
  }
}
