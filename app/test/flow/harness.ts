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

/**
 * 세션의 첫 출력과 첫 훅 시각 (D217). 세션마다 남으므로, 이것을 보지 않는 시험은 events.jsonl을 통째로 비교할 때
 * 뺀다
 */
export const TIMING_EVENTS: readonly string[] = ['task.first_output', 'task.first_hook']

export { FakeUi, sleep } from './ui'

export interface HarnessOptions {
  /** 가짜 claude의 시나리오 (FAKE_CLAUDE_SCENARIO) */
  scenario?: object
  /**
   * config.json에 미리 쓸 값. 자동 승인은 준 단계만 이 값이고 나머지는 끈다(MANUAL). 앱의 기본값을 보려면
   * productDefaults를 켠다
   */
  config?: Partial<AppConfig>
  /** 자동 승인을 끄지 않고 앱의 기본값(원인 분석과 수정만 켬, D214)을 쓴다 */
  productDefaults?: boolean
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

/**
 * [흐름] 시험의 자동 승인 기본값: 모두 끈다. 시험은 사람이 승인하는 길을 기본으로 보고, 자동 승인은 켠 시험에서 본다.
 * 앱의 기본값(D214)과 다르다
 */
export const MANUAL: Pick<AppConfig, 'auto_approve'> = {
  auto_approve: {
    fix: false,
    design: false,
    implement: false,
    refactor: false,
    execute: false,
    respond: false,
  },
}

export async function harness(o: HarnessOptions = {}): Promise<Harness> {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-flow-')))
  const home = path.join(root, 'home')
  fs.mkdirSync(home)
  const config = o.productDefaults
    ? o.config
    : { ...o.config, auto_approve: { ...MANUAL.auto_approve, ...o.config?.auto_approve } }
  if (config) fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify(config))
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
    // 지식 관리(D283~)는 지식 시험(knowledge.test.ts)이 켜서 본다. 다른 흐름 시험은 끈 앱(지식 관리 전과 같음)으로 본다
    RELAY_KNOWLEDGE: 'off',
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
