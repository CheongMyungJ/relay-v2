// node-pty 세션과 프로세스 트리 종료 (S1, I32).
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as nodePty from 'node-pty'
import { spawnSpec } from './exec'

const execFileP = promisify(execFile)

export { spawnSpec, type SpawnSpec } from './exec'

export interface PtyOptions {
  bin: string
  args?: string[]
  cwd: string
  env?: NodeJS.ProcessEnv
  cols: number
  rows: number
  /**
   * 터미널에 묻는 DA1(ESC [ c)에 앱이 답하고 출력에서 뺀다. ConPTY는 시작할 때 이것을 묻고,
   * 답이 없으면 크기 변경을 처리하지 않는 것으로 보였다(M0). 탭은 task가 시작된 뒤에 붙으므로
   * 렌더러의 xterm.js 대신 앱이 같은 답을 보낸다.
   */
  answerQueries?: boolean
}

export interface PtySession {
  readonly pid: number
  onData(cb: (data: string) => void): void
  onExit(cb: (exitCode: number) => void): void
  write(data: string): void
  resize(cols: number, rows: number): void
  /** 프로세스 트리를 끝낸다. 이미 끝났으면 아무것도 하지 않는다. */
  killTree(): Promise<void>
}

/** DA1 질의(ESC [ c, ESC [ 0 c)와 xterm.js의 답 */
const DA1_QUERIES = ['\x1b[c', '\x1b[0c']
const DA1_REPLY = '\x1b[?1;2c'

/** 출력에서 DA1 질의를 빼고, 질의마다 답을 보낸다 */
function answerDa1(data: string, reply: (answer: string) => void): string {
  let out = data
  for (const q of DA1_QUERIES) {
    const parts = out.split(q)
    for (let i = 1; i < parts.length; i++) reply(DA1_REPLY)
    out = parts.join('')
  }
  return out
}

export function startPty(opts: PtyOptions): PtySession {
  const { file, args } = spawnSpec(opts.bin, opts.args ?? [])
  const env = { ...process.env, ...opts.env } as Record<string, string>
  // 출처: spikes/lib/session.mjs start (name, useConpty). useConptyDll은 I32.
  const p = nodePty.spawn(file, args, {
    name: 'xterm-256color',
    cols: opts.cols,
    rows: opts.rows,
    cwd: opts.cwd,
    env,
    useConpty: true,
    useConptyDll: true,
  })
  let exited = false
  p.onExit(() => {
    exited = true
  })
  const listeners: ((data: string) => void)[] = []
  p.onData((data) => {
    const out = opts.answerQueries ? answerDa1(data, (a) => p.write(a)) : data
    if (out) for (const cb of listeners) cb(out)
  })
  return {
    pid: p.pid,
    onData: (cb) => void listeners.push(cb),
    onExit: (cb) => void p.onExit((e) => cb(e.exitCode)),
    write: (d) => p.write(d),
    resize: (c, r) => {
      if (!exited) p.resize(c, r)
    },
    killTree: async () => {
      if (exited) return
      await killTree(p.pid, () => p.kill())
    },
  }
}

// Windows에서는 node-pty의 kill() 대신 taskkill로 트리째 끝낸다. kill()은 이미 끝난 콘솔에
// 붙으려다 보조 프로세스가 죽는 일이 있었다. 출처: spikes/lib/session.mjs kill, util.mjs killTree
export async function killTree(pid: number, fallback: () => void): Promise<void> {
  if (process.platform === 'win32') {
    try {
      await execFileP('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true })
      return
    } catch {
      // 이미 끝났으면 taskkill이 실패한다. 아래 kill()로 넘어간다.
    }
  }
  try {
    fallback()
  } catch {
    // 이미 끝난 프로세스
  }
}

export interface ProcessInfo {
  ProcessId: number
  ParentProcessId: number
  Name: string
  Created: string
}

// Windows 프로세스 목록과 시작 시각 (I20). 느리므로(1초 안팎) 드물게 부른다.
// 출처: spikes/lib/util.mjs processes
export async function listProcesses(): Promise<ProcessInfo[]> {
  if (process.platform !== 'win32') return []
  const { stdout } = await execFileP(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,@{n="Created";e={$_.CreationDate.ToString("o")}} | ConvertTo-Json -Compress',
    ],
    { maxBuffer: 64 * 1024 * 1024, windowsHide: true },
  )
  return JSON.parse(stdout) as ProcessInfo[]
}

/**
 * 프로세스의 시작 시각 (D76, I20). 세션을 띄운 직후에만 부른다. listProcesses와 같은 형식("o")이다.
 * Windows가 아니거나 찾지 못하면 undefined. 출처: spikes/lib/util.mjs processes
 */
export async function processStartTime(pid: number): Promise<string | undefined> {
  if (process.platform !== 'win32') return undefined
  try {
    const { stdout } = await execFileP(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CreationDate.ToString("o")`,
      ],
      { windowsHide: true, timeout: 20_000 },
    )
    return stdout.trim() || undefined
  } catch {
    return undefined
  }
}

// 출처: spikes/lib/util.mjs isAlive
export function isAlive(pid: number, created: string | undefined, list: ProcessInfo[]): boolean {
  return list.some((x) => x.ProcessId === pid && (!created || x.Created === created))
}
