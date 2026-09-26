// [흐름]과 [실제] 시험의 도구 (I26). main의 조립 코드(Relay)를 Electron 없이 불러 쓰고,
// 창과 알림, 렌더러로 보내기는 받은 것을 모으는 가짜 화면(FakeUi)으로 바꾼다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Notice, UiPort } from '../../src/main/ports'
import { Relay } from '../../src/main/relay'
import type { AppConfig } from '../../src/shared/config'
import type { ProjectView, TerminalChunk, WorkView } from '../../src/shared/views'

export { git, makeRepo, writeFiles, type Repo } from './repo'

export const APP = path.resolve(__dirname, '../..')
export const SKILLS = path.resolve(APP, '../skills')
const isWin = process.platform === 'win32'
export const FAKE_CLAUDE = path.join(
  APP,
  'test/fake-claude',
  isWin ? 'fake-claude.cmd' : 'fake-claude.mjs',
)
export const FAKE_GH = path.join(APP, 'test/fake-gh', isWin ? 'gh.cmd' : 'gh.mjs')

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 받은 스냅샷, 터미널 출력, 알림을 모은다 */
export class FakeUi implements UiPort {
  readonly works = new Map<string, WorkView>()
  /** Work마다 받은 스냅샷 전부 (되돌림 횟수 세기용) */
  readonly history: WorkView[] = []
  projectList: ProjectView[] = []
  readonly output = new Map<string, string>()
  readonly notices: Notice[] = []
  private readonly listeners = new Set<() => void>()

  work(view: WorkView): void {
    this.works.set(view.key, view)
    this.history.push(view)
    this.wake()
  }

  projects(views: ProjectView[]): void {
    this.projectList = views
    this.wake()
  }

  terminal(key: string, chunk: TerminalChunk): void {
    this.output.set(key, (this.output.get(key) ?? '') + chunk.data)
    this.wake()
  }

  notify(n: Notice): void {
    this.notices.push(n)
    this.wake()
  }

  /** 무엇이든 바뀌면 부른다. 돌려준 함수로 끊는다 */
  onChange(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private wake(): void {
    for (const cb of this.listeners) cb()
  }

  /** pred가 값을 돌려줄 때까지 기다린다. 기다리는 동안 tick을 부른다 */
  async until<T>(
    pred: () => T | null | undefined | false,
    label: string,
    timeoutMs = 60_000,
    tick?: () => unknown,
  ): Promise<T> {
    const end = Date.now() + timeoutMs
    for (;;) {
      const v = pred()
      if (v) return v
      if (Date.now() > end) throw new Error(`시간 초과: ${label}\n${this.dump()}`)
      await tick?.()
      await new Promise<void>((resolve) => {
        const off = this.onChange(() => {
          off()
          resolve()
        })
        setTimeout(() => {
          off()
          resolve()
        }, 250)
      })
    }
  }

  /** 실패했을 때 보일 상태: Work와 task 표시, 터미널 끝부분 */
  dump(): string {
    const lines: string[] = []
    for (const w of this.works.values()) {
      lines.push(`Work ${w.key}: ${w.statusLabel} ${w.stopNotice ?? ''}`)
      for (const p of w.problems) lines.push(`  문제: ${p}`)
      for (const t of w.tasks) {
        lines.push(`  ${t.label}: ${t.statusLabel}${t.live ? ' (세션)' : ''} ${t.error ?? ''}`)
        const tail = (this.output.get(t.terminal) ?? '').split(/\r?\n/).slice(-8).join('\n    ')
        if (tail.trim()) lines.push(`    ${tail}`)
      }
    }
    return lines.join('\n')
  }
}

export interface HarnessOptions {
  /** 가짜 claude의 시나리오 (FAKE_CLAUDE_SCENARIO) */
  scenario?: object
  /** config.json에 미리 쓸 값 */
  config?: Partial<AppConfig>
  /** 앱에 넘길 환경 변수에 더할 것 */
  env?: Record<string, string>
  /** claude 실행 파일. 기본은 가짜 claude다. [실제]는 실제 claude를 쓴다 */
  claudeBin?: string | null
  ui?: FakeUi
}

export interface Harness {
  root: string
  home: string
  relay: Relay
  ui: FakeUi
  env: NodeJS.ProcessEnv
  /** 가짜 claude가 남긴 기록 */
  records(): Record<string, unknown>[]
  /** 같은 RELAY_HOME으로 앱을 다시 켠다(재시작 조정, 시나리오 9). 앞 Relay는 닫혀 있어야 한다 */
  reopen(): Promise<void>
  close(): Promise<void>
}

export async function harness(o: HarnessOptions = {}): Promise<Harness> {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-flow-')))
  const home = path.join(root, 'home')
  fs.mkdirSync(home)
  if (o.config) fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify(o.config))
  const record = path.join(root, 'record')
  const scenario = path.join(root, 'scenario.json')
  fs.writeFileSync(scenario, JSON.stringify(o.scenario ?? { tasks: {} }))
  const claude = o.claudeBin === undefined ? FAKE_CLAUDE : o.claudeBin
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    FAKE_CLAUDE_SCENARIO: scenario,
    FAKE_CLAUDE_RECORD: record,
    ...(claude ? { CLAUDE_BIN: claude } : {}),
    ...o.env,
  }
  const ui = o.ui ?? new FakeUi()
  const open = (u: FakeUi) => Relay.open({ home, skills: SKILLS, ui: u, env, ghBin: FAKE_GH })
  const h: Harness = {
    root,
    home,
    relay: await open(ui),
    ui,
    env,
    records: () => {
      const file = path.join(record, 'fake-claude.jsonl')
      if (!fs.existsSync(file)) return []
      return fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, unknown>)
    },
    reopen: async () => {
      h.ui = new FakeUi()
      h.relay = await open(h.ui)
    },
    close: async () => {
      await h.relay.close()
      // Windows는 끝낸 프로세스가 파일을 잠깐 잡고 있을 수 있다
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    },
  }
  return h
}

/** Work의 처리 줄이 빌 때까지 기다린다. 스냅샷은 할 일(파일 쓰기)보다 먼저 나가므로 파일을 읽기 전에 부른다 */
export async function settle(h: Harness, workKey: string): Promise<void> {
  await h.relay.work(workKey)?.enqueue(async () => undefined)
}

/** 프로젝트를 등록하고 id를 돌려준다 */
export async function register(h: Harness, repo: string, branch = 'main'): Promise<string> {
  const r = await h.relay.registerProject(repo, branch)
  if (!r.ok) throw new Error(`등록 실패: ${r.error}`)
  if (!r.projectId) throw new Error('project id 없음')
  return r.projectId
}
