// 사람이 터미널에서 대화하는 보조 세션의 공통 부분 (I132, I137). 정리 세션(7-5)은 끝내기만, 곁 세션(시나리오 11)과 기본
// 세션(시나리오 12)은 띄우기부터 훅 처리, 머리 띠 안내, 끝내기까지 함께 쓴다: 둘은 인자 모양(첫 프롬프트 없음,
// --append-system-prompt-file, --add-dir)과 훅(Claude는 UserPromptSubmit, Codex는 SessionStart의 안내와 도구 보호)이 같고
// 기록하는 곳만 다르다(work.json의 side, session.json). 기록과 이어 갈 대화는 부르는 쪽(WorkRunner, SessionRunner)이 한다.
import { randomBytes } from 'node:crypto'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { agentRuntime, type AgentRuntime } from '../adapters/agent'
import type { HookReply, HookRequest, HookServer } from '../adapters/hooks'
import { startPty, type PtySession } from '../adapters/pty'
import { writeJson } from '../adapters/store'
import type { AgentEngine } from '../shared/agent'
import type { TerminalChunk } from '../shared/views'
import { promptSnapshotOff } from '../core/settings'
import { TerminalBuffer } from './terminals'

/**
 * task가 아닌 보조 세션(정리 세션, 곁 세션, 기본 세션)의 공통 부분. events.jsonl, pty.log에 남기지 않고 앱을 다시 켜면 없다.
 * 끝내는 순서(트리 종료 → 기다림 → 훅 토큰·임시 폴더 풀기)는 killAux와 dropAux가 같이 한다
 */
export interface AuxSession {
  /** 터미널 id: cleanup-<n>, side-<n>, session-<n>. 다시 열면 새 터미널이다 */
  id: string
  /** Codex 훅을 한 번이라도 받았다. 받기 전에는 훅 신뢰 안내를 보인다 */
  hooksReady: boolean
  pty: PtySession | null
  exited: Promise<void> | null
  unregister: () => void
  /** 설정 파일을 둔 임시 폴더 */
  dir: string | null
  /** 끝난 세션을 앱이 이미 처리했다. 늦게 온 PTY 종료는 무시한다 */
  handled: boolean
  /** 앱이 끝내는 중이다. 이 세션의 훅은 줄에 넣지 않고 바로 답한다 (D231) */
  ending: boolean
}

/**
 * 곁 세션과 기본 세션 (D385~D392, D397~D406): 사람이 언제든 여는 에이전트 세션. 세션 상한(D18)을 거치지 않는다. 사람이 그
 * 터미널에서 대화하므로 앱 질문창은 없다 (I130)
 */
export interface ChatSession extends AuxSession {
  /** 열 때 설정에서 정한 엔진 (D391, D399) */
  engine: AgentEngine
  /** 안내 (D387, D400). Claude는 시스템 프롬프트 파일로, Codex는 SessionStart 훅으로 준다 (D391) */
  guide: string
  /**
   * 안내가 대화에 들어갔다. Claude는 실행 인자로 늘 들어간다. Codex는 SessionStart 훅에 안내를 돌려준 뒤다: 훅을 신뢰하기
   * 전에 지나간 SessionStart는 오지 않으므로, 그 대화는 닫고 다시 열어야 안내가 들어간다. 그때까지 push와 PR 조작은 막는다
   */
  guided: boolean
  status: 'live' | 'ended'
}

const KILL_WAIT_MS = 10_000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const str = (v: unknown) => (typeof v === 'string' ? v : undefined)

/** 새 대화 세션의 기록. 띄우기 전이다 */
export function chatSession(id: string, engine: AgentEngine, guide: string): ChatSession {
  return {
    id,
    engine,
    guide,
    hooksReady: false,
    // Claude는 실행 인자(--append-system-prompt-file)로 안내가 들어간다
    guided: engine === 'claude',
    status: 'live',
    pty: null,
    exited: null,
    unregister: () => {},
    dir: null,
    handled: false,
    ending: false,
  }
}

/** 세션의 출력 앞에 넣는 줄. 이어 가면 CLI가 앞 대화를 다시 그린다 (D406) */
export const chatMark = (name: string, resume: boolean) =>
  `\x1b[0m\x1b[2m── relay: ${name} · ${resume ? '앞 대화를 이어 갑니다 (--resume)' : '새 대화'} ──\x1b[0m\r\n`

export interface ChatFiles {
  settingsPath: string
  guidePath: string
  /** 다시 열 때 새 안내가 바로 쓰이게 하는가 (D446). Claude Code의 버전으로 정한다 */
  refreshGuide: boolean
}

export interface ChatOpenInput {
  session: ChatSession
  env: NodeJS.ProcessEnv
  hooks: HookServer
  /** 훅 URL(/hook/<id>/<Event>)의 id. 토큰으로 세션을 가르므로 여러 세션이 같은 id를 써도 된다 */
  hookId: string
  /** 임시 폴더(relay-<이름>-*)와 파일(<이름>.settings.json, <이름>.guide.md)의 이름 */
  name: string
  cwd: string
  /** 설정 파일의 내용 */
  settings(driver: AgentRuntime): unknown
  /** 실행 인자 */
  args(driver: AgentRuntime, files: ChatFiles): string[] | Promise<string[]>
  size: { cols: number; rows: number }
  /** 터미널 보관. 이 세션의 터미널(session.id)을 새로 둔다 */
  terminals: Map<string, TerminalBuffer>
  terminalKey: string
  /** 출력 앞에 넣는 줄 (chatMark) */
  mark: string
  output(key: string, chunk: TerminalChunk): void
  onExit(): void
  onHook(req: HookRequest): Promise<HookReply>
}

/**
 * 세션을 띄운다 (I126, I133): 엔진의 실행 파일 찾기, 임시 폴더에 안내와 설정 파일, 실행 인자, PTY, 훅 토큰 등록. 터미널
 * 보관을 새로 두고 PTY와 임시 폴더를 세션에 적는다. 띄우지 못하면 만든 것(훅 토큰, 프로세스, 임시 폴더, 터미널 보관)을 치우고
 * 던진다. 돌려주는 것은 프로세스 ID다
 */
export async function openChat(input: ChatOpenInput): Promise<number> {
  const s = input.session
  const buffer = new TerminalBuffer()
  buffer.live = true
  buffer.push(input.mark)
  input.terminals.set(s.id, buffer)
  let dir: string | null = null
  let pty: PtySession | null = null
  let unregister = () => {}
  try {
    const driver = agentRuntime(s.engine)
    const bin = driver.find(input.env)
    if (!bin) throw new Error(driver.installGuide)
    dir = await fsp.mkdtemp(path.join(os.tmpdir(), `relay-${input.name}-`))
    // --system-prompt-snapshot은 2.1.257에 생겨 그보다 낮은 claude에는 주지 않는다 (D446). Codex는 쓰지 않는다
    const version =
      driver.engine === 'claude' ? await driver.version(bin, input.env).catch(() => null) : null
    const files: ChatFiles = {
      settingsPath: path.join(dir, `${input.name}.settings.json`),
      guidePath: path.join(dir, `${input.name}.guide.md`),
      refreshGuide: promptSnapshotOff(version),
    }
    await writeJson(files.settingsPath, input.settings(driver))
    await fsp.writeFile(files.guidePath, s.guide, 'utf8')
    const args = await input.args(driver, files)
    const token = randomBytes(32).toString('hex')
    const started = startPty({
      bin,
      args,
      cwd: input.cwd,
      env: { ...input.env, ...driver.launchEnv(token, input.hooks.port, input.hookId) },
      cols: input.size.cols,
      rows: input.size.rows,
      answerQueries: true,
    })
    pty = started
    buffer.ptySize = { ...input.size }
    let exited!: () => void
    s.exited = new Promise<void>((r) => (exited = r))
    s.pty = started
    started.onData((data) => {
      if (!s.handled) input.output(input.terminalKey, buffer.push(data))
    })
    started.onExit(() => {
      exited()
      input.onExit()
    })
    unregister = input.hooks.register(
      token,
      input.hookId,
      input.onHook,
      // Codex 도구 보호 훅은 main의 오류를 빈 성공으로 번역하지 않는다. 질문창(relay MCP)은 없다 (I130)
      s.engine === 'codex' ? { failClosed: true } : {},
    )
    s.unregister = unregister
    s.dir = dir
    return started.pid
  } catch (err) {
    s.handled = true
    unregister()
    if (pty) await pty.killTree().catch(() => undefined)
    if (dir) await fsp.rm(dir, { recursive: true, force: true }).catch(() => undefined)
    input.terminals.delete(s.id)
    throw err
  }
}

export interface ChatHookHandlers {
  /** 이 세션이 아직 주인의 지금 세션이다 */
  current(): boolean
  /** 화면이 바뀌었다 (훅 신뢰, 안내가 들어감) */
  changed(): void
  /** Codex PreToolUse의 도구 보호. allowPush는 안내가 들어갔는지다 (D388, D401) */
  toolReply(req: HookRequest, allowPush: boolean): HookReply
  /** 사람의 요청이 왔다. 다시 열 대화를 적는다. prompt는 본문에 있을 때만 온다 (D389, D401, D403) */
  conversation(sessionId: string, prompt: string | undefined): void
}

/**
 * 훅 (D388, D391, D401). 처리 줄에 넣지 않고 바로 답해 사람의 요청과 도구를 붙잡지 않는다. 기록은 conversation이 줄에
 * 넣는다. Claude는 UserPromptSubmit만 온다. Codex는 SessionStart에 안내를 돌려주고 도구 보호를 한다: 안내가 들어간 뒤에는
 * push와 PR 조작을 막지 않는다. 질문은 터미널에서 평문으로 하므로 질문 처리는 없다 (I130)
 */
export function chatHook(
  s: ChatSession,
  req: HookRequest,
  h: ChatHookHandlers,
): Promise<HookReply> {
  if (!h.current() || s.status !== 'live' || s.ending) return Promise.resolve(null)
  const codex = s.engine === 'codex'
  if (codex && !s.hooksReady) {
    s.hooksReady = true
    h.changed()
  }
  // 서브에이전트의 신호는 대화를 바꾸지 않는다. 도구 보호는 서브에이전트에도 건다
  if (codex && str(req.body['agent_id']) !== undefined && req.event !== 'PreToolUse')
    return Promise.resolve(null)
  if (codex && req.event === 'PreToolUse') return Promise.resolve(h.toolReply(req, s.guided))
  if (codex && req.event === 'SessionStart') {
    // startup, resume, clear, compact 모두 안내를 다시 넣는다 (Codex task와 같음)
    if (!s.guided) {
      s.guided = true
      h.changed()
    }
    return Promise.resolve({
      hookSpecificOutput: { hookEventName: req.event, additionalContext: s.guide },
    })
  }
  const sessionId = str(req.body['session_id'])
  if (req.event === 'UserPromptSubmit' && sessionId)
    h.conversation(sessionId, str(req.body['prompt']))
  return Promise.resolve(null)
}

/**
 * Codex 세션의 안내가 아직 대화에 들어가지 않았을 때의 머리 띠 안내 (D391). 훅을 신뢰하기 전에 지나간 SessionStart는 다시
 * 오지 않으므로 닫고 다시 열어야 들어간다. name은 "곁 세션", "기본 세션"이다
 */
export function chatNotice(s: ChatSession, name: string): { notice?: string } {
  if (s.status !== 'live' || s.guided) return {}
  return {
    notice: s.hooksReady
      ? `이 대화에는 ${name} 안내가 들어가지 않았습니다(훅을 신뢰하기 전에 시작됨). ${name}을 닫고 다시 여세요. 그때까지 push와 PR 조작은 막습니다.`
      : `Codex 터미널의 폴더 신뢰 확인 후 /hooks로 relay 훅을 검토·신뢰한 뒤 ${name}을 닫고 다시 여세요. 그래야 ${name} 안내가 들어갑니다.`,
  }
}

/** 보조 세션의 프로세스 트리를 끝내고 기다린다. 끝내는 중의 훅은 바로 답한다 (D231) */
export async function killAux(s: AuxSession): Promise<void> {
  if (!s.pty) return
  s.ending = true
  await s.pty.killTree()
  await Promise.race([s.exited, sleep(KILL_WAIT_MS)])
}

/** 보조 세션에 걸어 둔 것을 푼다: 훅 토큰, 터미널의 살아 있음, 임시 폴더. 끝난 것으로 둔다 */
export async function dropAux(
  s: AuxSession,
  terminals: Map<string, TerminalBuffer>,
): Promise<void> {
  s.handled = true
  s.unregister()
  const buffer = terminals.get(s.id)
  if (buffer) buffer.live = false
  if (s.dir) await fsp.rm(s.dir, { recursive: true, force: true }).catch(() => undefined)
  s.dir = null
}
