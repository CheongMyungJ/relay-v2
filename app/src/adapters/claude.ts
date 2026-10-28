// claude 실행 파일 찾기(D106), 버전과 인증 점검(D105, D67), 이번 task의 단계 절차 배포(5.6.3, D103, D440, D443).
// 실행 파일 찾기의 출처: spikes/lib/session.mjs resolveClaude. 스파이크는 못 찾으면 'claude'를 돌려줬지만,
// 앱은 PATH를 직접 뒤지고 못 찾으면 null을 돌려준다 (D106: 못 찾으면 등록을 막는다).
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { CALLER_ASK_NOTE, INSTRUCTIONS_FILE, askViaRelay } from '../core/settings'
import type { SkillName } from '../shared/config'
import { ASSEMBLY_FLAGS, assemblyFlags } from '../core/builtin-types'
import { NODE_INFO, STEP_NODES } from '../core/pipeline'
import { WORK_TYPES, type WorkType } from '../shared/work'
import { describeFailure, run } from './exec'
import { readText, sha256, writeFileAtomic } from './store'
import { pathDirs } from './which'

export interface FindClaudeOptions {
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  exists?: (file: string) => boolean
}

export function findClaude(opts: FindClaudeOptions = {}): string | null {
  const env = opts.env ?? process.env
  const platform = opts.platform ?? process.platform
  const exists = opts.exists ?? ((f: string) => fs.existsSync(f))
  const p = platform === 'win32' ? path.win32 : path.posix

  // 경로면 있는지 보고(없으면 설치 안내, D106), 경로가 아닌 명령 이름이면 그대로 쓴다: 실행할 때 PATH에서 찾는다
  const bin = env['CLAUDE_BIN']
  if (bin) return !/[\\/]/.test(bin) || exists(bin) ? bin : null

  const candidates: string[] = []
  if (platform === 'win32') {
    if (env['USERPROFILE'])
      candidates.push(p.join(env['USERPROFILE'], '.local', 'bin', 'claude.exe'))
    if (env['APPDATA']) candidates.push(p.join(env['APPDATA'], 'npm', 'claude.cmd'))
  } else if (env['HOME']) {
    // 네이티브 설치 위치. 메뉴로 켠 앱은 로그인 뒤에 생긴 ~/.local/bin이 PATH에 없을 수 있다 (I119)
    candidates.push(p.join(env['HOME'], '.local', 'bin', 'claude'))
  }
  const names = platform === 'win32' ? ['claude.exe', 'claude.cmd'] : ['claude']
  for (const dir of pathDirs(env, platform)) {
    for (const n of names) candidates.push(p.join(dir, n))
  }
  return candidates.find(exists) ?? null
}

// ---------- 실행 (D67, D105) ----------

/** claude --version의 결과. task마다 work.json에 기록한다 (D105) */
export async function claudeVersion(bin: string, env?: NodeJS.ProcessEnv): Promise<string> {
  const r = await run(bin, ['--version'], { env, timeoutMs: 60_000 })
  if (r.code !== 0) throw new Error(`claude --version 실패: ${describeFailure(r)}`)
  return r.stdout.trim()
}

export interface AuthStatus {
  ok: boolean
  detail: string
}

/** claude auth status: 로그인되어 있으면 종료 코드 0 (D67, Claude Code 문서 cli-reference) */
export async function claudeAuthStatus(bin: string, env?: NodeJS.ProcessEnv): Promise<AuthStatus> {
  const r = await run(bin, ['auth', 'status'], { env, timeoutMs: 60_000 })
  if (r.code === 0) return { ok: true, detail: '로그인됨' }
  return { ok: false, detail: describeFailure(r) }
}

// ---------- 단계 절차 배포 (5.6.3, D103, D440) ----------

const SKILL_FILE = 'SKILL.md'
const COMMON_FILE = '_common.md'
/** 마무리 절차 (5.6.14, D493). 마무리 단계 task에만 스킬 본문과 공통 규칙 사이에 붙인다 */
export const FINAL_FILE = '_final.md'
/** 유형에 PR 템플릿(pr-template.md)이 없을 때의 템플릿 (D507, D313) */
export const PR_TEMPLATE_DEFAULT_FILE = '_pr-template.md'
/** 기본 유형 폴더들 (D506) */
export const TYPES_DIR = 'types'

/**
 * 스킬 원본 위치 (D103). RELAY_SKILLS_DIR가 있으면 그 폴더, 없으면 앱에 묶어 배포한 skills/다.
 * bundled는 main이 앱 실행 방식에 따라 정한다 (설치본은 resources/skills).
 */
export function skillsDir(env: NodeJS.ProcessEnv, bundled: string): string {
  const dir = env['RELAY_SKILLS_DIR']
  return path.resolve(dir ? dir : bundled)
}

const lf = (s: string) => s.replace(/\r\n?/g, '\n')

/**
 * 공통 규칙을 SKILL.md 끝에 붙인다 (D31, D99). 줄 끝은 LF로 맞춰 체크아웃 방식과 상관없이 해시가 같다.
 * 출처: skills/check.mjs (스킬 크기를 잴 때 합치는 방식과 같다)
 */
export function mergeSkill(skill: string, common: string): string {
  return `${lf(skill).trimEnd()}\n${lf(common)}`
}

/** 유형 표시에 쓸 수 있는 유형: 기본 다섯과, 모든 커스텀 유형이 함께 쓰는 custom (D456) */
const ASSEMBLY_TYPES: readonly WorkType[] = [...WORK_TYPES, 'custom']

const TYPE_OPEN = /^<!-- type: ([a-z]+(?: [a-z]+)*) -->$/
const TYPE_CLOSE = '<!-- /type -->'
const TYPE_LIKE = /^\s*<!--\s*\/?\s*type\b/i

/**
 * 옛 Work의 verify(D501)에서 그 Work 유형의 구간만 남긴다 (5.6.3, D279). 다른 공용 스킬은 유형 설정으로 고른다
 * (selectFlags). `<!-- type: feature refactor -->` 줄과 `<!-- /type -->` 줄 사이는 적힌 유형에만 남고, 표시 줄은 지운다. 표시 밖은 모든 유형에 남는다. 구간은 겹치지 않는다. 표시처럼 보이지만
 * 모양이 다른 줄, 모르는 유형, 닫히지 않거나 짝이 없는 표시는 배포하지 않도록 오류다(원본을 고친 실수를 task 시작에서
 * 드러낸다). skills/assemble.mjs(check.mjs가 씀)와 같은 결과인지 [어댑터] 시험이 비교한다 (I68)
 */
export function selectType(text: string, type: WorkType): string {
  const out: string[] = []
  let open: readonly string[] | null = null
  for (const [i, line] of lf(text).split('\n').entries()) {
    const m = TYPE_OPEN.exec(line)
    if (m) {
      if (open) throw new Error(`스킬의 유형 표시가 겹침 (${i + 1}행)`)
      const types = (m[1] ?? '').split(' ')
      const unknown = types.filter((t) => !(ASSEMBLY_TYPES as readonly string[]).includes(t))
      if (unknown.length) {
        throw new Error(`스킬의 유형 표시에 모르는 유형: ${unknown.join(', ')} (${i + 1}행)`)
      }
      open = types
    } else if (line === TYPE_CLOSE) {
      if (!open) throw new Error(`스킬의 유형 표시 닫기에 짝이 없음 (${i + 1}행)`)
      open = null
    } else if (TYPE_LIKE.test(line)) {
      throw new Error(`스킬의 유형 표시 모양이 틀림: ${line.trim()} (${i + 1}행)`)
    } else if (!open || open.includes(type)) {
      out.push(line)
    }
  }
  if (open) throw new Error('스킬의 유형 표시가 닫히지 않음')
  return out.join('\n')
}

/** 스킬 원본 맨 앞의 머리글(`---`로 감싼 YAML)과 그 뒤의 빈 줄을 뗀다. 시스템 프롬프트에 넣는 절차에는 필요 없다 (D440, D444) */
export function stripFrontMatter(text: string): string {
  return lf(text).replace(/^---\n[\s\S]*?\n---\n+/, '')
}

const FLAG_OPEN = /^<!-- if: ([a-z-]+(?: [a-z-]+)*) -->$/
const FLAG_CLOSE = '<!-- /if -->'
const FLAG_LIKE = /^\s*<!--\s*\/?\s*if\b/i
const SLOT = /^<!-- slot: ([a-z-]+) -->$/
const SLOT_LIKE = /^\s*<!--\s*slot\b/i

/** 공용 스킬의 칸 자리 (5.6.15, D507): 마무리 판정 규칙과 PR 템플릿 */
export const SLOTS = ['finish', 'pr-template'] as const
export type SlotName = (typeof SLOTS)[number]

/**
 * 공용 스킬에서 그 Work 유형의 설정 구간만 남긴다 (5.6.15, D508). `<!-- if: code check-method -->` 줄과 `<!-- /if -->` 줄
 * 사이는 적힌 표시가 모두 flags에 있을 때만 남고, 표시 줄은 지운다. 표시 밖은 늘 남는다. 구간은 겹치지 않는다. 칸 자리
 * (`<!-- slot: … -->`)는 그대로 둔다(fillSlots). 모양이 틀린 표시, 모르는 표시, 짝 없음은 selectType처럼 오류다.
 * skills/assemble.mjs의 selectFlags와 같은 결과인지 [어댑터] 시험이 비교한다
 */
export function selectFlags(text: string, flags: readonly string[]): string {
  const out: string[] = []
  let open: readonly string[] | null = null
  for (const [i, line] of lf(text).split('\n').entries()) {
    const m = FLAG_OPEN.exec(line)
    if (m) {
      if (open) throw new Error(`스킬의 설정 구간이 겹침 (${i + 1}행)`)
      const names = (m[1] ?? '').split(' ')
      const unknown = names.filter((f) => !ASSEMBLY_FLAGS.includes(f))
      if (unknown.length) {
        throw new Error(`스킬의 설정 구간에 모르는 표시: ${unknown.join(', ')} (${i + 1}행)`)
      }
      open = names
    } else if (line === FLAG_CLOSE) {
      if (!open) throw new Error(`스킬의 설정 구간 닫기에 짝이 없음 (${i + 1}행)`)
      open = null
    } else if (FLAG_LIKE.test(line)) {
      throw new Error(`스킬의 설정 구간 모양이 틀림: ${line.trim()} (${i + 1}행)`)
    } else if (SLOT_LIKE.test(line) && !SLOT.test(line)) {
      throw new Error(`스킬의 칸 자리 모양이 틀림: ${line.trim()} (${i + 1}행)`)
    } else if (!open || open.every((f) => flags.includes(f))) {
      out.push(line)
    }
  }
  if (open) throw new Error('스킬의 설정 구간이 닫히지 않음')
  return out.join('\n')
}

/**
 * 칸 자리(`<!-- slot: … -->` 줄)에 유형의 글을 넣는다 (5.6.15, D507). 글은 앞뒤 빈 줄을 뗀다. 글이 없으면 자리 줄을 지운다.
 * 모르는 칸 이름은 오류다
 */
export function fillSlots(text: string, slots: Partial<Record<SlotName, string>>): string {
  return lf(text)
    .split('\n')
    .flatMap((line, i) => {
      const m = SLOT.exec(line)
      if (!m) return [line]
      const name = m[1] as SlotName
      if (!SLOTS.includes(name)) throw new Error(`스킬의 모르는 칸 자리: ${name} (${i + 1}행)`)
      const body = lf(slots[name] ?? '').trim()
      return body ? [body] : []
    })
    .join('\n')
}

/**
 * 이번 task의 유형 재료 (5.6.15, D452, D456, D458, D506): 유형 폴더(기본 유형은 앱의 skills/types/<id>/, 커스텀은 Work
 * 디렉터리에 복사한 type/), 단계 task면 그 단계 id, 설정 구간 표시, 단계 공통 바탕을 붙이는지
 */
export interface TypeSource {
  dir: string
  /** 단계 task의 단계 id. 기본 유형은 노드 이름과 같다. intake와 PR 대응에는 없다 */
  step?: string
  /** 설정 구간 표시 (core/builtin-types assemblyFlags) */
  flags: readonly string[]
  /** 단계 공통 바탕(skills/custom/SKILL.md)을 절차 앞에 붙인다. 커스텀 단계 정의의 step_base다 */
  stepBase?: boolean
}

/** 기본 유형 폴더 (D506) */
export const builtinTypeDir = (source: string, type: WorkType) => path.join(source, TYPES_DIR, type)

/** 기본 유형의 유형 재료. 커스텀 유형은 Work의 복사본이라 부른 쪽이 만든다 */
export function builtinTypeSource(source: string, type: WorkType, step?: string): TypeSource {
  return {
    dir: builtinTypeDir(source, type),
    ...(step ? { step } : {}),
    flags: assemblyFlags({ type }),
  }
}

/** 단계 절차의 제목. 공통 바탕과 그 단계의 절차 사이에 둔다 (D452) */
export const CUSTOM_PROCEDURE_HEAD = "## This step's procedure"
/** 공용 스킬 끝에 붙이는 유형 지시의 제목 (D456) */
export const CUSTOM_INTAKE_HEAD = "## This Work type's intake instructions"
export const CUSTOM_VERIFY_HEAD = "## This Work type's review points"

/** 유형 폴더의 글을 제목 아래에 붙인다. 앞뒤 빈 줄은 뗀다 */
const section = (head: string, text: string) => `\n\n${head}\n\n${lf(text).trim()}\n`

/** 단계 절차를 갖는 스킬: 기본 유형의 단계(core/pipeline STEP_NODES)와 커스텀 단계 */
const STEP_SKILLS: readonly SkillName[] = [...STEP_NODES.map((n) => NODE_INFO[n].skill), 'custom']

/**
 * 스킬 본문 (5.6.3, 5.6.15, D279, D452, D456, D508). 단계 스킬은 유형 폴더의 그 단계 절차이고, 커스텀 단계가 공통 바탕을
 * 켰으면(step_base) 공통 바탕 뒤에 붙인다. work-start는 의도 정리 지시(intake.md)를 끝에 붙이고, PR 대응은 설정 구간만
 * 고른다. 옛 Work의 verify는 유형 구간(selectType)을 고르고 커스텀이면 리뷰 관점(verify.md)을 붙인다 (D501)
 */
async function skillBody(
  source: string,
  skill: SkillName,
  type: WorkType,
  src: TypeSource,
): Promise<string> {
  if (STEP_SKILLS.includes(skill)) {
    const step = src.step ?? (skill === 'custom' ? undefined : skill)
    if (!step) throw new Error('커스텀 단계의 단계 id가 없음')
    const procedure = await readText(path.join(src.dir, `${step}.md`))
    if (procedure === null) throw new Error(`단계의 절차 파일이 없음: ${step}.md`)
    if (skill !== 'custom' || src.stepBase === false) return lf(procedure)
    const base = await fsp.readFile(path.join(source, 'custom', SKILL_FILE), 'utf8')
    return `${selectFlags(stripFrontMatter(base), src.flags).trimEnd()}${section(CUSTOM_PROCEDURE_HEAD, procedure)}`
  }
  const raw = stripFrontMatter(await fsp.readFile(path.join(source, skill, SKILL_FILE), 'utf8'))
  if (skill === 'verify') {
    const body = selectType(raw, type)
    const notes = type === 'custom' ? await readText(path.join(src.dir, 'verify.md')) : null
    return notes?.trim() ? `${body.trimEnd()}${section(CUSTOM_VERIFY_HEAD, notes)}` : body
  }
  const body = selectFlags(raw, src.flags)
  if (skill !== 'work-start') return body
  const notes = await readText(path.join(src.dir, 'intake.md'))
  return notes?.trim() ? `${body.trimEnd()}${section(CUSTOM_INTAKE_HEAD, notes)}` : body
}

/**
 * 배포할 단계 절차 (5.6.3, 5.6.15, D440): 스킬 본문(skillBody)에, 마무리 단계(finishing)면 마무리 절차(_final.md)의 설정
 * 구간과 유형의 칸(판정 규칙 finish.md, PR 템플릿 pr-template.md, 없으면 _pr-template.md)을 붙이고(D493, D507), 공통 규칙을
 * 끝에 붙인다. 유형 재료를 주지 않으면 기본 유형의 것이다. Codex 배포본은 이 글 앞에 자기 머리글을 붙인다 (engines.md)
 */
export async function skillText(
  source: string,
  skill: SkillName,
  type: WorkType,
  typeSource?: TypeSource,
  finishing = false,
): Promise<string> {
  if (type === 'custom' && !typeSource) throw new Error('커스텀 Work의 유형 재료가 없음')
  const src = typeSource ?? builtinTypeSource(source, type)
  const common = await fsp.readFile(path.join(source, COMMON_FILE), 'utf8')
  const own = await skillBody(source, skill, type, src)
  if (!finishing) return mergeSkill(own, common)
  const finish = await readText(path.join(src.dir, 'finish.md'))
  // 비었거나 빈 줄뿐인 pr-template.md도 없는 것으로 보고 일반 템플릿을 쓴다 (D507)
  const template =
    (await readText(path.join(src.dir, 'pr-template.md')))?.trim() ||
    (await fsp.readFile(path.join(source, PR_TEMPLATE_DEFAULT_FILE), 'utf8'))
  const final = fillSlots(
    selectFlags(await fsp.readFile(path.join(source, FINAL_FILE), 'utf8'), src.flags),
    { finish: finish ?? '', 'pr-template': template },
  )
  return mergeSkill(mergeSkill(own, final), common)
}

export interface DeployedSkill {
  /** 배포한 파일의 경로. Claude Code는 task 디렉터리의 instructions.md다 (D440) */
  file: string
  /** 배포한 내용의 해시. work.json에 적는다 (D103) */
  hash: string
}

/**
 * instructions.md 끝에 붙이는 이 task의 경로 (D442). 첫 프롬프트는 압축이나 /clear로 사라질 수 있어 시스템 프롬프트에도
 * 둔다. Codex는 SessionStart의 additionalContext로 같은 경로를 다시 준다 (engines.md)
 */
export function taskFooter(contextPath: string, taskDir: string): string {
  return `\n## This task\n\n- \`context.md\`: \`${contextPath}\`\n- Task directory: \`${taskDir}\`\n`
}

/**
 * 이번 task의 단계 절차를 task 디렉터리의 instructions.md에 쓴다. 실행 인자가 --append-system-prompt-file로 준다 (D440).
 * 끝에 이 task의 context.md와 task 디렉터리 경로를 붙인다(taskFooter). 해시(D103)는 경로를 뺀 절차로 계산해 같은 원본이면
 * task가 달라도 같다. 스킬로 배포하지 않는다. 이전 버전이 Work 디렉터리에 남긴 .claude/skills/relay-*는 지운다: 남겨 두면
 * 사람이 /relay-…로 다른 단계를 부를 수 있다 (D443). worktree는 건드리지 않는다 (D32)
 */
export async function deploySkill(o: {
  source: string
  workDir: string
  /** task 디렉터리. instructions.md는 늘 여기에 두고 재개와 deny 규칙이 이 경로를 쓴다 (D441, D443) */
  taskDir: string
  /** 이 task의 context.md. Codex는 쓰지 않는다 */
  contextPath: string
  skill: SkillName
  /** Work 유형. 공용 스킬에서 그 유형의 구간만 배포한다 (D279) */
  type: WorkType
  /** 유형 재료 (5.6.15). 없으면 기본 유형의 것이다 */
  typeSource?: TypeSource
  /** 마무리 단계 task다: 마무리 절차를 붙인다 (5.6.14, D493) */
  finishing?: boolean
  /** 질문을 relay MCP로 묻는다 (D521): 절차의 질문 도구 이름을 바꾼다. Codex는 늘 그렇다 */
  askViaMcp?: boolean
  /** relay MCP 호출자가 답한다 (D521): 호출자가 터미널을 보지 못한다는 안내를 붙인다 */
  callerAnswers?: boolean
}): Promise<DeployedSkill> {
  const original = await skillText(o.source, o.skill, o.type, o.typeSource, o.finishing)
  const asked = o.askViaMcp ? askViaRelay(original) : original
  const text = o.callerAnswers ? asked + CALLER_ASK_NOTE : asked
  await removeRelaySkills(o.workDir)
  const file = path.join(o.taskDir, INSTRUCTIONS_FILE)
  await writeFileAtomic(file, text + taskFooter(o.contextPath, o.taskDir))
  return { file, hash: `sha256:${sha256(text)}` }
}

/** 이전 버전이 배포한 relay 스킬 폴더(.claude/skills/relay-*)를 지운다. 사람이 둔 다른 스킬은 그대로 둔다 (D443) */
async function removeRelaySkills(workDir: string): Promise<void> {
  const root = path.join(workDir, '.claude', 'skills')
  const entries = await fsp.readdir(root, { withFileTypes: true }).catch((err: unknown) => {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  })
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('relay-')) {
      await fsp.rm(path.join(root, entry.name), { recursive: true, force: true })
    }
  }
}

// ---------- 짧은 모델 호출 (D300, D495) ----------

export interface ClaudeJsonInput {
  bin: string
  env: NodeJS.ProcessEnv
  cwd: string
  /** 모델. 비우면 CLI의 기본이다 */
  model: string
  effort?: string
  system: string
  prompt: string
  schema: object
  timeoutMs: number
  /** 줄 도구. 없으면 도구 없음이다(지식 검토, D300). 독립 리뷰는 읽기 도구만 준다 (D495) */
  tools?: readonly string[]
  /** 작업 폴더 밖에서 읽을 폴더 (--add-dir) */
  addDirs?: readonly string[]
  /** 끊을 때 (Work 포기). 끊으면 프로세스를 끝내고 error에 적는다 */
  signal?: AbortSignal
  /**
   * 출력 이벤트를 오는 대로 받는다 (독립 리뷰의 진행 표시, D502). 주면 `--output-format stream-json --verbose`로 부르고
   * 줄마다 읽은 JSON을 넘긴다. 결과는 마지막 `result` 이벤트에서 읽는다
   */
  onEvent?: (event: Record<string, unknown>) => void
}

export interface ClaudeJsonResult {
  /** 구조화된 출력. 실패면 null */
  data: unknown
  ms: number
  costUsd: number | null
  usage: { input: number; output: number; cacheRead: number; cacheCreation: number } | null
  error: string | null
}

/** claudeJson의 실행 인자. 계약 시험이 실제 claude의 --help와 맞춰 본다 (test/contract) */
export function claudeJsonArgs(
  input: Pick<ClaudeJsonInput, 'model' | 'effort' | 'system' | 'schema' | 'tools' | 'addDirs'> & {
    /** 출력 이벤트를 줄마다 받는다 (onEvent, D502) */
    stream?: boolean
  },
): string[] {
  return [
    '-p',
    ...(input.model ? ['--model', input.model] : []),
    ...(input.effort ? ['--effort', input.effort] : []),
    '--output-format',
    ...(input.stream ? ['stream-json', '--verbose'] : ['json']),
    '--system-prompt',
    input.system,
    '--json-schema',
    JSON.stringify(input.schema),
    '--tools',
    (input.tools ?? []).join(','),
    ...(input.addDirs ?? []).flatMap((d) => ['--add-dir', d]),
    '--no-session-persistence',
  ]
}

/**
 * claude -p를 한 번 부른다: 도구 없음, 세션을 남기지 않음(--no-session-persistence, 사용량이 에이전트 세션과 섞이지 않게),
 * 구조화된 출력(--json-schema). 프롬프트는 표준 입력으로 넘긴다. 실패해도 던지지 않고 error에 적는다
 */
export async function claudeJson(input: ClaudeJsonInput): Promise<ClaudeJsonResult> {
  const onEvent = input.onEvent
  const args = claudeJsonArgs({ ...input, stream: onEvent !== undefined })
  const started = Date.now()
  const lines = onEvent ? jsonLines(onEvent) : null
  const r = await run(input.bin, args, {
    cwd: input.cwd,
    env: input.env,
    timeoutMs: input.timeoutMs,
    input: input.prompt,
    ...(input.signal ? { signal: input.signal } : {}),
    ...(lines ? { onStdout: lines.push } : {}),
  })
  lines?.end()
  const ms = Date.now() - started
  const fail = (error: string): ClaudeJsonResult => ({
    data: null,
    ms,
    costUsd: null,
    usage: null,
    error,
  })
  if (r.code !== 0) return fail(describeFailure(r))
  let j: Record<string, unknown>
  if (lines) {
    const last = lines.result()
    if (!last) return fail(`결과 이벤트가 없음: ${r.stdout.slice(-200)}`)
    j = last
  } else {
    try {
      j = JSON.parse(r.stdout) as Record<string, unknown>
    } catch {
      return fail(`출력을 읽지 못함: ${r.stdout.slice(0, 200)}`)
    }
  }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const u = j['usage'] as Record<string, unknown> | undefined
  const usage = u
    ? {
        input: num(u['input_tokens']),
        output: num(u['output_tokens']),
        cacheRead: num(u['cache_read_input_tokens']),
        cacheCreation: num(u['cache_creation_input_tokens']),
      }
    : null
  const costUsd = typeof j['total_cost_usd'] === 'number' ? j['total_cost_usd'] : null
  const data = j['structured_output'] ?? null
  return {
    data,
    ms,
    costUsd,
    usage,
    error:
      j['is_error'] === true
        ? String(j['result'] ?? '오류')
        : data === null
          ? '구조화된 출력 없음'
          : null,
  }
}

/**
 * stream-json 출력을 줄로 나눠 읽는다 (D502). 읽은 줄마다 onEvent를 부르고, 마지막 `result` 이벤트를 남긴다. JSON이 아닌
 * 줄은 건너뛴다. 받는 쪽이 던져도 읽기는 이어 간다
 */
export function jsonLines(onEvent: (event: Record<string, unknown>) => void): {
  push: (chunk: string) => void
  end: () => void
  result: () => Record<string, unknown> | null
} {
  let rest = ''
  let last: Record<string, unknown> | null = null
  const line = (text: string) => {
    if (!text.trim()) return
    let e: unknown
    try {
      e = JSON.parse(text)
    } catch {
      return
    }
    if (typeof e !== 'object' || e === null || Array.isArray(e)) return
    const event = e as Record<string, unknown>
    if (event['type'] === 'result') last = event
    try {
      onEvent(event)
    } catch {
      // 진행 표시가 실패해도 결과는 읽는다
    }
  }
  return {
    push: (chunk) => {
      const parts = (rest + chunk).split('\n')
      rest = parts.pop() ?? ''
      for (const p of parts) line(p)
    },
    end: () => {
      line(rest)
      rest = ''
    },
    result: () => last,
  }
}
