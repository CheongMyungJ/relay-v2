// 사람이 터미널에서 대화하는 에이전트 세션(곁 세션 시나리오 11, 기본 세션 시나리오 12)을 띄운다 (I132). 둘은 인자 모양이
// 같아(첫 프롬프트 없음, --append-system-prompt-file, --add-dir) 띄우는 부분을 함께 쓴다: 안내와 설정 파일을 임시 폴더에
// 만들고(I126, I133), PTY를 띄우고, 훅 토큰을 등록한다. 기록과 터미널 보관은 부르는 쪽이 한다.
import { randomBytes } from 'node:crypto'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { agentRuntime, type AgentRuntime } from '../adapters/agent'
import type { HookReply, HookRequest, HookServer } from '../adapters/hooks'
import { startPty, type PtySession } from '../adapters/pty'
import { writeJson } from '../adapters/store'
import type { AgentEngine } from '../shared/agent'

export interface ChatLaunchInput {
  engine: AgentEngine
  env: NodeJS.ProcessEnv
  hooks: HookServer
  /** 훅 URL(/hook/<id>/<Event>)의 id. 토큰으로 세션을 가르므로 여러 세션이 같은 id를 써도 된다 */
  hookId: string
  /** 임시 폴더(relay-<name>-*)와 파일(<name>.settings.json, <name>.guide.md)의 이름 */
  name: string
  cwd: string
  /** 안내 (시스템 프롬프트). Claude는 파일로 주고, Codex는 SessionStart 훅으로 준다 (D391) */
  guide: string
  /** 설정 파일의 내용 */
  settings(driver: AgentRuntime): unknown
  /** 실행 인자 */
  args(driver: AgentRuntime, files: ChatFiles): string[] | Promise<string[]>
  size: { cols: number; rows: number }
  onData(data: string): void
  onExit(): void
  onHook(req: HookRequest): Promise<HookReply>
}

export interface ChatFiles {
  settingsPath: string
  guidePath: string
}

export interface ChatLaunch {
  pty: PtySession
  /** 설정 파일을 둔 임시 폴더. 끝나면 부르는 쪽이 지운다 */
  dir: string
  /** PTY가 끝나면 풀린다 */
  exited: Promise<void>
  /** 훅 토큰을 지운다 */
  unregister: () => void
}

/** 세션을 띄운다. 띄우지 못하면 만든 것(훅 토큰, 프로세스, 임시 폴더)을 치우고 던진다 */
export async function launchChat(input: ChatLaunchInput): Promise<ChatLaunch> {
  let dir: string | null = null
  let pty: PtySession | null = null
  let unregister = () => {}
  try {
    const driver = agentRuntime(input.engine)
    const bin = driver.find(input.env)
    if (!bin) throw new Error(driver.installGuide)
    dir = await fsp.mkdtemp(path.join(os.tmpdir(), `relay-${input.name}-`))
    const files: ChatFiles = {
      settingsPath: path.join(dir, `${input.name}.settings.json`),
      guidePath: path.join(dir, `${input.name}.guide.md`),
    }
    await writeJson(files.settingsPath, input.settings(driver))
    await fsp.writeFile(files.guidePath, input.guide, 'utf8')
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
    let exited!: () => void
    const done = new Promise<void>((r) => (exited = r))
    started.onData(input.onData)
    started.onExit(() => {
      exited()
      input.onExit()
    })
    unregister = input.hooks.register(
      token,
      input.hookId,
      input.onHook,
      // Codex 도구 보호 훅은 main의 오류를 빈 성공으로 번역하지 않는다. 질문창(relay MCP)은 없다 (I130)
      input.engine === 'codex' ? { failClosed: true } : {},
    )
    return { pty: started, dir, exited: done, unregister }
  } catch (err) {
    unregister()
    if (pty) await pty.killTree().catch(() => undefined)
    if (dir) await fsp.rm(dir, { recursive: true, force: true }).catch(() => undefined)
    throw err
  }
}
