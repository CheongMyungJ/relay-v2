// 바깥 명령 실행 (I12). 종료 코드와 출력을 돌려주고, 실행하지 못했을 때만 오류를 담는다.
import { execFile, spawn, type ExecFileException } from 'node:child_process'

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
  /** 끊으면 프로세스를 끝내고 error에 "멈춤"을 적는다 (독립 리뷰의 [Work 포기], D496) */
  signal?: AbortSignal
  /**
   * 표준 출력이 오는 대로 받는다 (독립 리뷰의 진행 표시, D502). 주면 출력을 모아 두지 않는다: 끝난 뒤의 stdout과 stderr는
   * 끝의 STREAM_TAIL만 남는다(오류 글에 쓴다). 긴 출력이 MAX_BUFFER에 걸려 끊기지 않는다
   */
  onStdout?: (chunk: string) => void
}

/** 끊어서 끝낸 명령의 error */
export const ABORTED = '멈춤'

const MAX_BUFFER = 64 * 1024 * 1024

/** 흘려받는 실행(onStdout)에서 끝난 뒤 남기는 표준 출력과 오류 출력의 끝 */
export const STREAM_TAIL = 64 * 1024

/** Windows에서 프로세스를 트리째 끝낸다 (D333). 이미 끝났으면 실패하고 넘어간다 */
function killTreeWin(pid: number): void {
  execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {
    // 이미 끝났으면 실패한다
  })
}

/** 명령을 실행하고 끝나기를 기다린다. 종료 코드가 0이 아니어도 거부하지 않는다 */
export function run(
  bin: string,
  args: readonly string[],
  opts: RunOptions = {},
): Promise<RunResult> {
  if (opts.onStdout) return runStreaming(bin, args, opts, opts.onStdout)
  const spec = spawnSpec(bin, [...args])
  const timeout = opts.timeoutMs ?? 60_000
  // Windows에서는 시간 초과 때 트리째 끝낸다(taskkill /T): execFile의 timeout은 cmd.exe만 끝내 .cmd로 감싼 claude가
  // 남는다 (D333). 그 밖의 OS는 execFile의 timeout을 쓴다
  const tree = process.platform === 'win32'
  return new Promise((resolve) => {
    let timedOut = false
    let aborted = false
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
        opts.signal?.removeEventListener('abort', abort)
        if (aborted) {
          resolve({ code: null, stdout, stderr, error: ABORTED })
        } else if (timedOut) {
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
        killTreeWin(pid)
      }, timeout)
    }
    function abort() {
      aborted = true
      if (tree && child.pid !== undefined) {
        killTreeWin(child.pid)
      } else {
        child.kill()
      }
    }
    if (opts.signal?.aborted) abort()
    else opts.signal?.addEventListener('abort', abort, { once: true })
    if (opts.input !== undefined) {
      // 받는 쪽이 먼저 끝나 파이프가 닫히면(EPIPE) 오류를 내지 않는다: 결과는 종료 코드로 본다
      child.stdin?.on('error', () => {})
      child.stdin?.end(opts.input, 'utf8')
    }
  })
}

/**
 * 출력을 흘려받는 실행 (D502): run과 같은 시간 초과, 끊기, Windows의 트리째 끝내기를 하되 출력을 모아 두지 않는다.
 * 받은 조각은 onStdout에 넘기고 끝의 STREAM_TAIL만 결과에 남긴다
 */
function runStreaming(
  bin: string,
  args: readonly string[],
  opts: RunOptions,
  onStdout: (chunk: string) => void,
): Promise<RunResult> {
  const spec = spawnSpec(bin, [...args])
  const timeout = opts.timeoutMs ?? 60_000
  const tree = process.platform === 'win32'
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let aborted = false
    let done = false
    const child = spawn(spec.file, spec.args, { cwd: opts.cwd, env: opts.env, windowsHide: true })
    const kill = () => {
      if (tree && child.pid !== undefined) killTreeWin(child.pid)
      else child.kill()
    }
    const timer =
      timeout > 0
        ? setTimeout(() => {
            timedOut = true
            kill()
          }, timeout)
        : undefined
    const abort = () => {
      aborted = true
      kill()
    }
    const finish = (r: RunResult) => {
      if (done) return
      done = true
      if (timer) clearTimeout(timer)
      opts.signal?.removeEventListener('abort', abort)
      resolve(r)
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (c: string) => {
      try {
        onStdout(c)
      } catch {
        // 받는 쪽의 오류로 실행을 멈추지 않는다
      }
      stdout = (stdout + c).slice(-STREAM_TAIL)
    })
    child.stderr.on('data', (c: string) => {
      stderr = (stderr + c).slice(-STREAM_TAIL)
    })
    child.on('error', (e) => finish({ code: null, stdout, stderr, error: e.message }))
    child.on('close', (code, signal) => {
      if (aborted) finish({ code: null, stdout, stderr, error: ABORTED })
      else if (timedOut)
        finish({ code: null, stdout, stderr, error: `시간 초과 (${timeout / 1000}초)` })
      else if (code !== null) finish({ code, stdout, stderr })
      else finish({ code: null, stdout, stderr, error: `신호 ${String(signal)}로 끝남` })
    })
    if (opts.signal?.aborted) abort()
    else opts.signal?.addEventListener('abort', abort, { once: true })
    // 받는 쪽이 먼저 끝나 파이프가 닫히면(EPIPE) 오류를 내지 않는다: 결과는 종료 코드로 본다
    child.stdin.on('error', () => {})
    child.stdin.end(opts.input ?? '', 'utf8')
  })
}

/** 실패한 명령을 사람이 읽을 한 줄로 */
export function describeFailure(r: RunResult): string {
  if (r.error) return r.error
  const out = (r.stderr.trim() || r.stdout.trim()).split(/\r?\n/).slice(-3).join(' / ')
  return `종료 코드 ${String(r.code)}${out ? `: ${out}` : ''}`
}
