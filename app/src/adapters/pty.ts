// node-pty 세션과 프로세스 트리 종료 (S1, I32).
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as nodePty from 'node-pty'

const execFileP = promisify(execFile)

export interface SpawnSpec {
  file: string
  args: string[]
}

// npm 전역 설치의 claude.cmd는 ConPTY가 바로 실행하지 못해 cmd.exe로 감싼다.
// 출처: spikes/lib/session.mjs start
export function spawnSpec(bin: string, args: string[]): SpawnSpec {
  if (bin.toLowerCase().endsWith('.cmd')) {
    return { file: 'cmd.exe', args: ['/d', '/s', '/c', bin, ...args] }
  }
  return { file: bin, args }
}

export interface PtyOptions {
  bin: string
  args?: string[]
  cwd: string
  env?: NodeJS.ProcessEnv
  cols: number
  rows: number
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
  return {
    pid: p.pid,
    onData: (cb) => void p.onData(cb),
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

// 출처: spikes/lib/util.mjs isAlive
export function isAlive(pid: number, created: string | undefined, list: ProcessInfo[]): boolean {
  return list.some((x) => x.ProcessId === pid && (!created || x.Created === created))
}
