// node-pty 세션과 프로세스 트리 종료 (S1, I32), 프로세스 목록과 시작 시각(I20, I33), 고아 프로세스 종료(D76).
import { execFile } from 'node:child_process'
import fsp from 'node:fs/promises'
import { promisify } from 'node:util'
import * as nodePty from 'node-pty'
import { spawnSpec } from './exec'

const execFileP = promisify(execFile)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export { spawnSpec } from './exec'

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
async function killTree(pid: number, fallback: () => void): Promise<void> {
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
  /** 시작 시각. Windows는 CreationDate의 "o" 형식, Linux는 ISO 8601(UTC)이다. 같은 OS에서만 비교한다 */
  Created: string
}

/**
 * 살아 있는 프로세스 목록과 시작 시각 (I20, I33). Windows는 PowerShell이라 느리므로(1초 안팎) 드물게 부른다.
 * 그 밖의 OS는 빈 목록이다.
 */
export async function listProcesses(): Promise<ProcessInfo[]> {
  if (process.platform === 'win32') return windowsProcesses()
  if (process.platform === 'linux') return linuxProcesses()
  return []
}

// 출처: spikes/lib/util.mjs processes
async function windowsProcesses(): Promise<ProcessInfo[]> {
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
 * 프로세스의 시작 시각 (D76, I20, I33). 세션을 띄운 직후에만 부른다. listProcesses와 같은 형식이다.
 * Windows와 Linux가 아니거나 찾지 못하면 undefined. 출처: spikes/lib/util.mjs processes
 */
export async function processStartTime(pid: number): Promise<string | undefined> {
  if (process.platform === 'linux') return (await linuxProcess(pid))?.Created
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

// ---------- Linux: /proc (I33) ----------

let clockTicks: number | undefined

/**
 * starttime의 단위 sysconf(_SC_CLK_TCK) (proc(5)). Node에는 sysconf가 없어 getconf로 한 번 읽는다.
 * 읽지 못하면 흔한 값 100을 쓴다(시작 시각은 같은 방법으로 만든 것끼리만 비교한다)
 */
async function ticksPerSecond(): Promise<number> {
  if (clockTicks === undefined) {
    try {
      const n = Number((await execFileP('getconf', ['CLK_TCK'])).stdout.trim())
      clockTicks = Number.isFinite(n) && n > 0 ? n : 100
    } catch {
      clockTicks = 100
    }
  }
  return clockTicks
}

/** 부팅 시각(유닉스 시각, 초): /proc/stat의 btime (proc(5)) */
async function bootTime(): Promise<number> {
  const m = /^btime (\d+)$/m.exec(await fsp.readFile('/proc/stat', 'utf8'))
  if (!m?.[1]) throw new Error('/proc/stat에 btime이 없음')
  return Number(m[1])
}

/**
 * /proc/<pid>/stat 한 줄: "pid (comm) state ppid …". comm에는 공백과 괄호가 들어갈 수 있어 마지막 ')'로 나눈다.
 * 3번째 필드부터가 ')' 뒤이고, (4) ppid, (22) starttime(부팅 뒤 클록 틱)이다 (proc(5)).
 * 좀비(Z)와 죽은(X) 프로세스는 끝난 것으로 본다. 출처: spikes/lib/util.mjs procList
 */
function parseStat(text: string, boot: number, hz: number): ProcessInfo | null {
  const open = text.indexOf('(')
  const close = text.lastIndexOf(')')
  if (open < 0 || close < open) return null
  const fields = text.slice(close + 2).split(' ')
  const state = fields[0]
  const ppid = Number(fields[1])
  const start = Number(fields[19])
  if (state === 'Z' || state === 'X' || !Number.isFinite(ppid) || !Number.isFinite(start)) {
    return null
  }
  return {
    ProcessId: Number(text.slice(0, open).trim()),
    ParentProcessId: ppid,
    Name: text.slice(open + 1, close),
    Created: new Date(boot * 1000 + Math.round((start * 1000) / hz)).toISOString(),
  }
}

async function linuxProcess(pid: number): Promise<ProcessInfo | null> {
  try {
    const [text, boot, hz] = await Promise.all([
      fsp.readFile(`/proc/${pid}/stat`, 'utf8'),
      bootTime(),
      ticksPerSecond(),
    ])
    return parseStat(text, boot, hz)
  } catch {
    return null
  }
}

async function linuxProcesses(): Promise<ProcessInfo[]> {
  const [boot, hz, names] = await Promise.all([bootTime(), ticksPerSecond(), fsp.readdir('/proc')])
  const out: ProcessInfo[] = []
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue
    try {
      const p = parseStat(await fsp.readFile(`/proc/${name}/stat`, 'utf8'), boot, hz)
      if (p) out.push(p)
    } catch {
      // 읽는 사이에 끝난 프로세스
    }
  }
  return out
}

// 출처: spikes/lib/util.mjs isAlive
export function isAlive(pid: number, created: string | undefined, list: ProcessInfo[]): boolean {
  return list.some((x) => x.ProcessId === pid && (!created || x.Created === created))
}

// ---------- 고아 프로세스 (시나리오 9-1, D76) ----------

/** 기록한 프로세스: ID와 시작 시각 */
export interface ProcessRecord {
  pid: number
  startedAt: string
}

const startMs = (p: ProcessInfo) => Date.parse(p.Created)

/**
 * pid와 그 자손 (루트가 먼저다). 부모 ID는 끝난 프로세스나 ID를 재사용한 다른 프로세스를 가리킬 수 있어
 * 부모보다 먼저 시작한 프로세스는 자식으로 보지 않는다(Win32_Process 문서 ParentProcessId). 시작 시각을 읽지
 * 못한 프로세스도 넣지 않는다. 출처: spikes/lib/util.mjs descendants
 */
export function processTree(pid: number, list: readonly ProcessInfo[]): ProcessInfo[] {
  const root = list.find((p) => p.ProcessId === pid)
  if (!root) return []
  const out = [root]
  for (let i = 0; i < out.length; i++) {
    const parent = out[i]
    if (!parent) continue
    for (const p of list) {
      if (
        p.ParentProcessId === parent.ProcessId &&
        !out.includes(p) &&
        startMs(p) >= startMs(parent)
      ) {
        out.push(p)
      }
    }
  }
  return out
}

/**
 * 기록과 ID·시작 시각이 같은 살아 있는 프로세스의 트리를 끝내고 끝날 때까지 기다린다 (시나리오 9-1, D76).
 * 시작 시각이 다르면 다른 프로그램이 ID를 재사용한 것이라 건드리지 않는다. 끝낸 기록을 돌려준다.
 * 트리는 목록 한 번에서 모으고(processTree), 루트부터 강제로 끝낸다: Windows는 TerminateProcess(Node의
 * process.kill), Linux는 SIGKILL이다(I33). Windows에서 목록은 PowerShell이라 느리다.
 */
export async function killOrphans(
  records: readonly ProcessRecord[],
  waitMs = 10_000,
): Promise<ProcessRecord[]> {
  if (records.length === 0) return []
  const list = await listProcesses()
  const found = records.filter((r) =>
    list.some((p) => p.ProcessId === r.pid && p.Created === r.startedAt),
  )
  const victims = new Map<number, ProcessInfo>()
  for (const r of found) for (const p of processTree(r.pid, list)) victims.set(p.ProcessId, p)
  for (const p of victims.values()) {
    try {
      process.kill(p.ProcessId, 'SIGKILL')
    } catch {
      // 이미 끝났다
    }
  }
  let left = [...victims.values()]
  const end = Date.now() + waitMs
  while (left.length > 0 && Date.now() < end) {
    await sleep(200)
    const now = await listProcesses()
    left = left.filter((p) => isAlive(p.ProcessId, p.Created, now))
  }
  return found
}
