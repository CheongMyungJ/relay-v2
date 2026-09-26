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
  return new Promise((resolve) => {
    execFile(
      spec.file,
      spec.args,
      {
        cwd: opts.cwd,
        env: opts.env,
        timeout,
        maxBuffer: MAX_BUFFER,
        windowsHide: true,
        encoding: 'utf8',
      },
      (err: ExecFileException | null, stdout: string, stderr: string) => {
        if (!err) {
          resolve({ code: 0, stdout, stderr })
        } else if (typeof err.code === 'number') {
          resolve({ code: err.code, stdout, stderr })
        } else {
          const error = err.killed ? `시간 초과 (${timeout / 1000}초)` : err.message
          resolve({ code: null, stdout, stderr, error })
        }
      },
    )
  })
}

/** 실패한 명령을 사람이 읽을 한 줄로 */
export function describeFailure(r: RunResult): string {
  if (r.error) return r.error
  const out = (r.stderr.trim() || r.stdout.trim()).split(/\r?\n/).slice(-3).join(' / ')
  return `종료 코드 ${String(r.code)}${out ? `: ${out}` : ''}`
}
