// 요구사항 추출 extract의 파일과 헤드리스 run (requirements-extraction-flow.md 8절, 15.2~15.4, 결정 13·25·32~42·93·97).
// - 기록: requirements/revisions/NNNNNN.json(불변 변경분), requirements/answers/(반영 대기 사람 답), requirements/runs/r-NNNN/
//   (앱만 쓰는 run 기록). run의 scratch는 requirements/ 밖의 scratch/r-NNNN이다 (결정 42).
// - 지시와 스키마는 평가와 같은 skills/extract의 buildRun·runArgs로 조립한다 (결정 9, 97).
// - run 하나 = claude -p 프로세스 하나. 훅은 run마다 토큰을 두고, PreToolUse에서 StructuredOutput을 검사해 2회까지
//   되돌리고(결정 13, 45), 부드러운 마감 뒤 탐색 도구를 거부한다(결정 25). 판정은 core/requirements의 judgeRun이 한다.
import { spawn } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import fsp from 'node:fs/promises'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020'
import type { BuildIndex } from '../../../skills/extract/build-index.mjs'
import { checkResult } from '../../../skills/extract/rules.mjs'
import { buildRun, runArgs } from '../../../skills/extract/run.mjs'
import { loadChecklist, loadLayers, loadPerspectives } from '../../../skills/extract/load.mjs'
import {
  chainProblem,
  codeAnchorProblems,
  fold,
  isClosed,
  outputAnchorProblems,
  repoPath,
  revisionFile,
} from '../core/requirements'
import { hookSettings, ruleAbs, HOOK_TOKEN_ENV } from '../core/settings'
import integrateBase from '../shared/generated/extract-integrate.v0.schema.json'
import reviewBase from '../shared/generated/extract-review.v0.schema.json'
import summarizeBase from '../shared/generated/extract-summarize.v0.schema.json'
import surveyBase from '../shared/generated/extract-survey.v0.schema.json'
import traceBase from '../shared/generated/extract-trace.v0.schema.json'
import exportSchema from '../shared/generated/requirements-export.v0.schema.json'
import revisionSchema from '../shared/generated/requirements-revision.v0.schema.json'
import type {
  Answer,
  ExtractResult,
  Lens,
  PendingAnswer,
  RequirementsPointer,
  RequirementsRevision,
  UnitKind,
} from '../shared/requirements'
import { spawnSpec } from './exec'
import { git } from './git'
import type { HookReply, HookRequest, HookServer } from './hooks'
import { killOrphans, processStartTime } from './pty'
import { fileHash, jsonText, readText, writeFileAtomic } from './store'

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateRevision = ajv.compile<RequirementsRevision>(revisionSchema)
const validateExport = ajv.compile(exportSchema)

/** 내보낼 record.json이 docs/contracts/requirements-export.v0를 통과하는가. 아니면 그 까닭 (AI 결정 119) */
export function exportProblem(record: unknown): string | null {
  return validateExport(record) ? null : ajv.errorsText(validateExport.errors)
}

/** 내보내는 폴더의 schemas/에 함께 두는 기록 스키마 사본 (AI 결정 119) */
export const EXPORT_SCHEMAS: Readonly<Record<string, unknown>> = {
  'requirements-export.v0.schema.json': exportSchema,
  'requirements-revision.v0.schema.json': revisionSchema,
}

/** 실행 출력 근거의 파일 읽기 (결정 42, 101). 없으면 null */
export interface OutputReader {
  read(path: string): Promise<string | null>
}

/** 무결성 오류 (결정 38): 포인터가 가리키는 파일이 없거나 해시가 다르거나 사슬이 끊겼다 */
export class IntegrityError extends Error {}

/** Work 디렉터리 아래 요구사항 추출 파일 (결정 42, 93) */
export class RequirementsFiles {
  readonly dir: string
  readonly revisions: string
  readonly answers: string
  readonly runs: string
  /** 실행 출력 근거의 불변 사본. 내용 해시가 이름이다 (결정 42) */
  readonly outputs: string
  constructor(readonly workDir: string) {
    this.dir = path.join(workDir, 'requirements')
    this.revisions = path.join(this.dir, 'revisions')
    this.answers = path.join(this.dir, 'answers')
    this.runs = path.join(this.dir, 'runs')
    this.outputs = path.join(this.dir, 'outputs')
  }

  runDir(run: string): string {
    return path.join(this.runs, run)
  }

  /** run의 scratch: requirements/ 밖 (결정 42) */
  scratchDir(run: string): string {
    return path.join(this.workDir, 'scratch', run)
  }

  /**
   * 실행 출력 근거의 파일을 읽는다(경로마다 한 번). run은 출력 파일을 scratch에 쓰고 앵커에 그 경로를 적는다. 경로는
   * 절대 경로이거나 scratch, Work 디렉터리, worktree 상대다. 반영 검사와 사본(keepOutputs)이 같은 reader를 쓰면 대조한
   * 바이트가 사본의 바이트다 (결정 42, 101). 제출 검사는 되돌린 뒤 run이 파일을 고칠 수 있어 제출마다 새로 만든다
   */
  outputReader(o: { run: string; worktree: string }): OutputReader {
    const cache = new Map<string, Promise<string | null>>()
    const load = async (p: string): Promise<string | null> => {
      const bases = [this.scratchDir(o.run), this.workDir, o.worktree]
      const tries = path.isAbsolute(p) ? [p] : bases.map((b) => path.join(b, p))
      for (const file of tries) {
        const text = await readText(file).catch(() => null)
        if (text !== null) return text
      }
      return null
    }
    return {
      read: (p) => {
        let t = cache.get(p)
        if (!t) {
          t = load(p)
          cache.set(p, t)
        }
        return t
      },
    }
  }

  /**
   * 실행 출력 근거를 requirements/outputs/에 불변 사본으로 두고 앵커가 그 사본을 가리키게 한다 (결정 42). 사본의
   * 이름은 내용의 sha256이라 같은 출력은 하나다. 찾지 못한 경로는 그대로 두고 돌려준다
   */
  async keepOutputs(
    result: unknown,
    o: { run: string; worktree: string },
    reader: OutputReader = this.outputReader(o),
  ): Promise<{ result: unknown; missing: string[] }> {
    const missing: string[] = []
    const kept = new Map<string, string | null>()
    const store = async (text: string): Promise<string> => {
      const hash = createHash('sha256').update(text).digest('hex')
      await fsp.mkdir(this.outputs, { recursive: true })
      const dest = path.join(this.outputs, `${hash}.txt`)
      if ((await readText(dest).catch(() => null)) === null) await writeFileAtomic(dest, text)
      return path.relative(this.workDir, dest).split(path.sep).join('/')
    }
    const keep = async (p: string): Promise<string | null> => {
      const text = await reader.read(p)
      return text === null ? null : store(text)
    }
    // 실행 출력의 입력 (AI 결정 121): 명령 줄에서 이 run의 scratch 안 파일을 가리키는 낱말(스크립트, 입력 파일)
    const scratch = path.resolve(this.scratchDir(o.run))
    const inputsOf = async (
      command: unknown,
      output: string,
    ): Promise<{ path: string; copy: string }[]> => {
      if (typeof command !== 'string') return []
      const words = command
        .split(/[\s;|&<>()]+/)
        .map((w) => w.replace(/^['"]+|['"]+$/g, '').replace(/^[A-Za-z_]+=/, ''))
        .filter((w) => w && !w.startsWith('-') && w !== output)
      const out: { path: string; copy: string }[] = []
      for (const w of [...new Set(words)]) {
        const file = path.resolve(scratch, w)
        if (file !== scratch && !file.startsWith(scratch + path.sep)) continue
        if (path.resolve(scratch, output) === file) continue
        const st = await fsp.stat(file).catch(() => null)
        if (!st?.isFile() || st.size > 2_000_000) continue
        const text = await readText(file).catch(() => null)
        if (text === null) continue
        out.push({ path: w, copy: await store(text) })
      }
      return out
    }
    const walk = async (v: unknown): Promise<unknown> => {
      if (Array.isArray(v)) return Promise.all(v.map(walk))
      if (!v || typeof v !== 'object') return v
      const obj = v as Record<string, unknown>
      if (obj['kind'] === 'tool_output' && typeof obj['path'] === 'string' && 'quote' in obj) {
        const p = obj['path']
        if (!kept.has(p)) kept.set(p, await keep(p))
        const to = kept.get(p) ?? null
        if (to === null) {
          missing.push(p)
          return { ...obj }
        }
        const inputs = await inputsOf(obj['command'], p)
        return { ...obj, path: to, ...(inputs.length ? { inputs } : {}) }
      }
      const out: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(obj)) out[k] = await walk(x)
      return out
    }
    return { result: await walk(result), missing: [...new Set(missing)] }
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
   * 포인터의 계보를 읽는다 (결정 38, 120): 포인터의 revision에서 parent를 따라 거슬러 가고 오래된 차례로 돌려준다. 포인터의
   * 파일 해시가 다르거나, 파일이 없거나, 스키마나 계보가 틀리면 IntegrityError. 다음 번호 이상의 고아 파일은 지운다(결정 33).
   * 되감기로 버린 계보의 파일은 이력이라 그대로 둔다
   */
  async load(pointer: RequirementsPointer): Promise<RequirementsRevision[]> {
    const out: RequirementsRevision[] = []
    let n: number | null = pointer.revision > 0 ? pointer.revision : null
    const seen = new Set<number>()
    while (n !== null) {
      if (seen.has(n)) throw new IntegrityError(`revision ${n}의 계보가 돈다`)
      seen.add(n)
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
      if (rev.number !== n) throw new IntegrityError(`revision ${n} 파일의 번호가 ${rev.number}다`)
      out.unshift(rev)
      n = rev.parent
    }
    const problem = chainProblem(out)
    if (problem) throw new IntegrityError(problem)
    await this.dropOrphans(Math.max(pointer.revision, pointer.next.revision - 1))
    return out
  }

  /**
   * 고아 revision 파일을 지운다 (결정 33, 120): 포인터가 가리키기 전에 끊긴 쓰기라 다음 번호(current + 1) 이상이다. 그보다
   * 작은 번호는 지금 계보이거나 되감기로 버린 계보의 이력이다
   */
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

  /** 구성별 빌드 인덱스를 requirements/build-index/<sha256>.json(불변)으로 쓰고 requirements/ 상대 경로를 돌려준다 (AI 결정 118) */
  async writeBuildIndex(index: BuildIndex): Promise<string> {
    const text = jsonText(index)
    const hash = createHash('sha256').update(text).digest('hex')
    const dest = path.join(this.dir, 'build-index', `${hash}.json`)
    if ((await readText(dest).catch(() => null)) === null) await writeFileAtomic(dest, text)
    return `build-index/${hash}.json`
  }

  /** 빌드 인덱스 읽기. 없거나 이름의 해시와 내용이 다르면 null (검사를 건너뛴다) */
  async readBuildIndex(rel: string): Promise<BuildIndex | null> {
    const text = await readText(path.join(this.dir, rel)).catch(() => null)
    if (text === null) return null
    const hash = createHash('sha256').update(text).digest('hex')
    if (!rel.endsWith(`${hash}.json`)) return null
    return JSON.parse(text) as BuildIndex
  }

  /** 빌드 인덱스를 만들 기준 커밋의 별도 체크아웃 (분석 worktree가 아님, 결정 39) */
  get buildCheckout(): string {
    return path.join(this.workDir, 'build-index', 'src')
  }
}

/**
 * 승인 때의 기록 무결성 (결정 2, AI 결정 124): 포인터의 계보(파일·해시·스키마·parent), 도는 run, 끝난 상태가 없는 단위,
 * 사본이 없는 실행 출력 근거. 문제 글을 돌려준다
 */
export async function recordProblems(
  files: RequirementsFiles,
  pointer: RequirementsPointer,
): Promise<string[]> {
  let state
  try {
    state = fold(await files.load(pointer))
  } catch (e) {
    return [`기록 무결성 오류: ${e instanceof Error ? e.message : String(e)}`]
  }
  const out: string[] = []
  if (pointer.run) out.push(`도는 run이 있음(${pointer.run.id})`)
  const open = state.units.filter((u) => !isClosed(u.status))
  if (open.length) out.push(`끝난 상태가 없는 단위: ${open.map((u) => u.id).join(', ')}`)
  const missing: string[] = []
  for (const e of state.evidence.filter((x) => x.kind === 'tool_output')) {
    const kept =
      e.path.startsWith('requirements/outputs/') &&
      (await readText(path.join(files.workDir, e.path)).catch(() => null)) !== null
    if (!kept) missing.push(`${e.id} (${e.path})`)
  }
  if (missing.length) out.push(`사본이 없는 실행 출력 근거: ${missing.join(', ')}`)
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// 지시와 스키마 (결정 9, 36, 97)

export interface AssembledRun {
  schema: Record<string, unknown>
  schemaArg: string
  instructions: string
  hashes: { schema: string; instructions: string }
}

const BASES: Readonly<Record<UnitKind, Record<string, unknown>>> = {
  survey: surveyBase,
  trace: traceBase,
  integrate: integrateBase,
  review: reviewBase,
  summarize: summarizeBase,
}

/**
 * run 하나의 지시와 스키마를 조립한다. skillsRoot는 skills/의 부모(개발은 레포 뿌리, 설치본은 resources)다.
 * 기본 스키마는 앱에 묶은 docs/contracts의 사본이다. integrate는 관점(perspectives.md)을, review는 패킷의 질문·서술 키를
 * 결과 스키마의 칸에 넣는다 (결정 36, AI 결정 108·112)
 */
export function assembleRun(
  skillsRoot: string,
  kind: UnitKind,
  lens: Lens | null,
  keys: { answers: string[]; verdicts: string[] } | null = null,
): AssembledRun {
  const more =
    kind === 'integrate'
      ? { coverage: loadPerspectives(skillsRoot) }
      : kind === 'review'
        ? { answers: keys?.answers ?? [], verdicts: keys?.verdicts ?? [] }
        : kind === 'summarize'
          ? {}
          : undefined
  return buildRun({
    base: BASES[kind],
    checklist: lens ? loadChecklist(lens, skillsRoot) : null,
    layers: loadLayers(kind, lens, skillsRoot),
    ...(more ? { more } : {}),
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
  /** 실행 출력 근거의 파일. 있으면 tool_output 앵커의 인용도 대조한다 (결정 101) */
  readOutput?: (path: string) => Promise<string | null>
  /** 결과의 run 종류. 그 종류에 걸리는 규칙만 돈다 (AI 결정 108) */
  kind?: UnitKind
  /** 패킷과 기록 목록이 준 전역 ID와 주장의 절 (규칙 global_refs, link_shape, AI 결정 110) */
  ids?: string[]
  sections?: Record<string, string>
  /** 구성별 빌드 인덱스. 있으면 규칙 config_active도 본다 (AI 결정 118: survey의 제출 검사만) */
  build?: BuildIndex
}

/**
 * 결과의 막는 검사 (결정 37): 규칙 표(rules.mjs)의 결과만으로 가르는 규칙과 config_known, 기준 커밋의 경로·인용 대조
 * (path_at_base, quote_match, code 근거), 실행 출력 파일의 인용 대조(quote_match, tool_output 근거, 결정 101).
 * 문제 글은 고칠 곳을 알린다(결정 13)
 */
export async function resultProblems(result: unknown, ctx: CheckContext): Promise<string[]> {
  const rules = checkResult(result, {
    ...(ctx.configs ? { configs: ctx.configs } : {}),
    ...(ctx.kind ? { kind: ctx.kind } : {}),
    ...(ctx.ids ? { ids: ctx.ids } : {}),
    ...(ctx.sections ? { sections: ctx.sections } : {}),
    ...(ctx.build ? { build: ctx.build } : {}),
  }).map((p) => `${p.rule}: ${p.problem}`)
  const paths = new Set<string>()
  const outputPaths = new Set<string>()
  const collect = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(collect)
    else if (v && typeof v === 'object') {
      const a = v as { kind?: unknown; path?: unknown }
      if (a.kind === 'code' && typeof a.path === 'string') paths.add(a.path)
      if (a.kind === 'tool_output' && typeof a.path === 'string') outputPaths.add(a.path)
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
  const readOutput = ctx.readOutput
  if (!readOutput) return [...rules, ...anchors]
  const outputs = new Map<string, string | null>()
  for (const p of outputPaths) outputs.set(p, await readOutput(p))
  const outputAnchors = outputAnchorProblems(result, (p) => outputs.get(p) ?? null).map(
    (p) => `${p.rule}: ${p.problem}`,
  )
  return [...rules, ...anchors, ...outputAnchors]
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
