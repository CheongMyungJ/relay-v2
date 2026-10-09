// 앱이 만드는 구성별 빌드 인덱스 (requirements-extraction-flow.md AI 결정 118, 16.10, 결정 14·87·88). 사람이 허용하면
// Work 디렉터리 아래 기준 커밋의 별도 체크아웃(분석 worktree가 아님, 결정 39)에서 survey가 낸 구성마다 빌드 명령을 한 번
// 돌리고(생성 헤더. 실패해도 계속), make 계열이면 `-n -B`로 컴파일 명령을 모아 소스마다 그 컴파일러로 전처리(-E -dD,
// 살아 있는 줄)와 컴파일(-c, ELF 심볼)을 한다. 그 컴파일러가 없으면 평가 하네스와 같은 찾기(CC, clang, zig cc)로
// 정의·포함 경로만 넘긴다. 꼴과 읽기는 skills/extract/build-index.mjs 그대로다. 소스 하나라도 실패한 구성은 인덱스에서
// 뺀다: 빠진 심볼을 "정의 없음"으로 읽어 맞는 주장을 되돌리지 않기 위해서다
import fsp from 'node:fs/promises'
import path from 'node:path'
import {
  activeLines,
  elfSymbols,
  mergeLines,
  mergeSymbols,
  type BuildIndex,
} from '../../../skills/extract/build-index.mjs'
import { isMakeCommand } from '../core/requirements'
import type { BuildTarget } from '../shared/requirements'
import { describeFailure, run } from './exec'

export type { BuildTarget }

export interface BuildIndexOutcome {
  status: 'built' | 'failed' | 'unavailable'
  /** 인덱스에 든 구성 */
  configs: string[]
  index: BuildIndex | null
  /** 사람이 읽는 까닭 (빠진 구성과 그 까닭) */
  detail: string
}

export interface BuildIndexInput {
  /** 분석 worktree (기준 커밋을 꺼낼 git 저장소) */
  worktree: string
  base: string
  /** 체크아웃을 둘 폴더 (Work 디렉터리의 build-index/src). 매번 비우고 다시 꺼낸다 */
  dir: string
  targets: readonly BuildTarget[]
  env: NodeJS.ProcessEnv
  /** 시간 상한 (시험이 줄인다) */
  buildMs?: number
  stepMs?: number
}

/** 컴파일 명령 하나 (make -n -B의 줄에서) */
export interface CompileCommand {
  /** 명령의 컴파일러 */
  compiler: string
  /** -c, -o와 그 값, 의존성 플래그, 소스를 뺀 인자 */
  args: string[]
  /** 소스 (cwd 기준) */
  source: string
  /** 그 줄을 돌릴 폴더 (체크아웃 기준 절대 경로) */
  cwd: string
}

const COMPILER = /(^|[\\/-])(gcc|cc|clang|xgcc)(-\d+(\.\d+)*)?(\.exe)?$/i
const C_SOURCE = /\.c$/i

/** 셸 낱말 나누기: 따옴표와 역슬래시, 그리고 명령 구분(&&, ||, ;, |)을 낱말로 */
export function shellWords(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let has = false
  let quote: '"' | "'" | null = null
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? ''
    if (quote) {
      if (ch === quote) quote = null
      else if (ch === '\\' && quote === '"' && i + 1 < line.length) cur += line[++i] ?? ''
      else cur += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      has = true
    } else if (ch === '\\' && i + 1 < line.length) {
      cur += line[++i] ?? ''
      has = true
    } else if (/\s/.test(ch)) {
      if (has) out.push(cur)
      cur = ''
      has = false
    } else if (ch === ';' || ch === '|' || (ch === '&' && line[i + 1] === '&')) {
      if (has) out.push(cur)
      cur = ''
      has = false
      if (ch === '&' || (ch === '|' && line[i + 1] === '|')) i++
      out.push(';')
    } else {
      cur += ch
      has = true
    }
  }
  if (has) out.push(cur)
  return out
}

/** 의존성 생성 플래그(값을 받는 것 포함). 전처리·컴파일에는 필요 없다 */
const DEP_FLAGS = new Set(['-MD', '-MMD', '-MP', '-M', '-MM'])
const DEP_WITH_VALUE = new Set(['-MF', '-MT', '-MQ'])

/**
 * `make -n -B` 출력에서 C 소스의 컴파일 명령을 모은다. `make[1]: Entering directory '…'`로 폴더를 따라가고, 줄의 앞
 * `cd <dir> &&`도 따른다. 컴파일러가 아니거나 -c가 없거나 C 소스가 아니면 뺀다
 */
export function compileCommands(text: string, root: string): CompileCommand[] {
  const out: CompileCommand[] = []
  const dirs: string[] = [root]
  for (const raw of text.split(/\r?\n/)) {
    const enter = /Entering directory [`'"]([^'"`]+)['"`]/.exec(raw)
    if (enter?.[1]) {
      dirs.push(path.resolve(dirs.at(-1) ?? root, enter[1]))
      continue
    }
    if (/Leaving directory/.test(raw)) {
      if (dirs.length > 1) dirs.pop()
      continue
    }
    let cwd = dirs.at(-1) ?? root
    const words = shellWords(raw.replace(/^\s*[@+-]+/, ''))
    let cmd: string[] = []
    const flush = () => {
      const c = parseCompile(cmd, cwd)
      if (c) out.push(c)
      if (cmd[0] === 'cd' && cmd[1]) cwd = path.resolve(cwd, cmd[1])
      cmd = []
    }
    for (const w of words) {
      if (w === ';') flush()
      else cmd.push(w)
    }
    flush()
  }
  return out
}

function parseCompile(argv: readonly string[], cwd: string): CompileCommand | null {
  const compiler = argv[0]
  if (!compiler || !COMPILER.test(compiler) || !argv.includes('-c')) return null
  const args: string[] = []
  let source: string | null = null
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i] ?? ''
    if (a === '-c' || DEP_FLAGS.has(a)) continue
    if (a === '-o' || DEP_WITH_VALUE.has(a)) {
      i++
      continue
    }
    if (/^-o./.test(a) || /^-M[FTQ]./.test(a)) continue
    if (!a.startsWith('-') && C_SOURCE.test(a)) source = a
    else args.push(a)
  }
  return source ? { compiler, args, source, cwd } : null
}

/** 대체 컴파일러(clang 계열)에 넘길 인자: 정의, 포함 경로, 강제 포함, 표준만 (벤더 플래그는 모른다) */
export function portableArgs(args: readonly string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? ''
    if (['-I', '-D', '-U', '-include', '-isystem', '-iquote'].includes(a)) {
      out.push(a, args[i + 1] ?? '')
      i++
    } else if (/^-(I|D|U|isystem|iquote)./.test(a) || /^-std=/.test(a)) out.push(a)
  }
  return out
}

const TARGETS: Record<string, string> = {
  'cortex-m0': 'thumbv6m-none-eabi',
  'cortex-m0plus': 'thumbv6m-none-eabi',
  'cortex-m3': 'thumbv7m-none-eabi',
  'cortex-m4': 'thumbv7em-none-eabi',
  'cortex-m7': 'thumbv7em-none-eabi',
}

/** 대체 컴파일러의 대상: -mcpu가 아는 Cortex-M이면 그것, 아니면 arm-none-eabi (ELF를 내도록) */
function fallbackTarget(args: readonly string[]): string {
  const cpu = args.find((a) => a.startsWith('-mcpu='))?.slice(6) ?? ''
  return TARGETS[cpu] ?? 'arm-none-eabi'
}

interface Compiler {
  file: string
  pre: string[]
  /** 명령의 컴파일러 그대로인가 (아니면 대체) */
  native: boolean
}

async function works(file: string, pre: string[], env: NodeJS.ProcessEnv, cwd: string) {
  const r = await run(file, [...pre, '--version'], { env, cwd, timeoutMs: 20_000 })
  return r.code === 0
}

/** 대체 컴파일러 찾기 (평가 하네스의 lib/cc.mjs와 같은 차례): CC, clang, python -m ziglang cc */
async function fallbackCompiler(env: NodeJS.ProcessEnv, cwd: string): Promise<Compiler | null> {
  const tries: [string, string[]][] = []
  if (env['CC']) tries.push([env['CC'], []])
  tries.push(['clang', []])
  for (const py of ['python3', 'python']) tries.push([py, ['-m', 'ziglang', 'cc']])
  for (const [file, pre] of tries) {
    const r = await run(file, [...pre, '--version'], { env, cwd, timeoutMs: 20_000 })
    if (r.code === 0 && /clang|zig/i.test(r.stdout + r.stderr)) return { file, pre, native: false }
  }
  return null
}

/** survey의 빌드 명령이 make 계열인가 */
export const isMake = isMakeCommand

function shell(command: string): { file: string; args: string[] } {
  return process.platform === 'win32'
    ? { file: 'cmd.exe', args: ['/d', '/s', '/c', command] }
    : { file: 'sh', args: ['-c', command] }
}

/** 기준 커밋을 폴더로 꺼낸다 (git archive: worktree를 더하지 않고 .git도 없다) */
async function checkout(i: BuildIndexInput): Promise<void> {
  await fsp.rm(i.dir, { recursive: true, force: true })
  await fsp.mkdir(i.dir, { recursive: true })
  const tar = path.join(path.dirname(i.dir), 'src.tar')
  const a = await run('git', ['-C', i.worktree, 'archive', '--format=tar', '-o', tar, i.base], {
    env: i.env,
    timeoutMs: 120_000,
  })
  if (a.code !== 0) throw new Error(`git archive 실패: ${describeFailure(a)}`)
  const x = await run('tar', ['-xf', tar, '-C', i.dir], { env: i.env, timeoutMs: 120_000 })
  await fsp.rm(tar, { force: true })
  if (x.code !== 0) throw new Error(`tar 풀기 실패: ${describeFailure(x)}`)
}

/** 전처리 출력의 줄 표시 경로를 절대 경로로 (cwd가 하위 폴더여도 체크아웃 기준으로 읽게) */
function absoluteMarkers(text: string, cwd: string): string {
  return text.replace(
    /^(#\s*(?:line\s+)?\d+\s+")((?:[^"\\]|\\.)*)"/gm,
    (_m, head: string, file: string) => {
      const f = file.replace(/\\(.)/g, '$1')
      if (f.startsWith('<')) return `${head}${file}"`
      return `${head}${path.resolve(cwd, f).replace(/\\/g, '\\\\')}"`
    },
  )
}

const firstLine = (s: string) =>
  s
    .split('\n')
    .find((l) => l.trim())
    ?.trim() ?? ''

/** 구성 하나: 빌드, 컴파일 명령 모으기, 소스마다 전처리·컴파일 */
async function indexConfig(
  i: BuildIndexInput,
  t: BuildTarget,
  fallback: () => Promise<Compiler | null>,
): Promise<{ ok: true; config: BuildIndex['configs'][string] } | { ok: false; reason: string }> {
  const buildMs = i.buildMs ?? 10 * 60_000
  const stepMs = i.stepMs ?? 2 * 60_000
  // 생성 헤더를 위해 한 번 돌린다. 실패해도 계속한다
  const sh = shell(t.command)
  await run(sh.file, sh.args, { cwd: i.dir, env: i.env, timeoutMs: buildMs })
  if (!isMake(t.command)) return { ok: false, reason: 'make 계열 명령이 아님' }
  const dry = shell(`${t.command} -n -B`)
  const n = await run(dry.file, dry.args, { cwd: i.dir, env: i.env, timeoutMs: stepMs })
  if (n.code !== 0) return { ok: false, reason: `make -n -B 실패: ${describeFailure(n)}` }
  const commands = compileCommands(n.stdout, i.dir)
  if (!commands.length) return { ok: false, reason: 'make -n -B에서 C 컴파일 명령을 찾지 못함' }
  const tmp = path.join(path.dirname(i.dir), 'obj')
  await fsp.mkdir(tmp, { recursive: true })
  const native = new Map<string, boolean>()
  const symbols = []
  const lines = []
  for (const [k, c] of commands.entries()) {
    if (!native.has(c.compiler)) native.set(c.compiler, await works(c.compiler, [], i.env, c.cwd))
    let cc: Compiler | null = native.get(c.compiler)
      ? { file: c.compiler, pre: [], native: true }
      : null
    cc ??= await fallback()
    if (!cc)
      return {
        ok: false,
        reason: `컴파일러 ${c.compiler}도 대체 컴파일러(CC, clang, zig cc)도 없음`,
      }
    const args = cc.native
      ? c.args
      : [
          ...cc.pre,
          '-target',
          fallbackTarget(c.args),
          '-ffreestanding',
          '-w',
          ...portableArgs(c.args),
        ]
    const pre = await run(cc.file, [...args, '-E', '-dD', c.source], {
      cwd: c.cwd,
      env: i.env,
      timeoutMs: stepMs,
    })
    if (pre.code !== 0)
      return {
        ok: false,
        reason: `${c.source} 전처리 실패: ${firstLine(pre.stderr) || describeFailure(pre)}`,
      }
    lines.push(activeLines(absoluteMarkers(pre.stdout, c.cwd), i.dir))
    const obj = path.join(tmp, `${String(k)}.o`)
    const o = await run(cc.file, [...args, '-c', c.source, '-o', obj], {
      cwd: c.cwd,
      env: i.env,
      timeoutMs: stepMs,
    })
    if (o.code !== 0)
      return {
        ok: false,
        reason: `${c.source} 컴파일 실패: ${firstLine(o.stderr) || describeFailure(o)}`,
      }
    try {
      symbols.push(elfSymbols(await fsp.readFile(obj)))
    } catch (e) {
      return { ok: false, reason: `${c.source}: ${e instanceof Error ? e.message : String(e)}` }
    }
  }
  await fsp.rm(tmp, { recursive: true, force: true })
  const merged = mergeSymbols(symbols)
  const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)))
  return { ok: true, config: { symbols: sorted, lines: mergeLines(lines) } }
}

/** 구성마다 인덱스를 만든다. 던지지 않는다: 실패는 status와 detail로 */
export async function buildConfigIndex(i: BuildIndexInput): Promise<BuildIndexOutcome> {
  if (!i.targets.length)
    return {
      status: 'unavailable',
      configs: [],
      index: null,
      detail: '빌드 명령이 있는 확정 구성이 없음',
    }
  try {
    await checkout(i)
  } catch (e) {
    return {
      status: 'failed',
      configs: [],
      index: null,
      detail: e instanceof Error ? e.message : String(e),
    }
  }
  let found: Compiler | null | undefined
  const fallback = async () =>
    found === undefined ? (found = await fallbackCompiler(i.env, i.dir)) : found
  const configs: BuildIndex['configs'] = {}
  const dropped: string[] = []
  for (const t of i.targets) {
    const r = await indexConfig(i, t, fallback)
    if (r.ok) configs[t.name] = r.config
    else dropped.push(`${t.name}: ${r.reason}`)
  }
  const names = Object.keys(configs)
  const allMake = i.targets.every((t) => isMake(t.command))
  return {
    status: names.length ? 'built' : allMake ? 'failed' : 'unavailable',
    configs: names,
    index: names.length ? { version: 1, configs } : null,
    detail: dropped.length ? `빠진 구성: ${dropped.join('; ')}` : '',
  }
}
