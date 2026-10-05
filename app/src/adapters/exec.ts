// 바깥 명령 실행 (I12). 종료 코드와 출력을 돌려주고, 실행하지 못했을 때만 오류를 담는다.
import { execFile, type ExecFileException } from 'node:child_process'

export interface SpawnSpec {
  file: string
  args: string[]
}

// npm 전역 설치의 claude.cmd는 ConPTY와 execFile이 바로 실행하지 못해 cmd.exe로 감싼다.
// 출처: spikes/lib/session.mjs start
export function spawnSpec(bin: string, args: string[]): SpawnSpec {
  if (bin.toLowerCase().endsWith('.cmd')) {
    return { file: 'cmd.exe', args: ['/d', '/s', '/c', bin, ...args] }
  }
  return { file: bin, args }
}

export interface RunResult {
  /** 종료 코드. 실행하지 못했거나 시간 초과면 null */
  code: number | null
  stdout: string
  stderr: string
  /** 실행하지 못한 이유 (실행 파일 없음, 시간 초과) */
  error?: string
}

export interface RunOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
  /** 표준 입력에 쓸 내용. 주면 다 쓴 뒤 닫는다 (gh api --input -) */
  input?: string
}

const MAX_BUFFER = 64 * 1024 * 1024

/** 명령을 실행하고 끝나기를 기다린다. 종료 코드가 0이 아니어도 거부하지 않는다 */
export function run(
  bin: string,
  args: readonly string[],
  opts: RunOptions = {},
): Promise<RunResult> {
  const spec = spawnSpec(bin, [...args])
  const timeout = opts.timeoutMs ?? 60_000
  // Windows에서는 시간 초과 때 트리째 끝낸다(taskkill /T): execFile의 timeout은 cmd.exe만 끝내 .cmd로 감싼 claude가
  // 남는다 (D333). 그 밖의 OS는 execFile의 timeout을 쓴다
  const tree = process.platform === 'win32'
  return new Promise((resolve) => {
    let timedOut = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const child = execFile(
      spec.file,
      spec.args,
      {
        cwd: opts.cwd,
        env: opts.env,
        timeout: tree ? 0 : timeout,
        maxBuffer: MAX_BUFFER,
        windowsHide: true,
        encoding: 'utf8',
      },
      (err: ExecFileException | null, stdout: string, stderr: string) => {
        if (timer) clearTimeout(timer)
        if (timedOut) {
          resolve({ code: null, stdout, stderr, error: `시간 초과 (${timeout / 1000}초)` })
        } else if (!err) {
          resolve({ code: 0, stdout, stderr })
        } else if (typeof err.code === 'number') {
          resolve({ code: err.code, stdout, stderr })
        } else {
          const error = err.killed ? `시간 초과 (${timeout / 1000}초)` : err.message
          resolve({ code: null, stdout, stderr, error })
        }
      },
    )
    if (tree && timeout > 0 && child.pid !== undefined) {
      const pid = child.pid
      timer = setTimeout(() => {
        timedOut = true
        execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {
          // 이미 끝났으면 실패한다
        })
      }, timeout)
    }
    if (opts.input !== undefined) {
      // 받는 쪽이 먼저 끝나 파이프가 닫히면(EPIPE) 오류를 내지 않는다: 결과는 종료 코드로 본다
      child.stdin?.on('error', () => {})
      child.stdin?.end(opts.input, 'utf8')
    }
  })
}

/** 실패한 명령을 사람이 읽을 한 줄로 */
export function describeFailure(r: RunResult): string {
  if (r.error) return r.error
  const out = (r.stderr.trim() || r.stdout.trim()).split(/\r?\n/).slice(-3).join(' / ')
  return `종료 코드 ${String(r.code)}${out ? `: ${out}` : ''}`
}
