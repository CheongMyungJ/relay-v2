// 요구사항 추출 extract의 파일과 헤드리스 run (requirements-extraction-flow.md 8절, 15.2~15.4, 결정 13·25·32~42·93·97).
// - 기록: requirements/revisions/NNNNNN.json(불변 변경분), requirements/answers/(반영 대기 사람 답), requirements/runs/r-NNNN/
//   (앱만 쓰는 run 기록). run의 scratch는 requirements/ 밖의 scratch/r-NNNN이다 (결정 42).
// - 지시와 스키마는 평가와 같은 skills/extract의 buildRun·runArgs로 조립한다 (결정 9, 97).
// - run 하나 = claude -p 프로세스 하나. 훅은 run마다 토큰을 두고, PreToolUse에서 StructuredOutput을 검사해 2회까지
//   되돌리고(결정 13, 45), 부드러운 마감 뒤 탐색 도구를 거부한다(결정 25). 판정은 core/requirements의 judgeRun이 한다.
import { spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import fsp from 'node:fs/promises'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020'
import { checkResult } from '../../../skills/extract/rules.mjs'
import { buildRun, runArgs } from '../../../skills/extract/run.mjs'
import { loadChecklist, loadLayers } from '../../../skills/extract/load.mjs'
import { chainProblem, codeAnchorProblems, repoPath, revisionFile } from '../core/requirements'
import { hookSettings, ruleAbs, HOOK_TOKEN_ENV } from '../core/settings'
import surveyBase from '../shared/generated/extract-survey.v0.schema.json'
import traceBase from '../shared/generated/extract-trace.v0.schema.json'
import revisionSchema from '../shared/generated/requirements-revision.v0.schema.json'
import type {
  Answer,
  ExtractResult,
  Lens,
  PendingAnswer,
  RequirementsPointer,
  RequirementsRevision,
} from '../shared/requirements'
import { spawnSpec } from './exec'
import { git } from './git'
import type { HookReply, HookRequest, HookServer } from './hooks'
import { killOrphans, processStartTime } from './pty'
import { fileHash, jsonText, readText, writeFileAtomic } from './store'

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateRevision = ajv.compile<RequirementsRevision>(revisionSchema)

/** 무결성 오류 (결정 38): 포인터가 가리키는 파일이 없거나 해시가 다르거나 사슬이 끊겼다 */
export class IntegrityError extends Error {}

/** Work 디렉터리 아래 요구사항 추출 파일 (결정 42, 93) */
export class RequirementsFiles {
  readonly dir: string
  readonly revisions: string
  readonly answers: string
  readonly runs: string
  constructor(readonly workDir: string) {
    this.dir = path.join(workDir, 'requirements')
    this.revisions = path.join(this.dir, 'revisions')
    this.answers = path.join(this.dir, 'answers')
    this.runs = path.join(this.dir, 'runs')
  }

  runDir(run: string): string {
    return path.join(this.runs, run)
  }

  /** run의 scratch: requirements/ 밖 (결정 42) */
  scratchDir(run: string): string {
    return path.join(this.workDir, 'scratch', run)
  }

  revisionPath(n: number): string {
    return path.join(this.revisions, revisionFile(n))
  }

  /**
   * 불변 revision을 쓰고 해시를 돌려준다 (결정 33). 같은 번호의 파일이 이미 있으면 포인터보다 뒤의 고아이므로(결정 33)
   * 지우고 쓴다. 포인터 안의 번호는 부르는 쪽이 넘기지 않는다
   */
  async writeRevision(rev: RequirementsRevision): Promise<string> {
    if (!validateRevision(rev as unknown))
      throw new IntegrityError(
        `revision ${rev.number}가 스키마를 통과하지 않음: ${ajv.errorsText(validateRevision.errors)}`,
      )
    const text = jsonText(rev)
    await writeFileAtomic(this.revisionPath(rev.number), text)
    return fileHash(text)
  }

  /**
   * 포인터까지의 revision을 읽는다 (결정 38). 포인터의 파일 해시가 다르거나, 파일이 없거나, 스키마나 사슬이 틀리면
   * IntegrityError. 포인터보다 뒤 번호의 고아 파일은 지운다(결정 33)
   */
  async load(pointer: RequirementsPointer): Promise<RequirementsRevision[]> {
    const out: RequirementsRevision[] = []
    for (let n = 1; n <= pointer.revision; n++) {
      const text = await readText(this.revisionPath(n))
      if (text === null) throw new IntegrityError(`revision ${n} 파일이 없음`)
      if (n === pointer.revision && fileHash(text) !== pointer.revision_hash)
        throw new IntegrityError(`revision ${n}의 해시가 포인터와 다름`)
      let rev: unknown
      try {
        rev = JSON.parse(text)
      } catch {
        throw new IntegrityError(`revision ${n}을 읽지 못함`)
      }
      if (!validateRevision(rev)) throw new IntegrityError(`revision ${n}가 스키마를 통과하지 않음`)
      out.push(rev)
    }
    const problem = chainProblem(out)
    if (problem) throw new IntegrityError(problem)
    await this.dropOrphans(pointer.revision)
    return out
  }

  /** 포인터보다 뒤 번호의 revision 파일을 지운다 (결정 33) */
  async dropOrphans(current: number): Promise<string[]> {
    let names: string[]
    try {
      names = await fsp.readdir(this.revisions)
    } catch {
      return []
    }
    const orphans = names.filter((f) => /^\d{6}\.json$/.test(f) && Number(f.slice(0, 6)) > current)
    for (const f of orphans) await fsp.rm(path.join(this.revisions, f), { force: true })
    return orphans
  }

  /** 사람 답을 불변 파일로 쓴다 (결정 41). 다음 반영 때 revision이 된다 */
  async writeAnswers(answers: Answer[], at: string): Promise<PendingAnswer> {
    const name = `${at.replace(/[^0-9]/g, '').slice(0, 14)}-${randomBytes(3).toString('hex')}.json`
    const text = jsonText(answers)
    await writeFileAtomic(path.join(this.answers, name), text)
    return { file: name, hash: fileHash(text) }
  }

  /** 반영 대기 사람 답을 읽는다. 해시가 다르면 IntegrityError */
  async readAnswers(p: PendingAnswer): Promise<Answer[]> {
    const text = await readText(path.join(this.answers, p.file))
    if (text === null || fileHash(text) !== p.hash)
      throw new IntegrityError(`사람 답 ${p.file}이 없거나 해시가 다름`)
    return JSON.parse(text) as Answer[]
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 지시와 스키마 (결정 9, 36, 97)

export interface AssembledRun {
  schema: Record<string, unknown>
  schemaArg: string
  instructions: string
  hashes: { schema: string; instructions: string }
}

/**
 * run 하나의 지시와 스키마를 조립한다. skillsRoot는 skills/의 부모(개발은 레포 뿌리, 설치본은 resources)다.
 * 기본 스키마는 앱에 묶은 docs/contracts의 사본이다
 */
export function assembleRun(
  skillsRoot: string,
  kind: 'survey' | 'trace',
  lens: Lens | null,
): AssembledRun {
  const base = (kind === 'survey' ? surveyBase : traceBase) as Record<string, unknown>
  return buildRun({
    base,
    checklist: lens ? loadChecklist(lens, skillsRoot) : null,
    layers: loadLayers(kind, lens, skillsRoot),
  })
}

// ---------------------------------------------------------------------------------------------------------------
// 기준 커밋 읽기와 반영 검사 (결정 35, 37, 42)

/** 기준 커밋의 파일을 읽는다(경로마다 한 번). 없으면 null */
export function baseReader(repo: string, base: string) {
  const cache = new Map<string, Promise<string | null>>()
  const read = (rel: string): Promise<string | null> => {
    let p = cache.get(rel)
    if (!p) {
      p = git(repo, ['show', `${base}:${rel}`]).then(
        (t) => t,
        () => null,
      )
      cache.set(rel, p)
    }
    return p
  }
  /** 기준 커밋에서 그 경로의 blob sha. 없으면 null */
  const blob = (rel: string): Promise<string | null> =>
    git(repo, ['rev-parse', '--verify', '--quiet', `${base}:${rel}`]).then(
      (t) => t || null,
      () => null,
    )
  return { read, blob }
}

export interface CheckContext {
  repo: string
  /** 기준 커밋의 파일 */
  read: (rel: string) => Promise<string | null>
  /** 이 run이 쓸 수 있는 구성 이름(survey가 낸 것). 모르면 undefined */
  configs?: string[]
}

/**
 * 결과의 막는 검사 (결정 37): 규칙 표(rules.mjs)의 결과만으로 가르는 규칙과 config_known, 기준 커밋의 경로·인용 대조
 * (path_at_base, quote_match, code 근거만). 문제 글은 고칠 곳을 알린다(결정 13)
 */
export async function resultProblems(result: unknown, ctx: CheckContext): Promise<string[]> {
  const rules = checkResult(result, ctx.configs ? { configs: ctx.configs } : {}).map(
    (p) => `${p.rule}: ${p.problem}`,
  )
  const paths = new Set<string>()
  const collect = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(collect)
    else if (v && typeof v === 'object') {
      const a = v as { kind?: unknown; path?: unknown }
      if (a.kind === 'code' && typeof a.path === 'string') paths.add(a.path)
      Object.values(v).forEach(collect)
    }
  }
  collect(result)
  const texts = new Map<string, string | null>()
  for (const p of paths) {
    const rel = repoPath(p, ctx.repo)
    texts.set(rel, await ctx.read(rel))
  }
  const anchors = codeAnchorProblems(result, ctx.repo, (rel) => texts.get(rel) ?? null).map(
    (p) => `${p.rule}: ${p.problem}`,
  )
  return [...rules, ...anchors]
}

// ---------------------------------------------------------------------------------------------------------------
// 헤드리스 run (15.2 A, 15.3)

/** 부드러운 마감 뒤 거부할 탐색 도구 (결정 25) */
const EXPLORE = new Set(['Read', 'Grep', 'Glob', 'Bash'])
/** 제출 검사 되돌림 횟수 (결정 13) */
export const MAX_SUBMIT_DENIALS = 2

export const SOFT_REASON =
  'relay: the soft deadline for this run has passed. Do not explore further. Submit the structured output now: set outcome to incomplete, report what you confirmed, and fill checkpoint with what you checked, what remains and where to look next.'

/** 제출 검사에 걸렸을 때의 이유 (결정 13: 지적된 것만 고치고 다른 판단은 바꾸지 않는다) */
export function submitReason(problems: readonly string[]): string {
  return [
    'relay: the app checked your structured output and found these problems:',
    ...problems.map((p) => `- ${p}`),
    'Fix only these: correct the anchor lines or quotes, the configuration names or the keys, or withdraw the claim. Keep every other judgement as it is and submit again.',
  ].join('\n')
}

export interface RunInput {
  run: string
  bin: string
  /** bin 앞에 붙일 인자(시험의 가짜 claude: node <script>) */
  binArgs?: string[]
  env: NodeJS.ProcessEnv
  files: RequirementsFiles
  /** 분석 대상 worktree. 쓰기를 막는다 (결정 44) */
  repo: string
  packet: string
  assembled: AssembledRun
  hooks: HookServer
  model: string
  effort?: string
  softMs: number
  hardMs: number
  /** 제출 검사. 문제 글을 돌려준다 */
  submitCheck: (output: unknown) => Promise<string[]>
  /** 프로세스를 띄운 뒤 (pid와 시작 시각을 기록한다, D76) */
  onSpawn?: (pid: number | null, processStartedAt: string | undefined) => Promise<void> | void
  /** 진행 표시: 도구 이름 */
  onTool?: (tool: string) => void
  /** [즉시 중단]이나 앱 종료 */
  signal?: AbortSignal
}

export interface RunOutput {
  sessionId: string
  exitCode: number | null
  timedOut: boolean
  stoppedByApp: boolean
  ms: number
  result: {
    is_error?: boolean
    subtype?: string
    structured_output?: unknown
    total_cost_usd?: number
  } | null
  output: ExtractResult | null
  schemaValid: boolean
  schemaErrors: string[]
  lastStop: Record<string, unknown> | null
  usageLimit: { type: string | null; resetsAt: number | null } | null
  submits: { at: number; problems: string[]; denied: boolean }[]
  softDeadlineHit: boolean
}

type Message = Record<string, unknown>

/** stream-json에서 사용량 한도 실패를 가른다 (결정 29, 52의 가정). 평가 하네스의 usageLimit과 같다 */
export function usageLimit(messages: readonly Message[]): RunOutput['usageLimit'] {
  const info = (m: Message | undefined, k: string) =>
    (m?.[k] as { rate_limit_info?: Record<string, unknown> } | undefined)?.rate_limit_info
  const rejected = messages.find(
    (m) =>
      m.type === 'rate_limit_event' &&
      (m.rate_limit_info as { status?: unknown } | undefined)?.status === 'rejected',
  )
  const apiErr = messages.find(
    (m) =>
      m.type === 'assistant' &&
      (m.error === 'rate_limit' ||
        m.apiError === 'usage_limit_reached' ||
        m.api_error === 'usage_limit_reached'),
  )
  const result = messages.find((m) => m.type === 'result')
  const limited =
    !!rejected || !!apiErr || (result?.is_error === true && result.api_error_status === 429)
  if (!limited) return null
  const i =
    (rejected?.rate_limit_info as Record<string, unknown> | undefined) ??
    info(apiErr, 'apiErrorParams') ??
    info(apiErr, 'api_error_params') ??
    null
  return {
    type: typeof i?.rateLimitType === 'string' ? i.rateLimitType : null,
    resetsAt: typeof i?.resetsAt === 'number' ? i.resetsAt : null,
  }
}

/** run 하나를 돌린다. 기록 파일은 requirements/runs/<run>/에 앱이 쓴다 (결정 42) */
export async function runExtract(o: RunInput): Promise<RunOutput> {
  const dir = o.files.runDir(o.run)
  const scratch = o.files.scratchDir(o.run)
  await fsp.mkdir(dir, { recursive: true })
  await fsp.mkdir(scratch, { recursive: true })
  const instructionsPath = path.join(dir, 'instructions.md')
  await writeFileAtomic(instructionsPath, o.assembled.instructions)
  await writeFileAtomic(path.join(dir, 'schema.json'), o.assembled.schemaArg)
  await writeFileAtomic(path.join(dir, 'packet.md'), o.packet)
  const settingsPath = path.join(dir, 'settings.json')
  const wt = ruleAbs(o.repo).replace(/\/+$/, '')
  const req = ruleAbs(o.files.dir).replace(/\/+$/, '')
  await writeFileAtomic(
    settingsPath,
    jsonText({
      hooks: hookSettings(o.hooks.port, o.run),
      permissions: {
        deny: [`Write(${wt}/**)`, `Edit(${wt}/**)`, `Write(${req}/**)`, `Edit(${req}/**)`],
      },
      autoMemoryEnabled: false,
    }),
  )

  const started = Date.now()
  const hooks: { at: number; event: string; body: Record<string, unknown> }[] = []
  const submits: RunOutput['submits'] = []
  let softHit = false
  let lastStop: Record<string, unknown> | null = null
  const token = randomBytes(32).toString('hex')
  const handler = async (r: HookRequest): Promise<HookReply> => {
    hooks.push({ at: Date.now() - started, event: r.event, body: r.body })
    const tool = typeof r.body.tool_name === 'string' ? r.body.tool_name : ''
    if (r.event === 'Stop') lastStop = r.body
    if (r.event !== 'PreToolUse') return null
    if (tool) o.onTool?.(tool)
    if (tool === 'StructuredOutput') {
      const problems = await o.submitCheck(r.body.tool_input ?? {})
      const denied =
        problems.length > 0 && submits.filter((s) => s.denied).length < MAX_SUBMIT_DENIALS
      submits.push({ at: Date.now() - started, problems, denied })
      return denied
        ? {
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'deny',
              permissionDecisionReason: submitReason(problems),
            },
          }
        : null
    }
    if (EXPLORE.has(tool) && Date.now() - started > o.softMs) {
      softHit = true
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: SOFT_REASON,
        },
      }
    }
    return null
  }
  const unregister = o.hooks.register(token, o.run, handler)

  const sessionId = randomUUID()
  const args = runArgs({
    model: o.model,
    effort: o.effort,
    schema: o.assembled.schemaArg,
    instructionsPath,
    settingsPath,
    addDirs: [o.repo],
    sessionId,
  })
  const spec = o.binArgs ? { file: o.bin, args: [...o.binArgs, ...args] } : spawnSpec(o.bin, args)
  let stdout = ''
  let stderr = ''
  let timedOut = false
  let stoppedByApp = false
  const child = spawn(spec.file, spec.args, {
    cwd: scratch,
    env: { ...o.env, [HOOK_TOKEN_ENV]: token },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (c: string) => (stdout += c))
  child.stderr.on('data', (c: string) => (stderr += c))
  child.stdin.on('error', () => {})
  child.stdin.end(o.packet)
  const pid = child.pid ?? null
  const processStartedAt = pid ? await processStartTime(pid) : undefined
  await o.onSpawn?.(pid, processStartedAt)

  const kill = async () => {
    if (!pid) return
    if (processStartedAt) await killOrphans([{ pid, startedAt: processStartedAt }], 5_000)
    try {
      child.kill('SIGKILL')
    } catch {
      // 이미 끝났다
    }
  }
  const timer = setTimeout(() => {
    timedOut = true
    void kill()
  }, o.hardMs)
  const onAbort = () => {
    stoppedByApp = true
    void kill()
  }
  o.signal?.addEventListener('abort', onAbort)
  if (o.signal?.aborted) onAbort()
  const exitCode = await new Promise<number | null>((resolve) => {
    child.on('error', () => resolve(null))
    child.on('close', (c) => resolve(c))
  })
  clearTimeout(timer)
  o.signal?.removeEventListener('abort', onAbort)
  // 늦게 오는 Stop·SessionEnd 훅을 잠깐 기다린다
  await new Promise((r) => setTimeout(r, 300))
  unregister()
  const ms = Date.now() - started

  const messages: Message[] = stdout
    .split('\n')
    .filter((l) => l.startsWith('{'))
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as Message]
      } catch {
        return []
      }
    })
  const result = (messages.find((m) => m.type === 'result') ?? null) as RunOutput['result']
  const output = (result?.structured_output ?? null) as ExtractResult | null
  const validate = ajv.compile(o.assembled.schema)
  const schemaValid = output ? validate(output) : false
  const schemaErrors = schemaValid
    ? []
    : (validate.errors ?? []).slice(0, 20).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`)

  await writeFileAtomic(path.join(dir, 'stdout.jsonl'), stdout)
  if (stderr) await writeFileAtomic(path.join(dir, 'stderr.txt'), stderr)
  await writeFileAtomic(
    path.join(dir, 'hooks.jsonl'),
    hooks.map((h) => JSON.stringify(h)).join('\n') + '\n',
  )
  if (output) await writeFileAtomic(path.join(dir, 'result.json'), jsonText(output))

  return {
    sessionId,
    exitCode,
    timedOut,
    stoppedByApp,
    ms,
    result,
    output,
    schemaValid,
    schemaErrors,
    lastStop,
    usageLimit: usageLimit(messages),
    submits,
    softDeadlineHit: softHit,
  }
}

/** worktree 전체(추적하지 않는 파일과 무시하는 파일 포함)의 상태 지문 (결정 39). run 앞뒤로 견준다 */
export async function worktreeFingerprint(repo: string): Promise<string> {
  const head = await git(repo, ['rev-parse', 'HEAD'])
  const status = await git(repo, ['status', '--porcelain', '--untracked-files=all', '--ignored'])
  return `${head}\n${status}`
}
