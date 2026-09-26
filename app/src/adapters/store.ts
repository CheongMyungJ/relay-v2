// 중앙 저장소 (5.1). RELAY_HOME 아래의 파일을 읽고 쓴다. 상태 파일은 임시 파일에 쓰고
// 이름을 바꾸는 방식으로 원자적으로 쓴다 (I11). 파일의 모양은 core/records가 정한다.
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { normalizeConfig } from '../core/config'
import { taskDirName } from '../core/machine'
import { appendBlock } from '../core/records'
import { DEFAULT_CONFIG, type AppConfig } from '../shared/config'
import type { ProjectState } from '../shared/project'
import type { LifecycleEvent, TaskRecord, WorkState } from '../shared/work'

/** 저장소 위치. 환경 변수 RELAY_HOME으로만 바꾼다 (D74). 기본은 사용자 폴더의 .relay */
export function relayHome(env: NodeJS.ProcessEnv = process.env): string {
  const home = env['RELAY_HOME']
  return path.resolve(home ? home : path.join(os.homedir(), '.relay'))
}

/** 출처: spikes/lib/util.mjs sha256 */
export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * 실제 경로. Windows의 8.3 짧은 이름(예: RUNNER~1)과 대소문자를 실제 이름으로 바꾼다.
 * 경로가 없으면 절대 경로만 만든다.
 */
export function canonicalPath(p: string): string {
  const abs = path.resolve(p)
  try {
    return fs.realpathSync.native(abs)
  } catch {
    return abs
  }
}

/** 같은 경로인지 비교하는 키. Windows는 대소문자를 가리지 않는다 */
export function pathKey(p: string): string {
  const c = canonicalPath(p)
  return process.platform === 'win32' ? c.toLowerCase() : c
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Windows에서는 다른 프로세스(백신, 색인)가 대상 파일을 잠깐 열고 있으면 이름 바꾸기가 실패한다.
const RETRY_CODES = new Set(['EPERM', 'EACCES', 'EBUSY'])

/** 임시 파일에 쓰고 이름을 바꾼다 (I11, 5.1) */
export async function writeFileAtomic(file: string, text: string): Promise<void> {
  await fsp.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  const fh = await fsp.open(tmp, 'w')
  try {
    await fh.writeFile(text, 'utf8')
    await fh.sync()
  } finally {
    await fh.close()
  }
  for (let attempt = 0; ; attempt++) {
    try {
      await fsp.rename(tmp, file)
      return
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? ''
      if (attempt >= 10 || !RETRY_CODES.has(code)) {
        await fsp.rm(tmp, { force: true })
        throw e
      }
      await sleep(20 * (attempt + 1))
    }
  }
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`)
}

/** 파일 내용. 없으면 null */
export async function readText(file: string): Promise<string | null> {
  try {
    return await fsp.readFile(file, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

async function readJson<T>(file: string): Promise<T | null> {
  const text = await readText(file)
  return text === null ? null : (JSON.parse(text) as T)
}

async function subdirs(dir: string): Promise<string[]> {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
}

// ---------- 앱 설정 (5.1.1) ----------

export interface LoadedConfig {
  config: AppConfig
  /** config.json을 읽지 못해 기본값을 쓴 이유 */
  warning?: string
}

/**
 * config.json을 읽는다. 없으면 기본값으로 만든다. 없는 키와 값이 틀린 키는 기본값을 쓴다(core/config).
 * 읽을 수 없으면 파일을 그대로 두고 기본값을 쓴다.
 */
export async function loadConfig(home: string): Promise<LoadedConfig> {
  const file = path.join(home, 'config.json')
  const text = await readText(file)
  if (text === null) {
    await writeJson(file, DEFAULT_CONFIG)
    return { config: DEFAULT_CONFIG }
  }
  try {
    const { config, warnings } = normalizeConfig(JSON.parse(text))
    return warnings.length ? { config, warning: warnings.join(' / ') } : { config }
  } catch (e) {
    return {
      config: DEFAULT_CONFIG,
      warning: `config.json을 읽을 수 없어 기본값을 씁니다: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

/** 설정 화면에서 바꾼 앱 설정을 쓴다 (D70) */
export async function saveConfig(home: string, config: AppConfig): Promise<void> {
  await writeJson(path.join(home, 'config.json'), config)
}

// ---------- 프로젝트 (5.1) ----------

export function projectDir(home: string, projectId: string): string {
  return path.join(home, 'projects', projectId)
}

export function workDir(home: string, projectId: string, workId: string): string {
  return path.join(projectDir(home, projectId), 'works', workId)
}

export function worktreeDir(home: string, projectId: string, workId: string): string {
  return path.join(projectDir(home, projectId), 'worktrees', workId)
}

export async function loadProjects(home: string): Promise<ProjectState[]> {
  const out: ProjectState[] = []
  for (const id of await subdirs(path.join(home, 'projects'))) {
    const p = await readJson<ProjectState>(path.join(projectDir(home, id), 'project.json'))
    if (p) out.push(p)
  }
  return out
}

export async function saveProject(home: string, project: ProjectState): Promise<void> {
  await writeJson(path.join(projectDir(home, project.project_id), 'project.json'), project)
}

/** 프로젝트의 Work id (works/ 아래 디렉터리 이름) */
export async function workIds(home: string, projectId: string): Promise<string[]> {
  return subdirs(path.join(projectDir(home, projectId), 'works'))
}

// ---------- Work (5.1) ----------

export interface PtyLog {
  write(data: string): void
  close(): Promise<void>
}

/** works/<work-id>/ 아래의 파일 */
export class WorkFiles {
  readonly workJson: string
  readonly request: string
  readonly intent: string
  readonly intentHistory: string
  readonly decisions: string
  readonly events: string

  constructor(readonly dir: string) {
    this.workJson = path.join(dir, 'work.json')
    this.request = path.join(dir, 'request.md')
    this.intent = path.join(dir, 'intent.md')
    this.intentHistory = path.join(dir, 'intent.history')
    this.decisions = path.join(dir, 'decisions.md')
    this.events = path.join(dir, 'events.jsonl')
  }

  /** tasks/<nn>-<node> */
  taskDir(task: Pick<TaskRecord, 'seq' | 'node'>): string {
    return path.join(this.dir, 'tasks', taskDirName(task))
  }

  load(): Promise<WorkState | null> {
    return readJson<WorkState>(this.workJson)
  }

  /** 전이마다 쓴다 (I11) */
  save(work: WorkState): Promise<void> {
    return writeJson(this.workJson, work)
  }

  writeRequest(text: string): Promise<void> {
    return writeFileAtomic(this.request, text)
  }

  async readRequest(): Promise<string> {
    return (await readText(this.request)) ?? ''
  }

  readIntent(): Promise<string | null> {
    return readText(this.intent)
  }

  /** intent.md를 새 버전으로 바꾼다. 이전 버전은 intent.history/v<N>.md에 둔다 (5.3) */
  async writeIntent(text: string, version: number): Promise<void> {
    const previous = await this.readIntent()
    if (previous !== null && version > 1) {
      await writeFileAtomic(path.join(this.intentHistory, `v${version - 1}.md`), previous)
    }
    await writeFileAtomic(this.intent, text)
  }

  async readDecisions(): Promise<string> {
    return (await readText(this.decisions)) ?? ''
  }

  /** decisions.md에 덩어리를 더한다 (5.4) */
  async appendDecisions(block: string): Promise<void> {
    await writeFileAtomic(this.decisions, appendBlock(await this.readDecisions(), block))
  }

  /** events.jsonl에 한 줄 더한다 (5.5) */
  async appendEvent(event: LifecycleEvent): Promise<void> {
    await fsp.mkdir(this.dir, { recursive: true })
    await fsp.appendFile(this.events, `${JSON.stringify(event)}\n`, 'utf8')
  }

  async readEvents(): Promise<LifecycleEvent[]> {
    const text = (await readText(this.events)) ?? ''
    return text
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as LifecycleEvent)
  }

  /** task 디렉터리 바로 아래의 .md 파일. 이름 → 내용 (core/validate checkTask의 입력) */
  async taskFiles(task: Pick<TaskRecord, 'seq' | 'node'>): Promise<Record<string, string>> {
    const dir = this.taskDir(task)
    const out: Record<string, string> = {}
    for (const name of await mdFiles(dir)) {
      const text = await readText(path.join(dir, name))
      if (text !== null) out[name] = text
    }
    return out
  }

  /** 산출물의 절대 경로: task 디렉터리의 .md 중 context.md와 handoff.md를 뺀 것 (D89) */
  async artifacts(task: Pick<TaskRecord, 'seq' | 'node'>): Promise<string[]> {
    const dir = this.taskDir(task)
    return (await mdFiles(dir)).filter((n) => !NOT_ARTIFACTS.has(n)).map((n) => path.join(dir, n))
  }

  /** 터미널 출력을 이어 쓰는 pty.log (시나리오 5-1). 충돌하면 끝부분이 잘릴 수 있다 (시나리오 9-5) */
  openPtyLog(task: Pick<TaskRecord, 'seq' | 'node'>): PtyLog {
    const file = path.join(this.taskDir(task), 'pty.log')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const stream = fs.createWriteStream(file, { flags: 'a' })
    stream.on('error', () => {})
    return {
      write: (data) => void stream.write(data),
      close: () =>
        new Promise((resolve) => {
          if (stream.closed) resolve()
          else stream.end(() => resolve())
        }),
    }
  }
}

const NOT_ARTIFACTS = new Set(['context.md', 'handoff.md'])

async function mdFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    return entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
      .map((e) => e.name)
      .sort()
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
}
