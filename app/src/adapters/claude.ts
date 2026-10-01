// claude 실행 파일 찾기(D106), 버전과 인증 점검(D105, D67), 이번 task의 스킬 배포(5.6.3, D103, D108).
// 실행 파일 찾기의 출처: spikes/lib/session.mjs resolveClaude. 스파이크는 못 찾으면 'claude'를 돌려줬지만,
// 앱은 PATH를 직접 뒤지고 못 찾으면 null을 돌려준다 (D106: 못 찾으면 등록을 막는다).
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { relaySkillName } from '../core/settings'
import type { SkillName } from '../shared/config'
import { WORK_TYPES, type WorkType } from '../shared/work'
import { describeFailure, run } from './exec'
import { sha256, writeFileAtomic } from './store'

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

  if (env['CLAUDE_BIN']) return env['CLAUDE_BIN']

  const candidates: string[] = []
  if (platform === 'win32') {
    if (env['USERPROFILE'])
      candidates.push(p.join(env['USERPROFILE'], '.local', 'bin', 'claude.exe'))
    if (env['APPDATA']) candidates.push(p.join(env['APPDATA'], 'npm', 'claude.cmd'))
  }
  const names = platform === 'win32' ? ['claude.exe', 'claude.cmd'] : ['claude']
  // Windows는 환경 변수 이름의 대소문자를 가리지 않는다.
  const pathVar = env['PATH'] ?? env['Path'] ?? ''
  for (const dir of pathVar.split(platform === 'win32' ? ';' : ':')) {
    if (!dir) continue
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

// ---------- 스킬 배포 (5.6.3, D103, D108) ----------

export const SKILL_FILE = 'SKILL.md'
export const COMMON_FILE = '_common.md'

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

const TYPE_OPEN = /^<!-- type: ([a-z]+(?: [a-z]+)*) -->$/
const TYPE_CLOSE = '<!-- /type -->'
const TYPE_LIKE = /^\s*<!--\s*\/?\s*type\b/i

/**
 * 공용 스킬에서 그 Work 유형의 구간만 남긴다 (5.6.3, D279). `<!-- type: feature refactor -->` 줄과 `<!-- /type -->` 줄
 * 사이는 적힌 유형에만 남고, 표시 줄은 지운다. 표시 밖은 모든 유형에 남는다. 구간은 겹치지 않는다. 표시처럼 보이지만
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
      const unknown = types.filter((t) => !(WORK_TYPES as readonly string[]).includes(t))
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

/** 배포할 스킬 내용: 그 Work 유형의 구간만 남기고(D279) 공통 규칙을 끝에 붙인다 (5.6.3) */
export async function skillText(source: string, skill: SkillName, type: WorkType): Promise<string> {
  const body = await fsp.readFile(path.join(source, skill, SKILL_FILE), 'utf8')
  const common = await fsp.readFile(path.join(source, COMMON_FILE), 'utf8')
  return mergeSkill(selectType(body, type), selectType(common, type))
}

export interface DeployedSkill {
  /** 배포한 SKILL.md의 경로 */
  file: string
  /** 배포한 내용의 해시. work.json에 적는다 (D103) */
  hash: string
}

/**
 * 이번 task의 스킬을 Work 디렉터리의 .claude/skills/relay-<이름>/에 배포하고 다른 relay 스킬 폴더는 지운다 (D108).
 * Claude Code는 --add-dir로 더한 디렉터리의 .claude/skills/를 읽으므로 worktree는 건드리지 않는다 (D32).
 */
export async function deploySkill(o: {
  source: string
  workDir: string
  taskDir?: string
  skill: SkillName
  /** Work 유형. 공용 스킬에서 그 유형의 구간만 배포한다 (D279) */
  type: WorkType
}): Promise<DeployedSkill> {
  const merged = await skillText(o.source, o.skill, o.type)
  const root = path.join(o.workDir, '.claude', 'skills')
  const name = relaySkillName(o.skill)
  await fsp.mkdir(root, { recursive: true })
  for (const entry of await fsp.readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith('relay-')) {
      await fsp.rm(path.join(root, entry.name), { recursive: true, force: true })
    }
  }
  const file = path.join(root, name, SKILL_FILE)
  await writeFileAtomic(file, merged)
  return { file, hash: `sha256:${sha256(merged)}` }
}
