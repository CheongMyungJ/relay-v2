// [흐름]과 [실제] 시험의 도구 (I26). main의 조립 코드(Relay)를 Electron 없이 불러 쓰고,
// 창과 알림, 렌더러로 보내기는 받은 것을 모으는 가짜 화면(FakeUi)으로 바꾼다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Relay } from '../../src/main/relay'
import type { AppConfig } from '../../src/shared/config'
import { FakeUi } from './ui'

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
export const FAKE_CODEX = path.join(
  APP,
  'test/fake-codex',
  isWin ? 'fake-codex.cmd' : 'fake-codex.mjs',
)

export { FakeUi, sleep } from './ui'

export interface HarnessOptions {
  /** 가짜 claude의 시나리오 (FAKE_CLAUDE_SCENARIO) */
  scenario?: object
  /** config.json에 미리 쓸 값 */
  config?: Partial<AppConfig>
  /** 앱에 넘길 환경 변수에 더할 것 */
  env?: Record<string, string>
  /** claude 실행 파일. 기본은 가짜 claude다. [실제]는 실제 claude를 쓴다 */
  claudeBin?: string | null
  codexBin?: string
  /** gh 실행 파일. 기본은 가짜 gh다. [실제]의 PR 진행(M9)은 실제 gh를 쓴다 */
  ghBin?: string
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
  codexRecords(): Record<string, unknown>[]
  /** 가짜 gh가 남긴 기록 (8.2) */
  ghRecords(): Record<string, unknown>[]
  /** 같은 RELAY_HOME으로 앱을 다시 켠다(재시작 조정, 시나리오 9). 앞 Relay는 닫혀 있어야 한다. ui가 없으면 새 FakeUi다 */
  reopen(ui?: FakeUi): Promise<void>
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
    FAKE_CODEX_SCENARIO: scenario,
    FAKE_CODEX_RECORD: record,
    CODEX_BIN: o.codexBin ?? FAKE_CODEX,
    FAKE_GH_RECORD: record,
    ...(claude ? { CLAUDE_BIN: claude } : {}),
    ...o.env,
  }
  const ui = o.ui ?? new FakeUi()
  const ghBin = o.ghBin ?? FAKE_GH
  const open = (u: FakeUi) => Relay.open({ home, skills: SKILLS, ui: u, env, ghBin })
  const jsonl = (name: string) => {
    const file = path.join(record, name)
    if (!fs.existsSync(file)) return []
    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Record<string, unknown>)
  }
  const h: Harness = {
    root,
    home,
    relay: await open(ui),
    ui,
    env,
    records: () => jsonl('fake-claude.jsonl'),
    codexRecords: () => jsonl('fake-codex.jsonl'),
    ghRecords: () => jsonl('fake-gh.jsonl'),
    reopen: async (ui = new FakeUi()) => {
      h.ui = ui
      h.relay = await open(h.ui)
    },
    close: async () => {
      await h.relay.close()
      // 하던 PR 읽기의 gh·git이 레포 폴더를 작업 폴더로 쓰는 동안 Windows는 그 폴더를 지우지 못한다
      await h.relay.settled()
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
