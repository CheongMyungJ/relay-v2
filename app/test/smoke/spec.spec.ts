// [스모크] 설계 유형 (M20, D353): 새 Work 대화상자에서 설계를 골라 시작하고, 의도를 승인하면 설계 문답이 돈다. 앞 단계로
// 되감는 [단계 선택]은 없다 (D418). 설계 문답은 시작만 하고 기다린다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { makeRepo } from '../support/repo'
import {
  REPO_FILES,
  SPEC_REQUEST,
  specScenario,
  type Scenario,
  type Step,
} from '../support/scenarios'

const isWin = process.platform === 'win32'
const APP_DIR = path.resolve(__dirname, '../..')
const FAKE = path.resolve(
  __dirname,
  '../support/fake-claude',
  isWin ? 'fake-claude.cmd' : 'fake-claude.mjs',
)

/** 시작만 하는 설계 문답: 도구 하나를 쓰고 기다린다 */
const WAITING_SPEC: Step[] = [
  { do: 'prompt' },
  { do: 'tool', name: 'Read', input: { file_path: 'src/avg.js' } },
  { do: 'wait' },
]

let app: ElectronApplication
let root: string
let repo: string
let env: Record<string, string>

test.beforeAll(async () => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-smoke-spec-')))
  ;({ repo } = makeRepo(root, 'sample', REPO_FILES))
  const scenarioFile = path.join(root, 'scenario.json')
  const s: Scenario = specScenario({ spec: WAITING_SPEC })
  fs.writeFileSync(scenarioFile, JSON.stringify(s))
  env = {
    ...process.env,
    CLAUDE_BIN: FAKE,
    RELAY_HOME: path.join(root, 'home'),
    RELAY_UPDATE: 'off',
    FAKE_CLAUDE_SCENARIO: scenarioFile,
    FAKE_CLAUDE_RECORD: path.join(root, 'record'),
  } as Record<string, string>
  const exe = process.env['RELAY_APP_EXE']
  app = exe
    ? await electron.launch({ executablePath: exe, env })
    : await electron.launch({ args: [APP_DIR], env })
  await app.evaluate(({ dialog }, dir) => {
    dialog.showOpenDialog = (() =>
      Promise.resolve({ canceled: false, filePaths: [dir] })) as typeof dialog.showOpenDialog
    dialog.showMessageBox = (() =>
      Promise.resolve({ response: 0, checkboxChecked: false })) as typeof dialog.showMessageBox
  }, repo)
})

test.afterAll(async () => {
  await app?.close()
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

test('설계로 시작하고, 의도를 승인하면 설계 문답이 돈다 (D353)', async () => {
  const win = await app.firstWindow()
  await expect(win.locator('.layout')).toBeVisible()
  await win.locator('.sidebar').getByRole('button', { name: '프로젝트 추가' }).click()
  await win.getByRole('button', { name: '레포 폴더 고르기' }).click()
  await expect(win.locator('table.checks')).toContainText('git 레포의 루트인가', {
    timeout: 30_000,
  })
  await win.getByRole('button', { name: '등록' }).click()
  await expect(win.locator('.project-name')).toHaveText('sample', { timeout: 30_000 })

  // 새 Work: 설계를 고르면 설명이 보인다 (D353)
  await win.getByRole('button', { name: '새 Work' }).click()
  await win.getByLabel('요청').fill(SPEC_REQUEST)
  const types = win.getByRole('radiogroup', { name: '업무 유형' })
  await types.getByRole('radio', { name: '설계' }).click()
  await expect(win.locator('.work-type-hint')).toHaveText('구현 전에 설계만 정하는 큰 일')
  await win.getByRole('button', { name: '시작' }).click()

  // 의도 승인 → 설계 문답이 시작한다
  const approve = win.getByRole('button', { name: '의도 승인' })
  await expect(approve).toBeEnabled({ timeout: 60_000 })
  await approve.click()
  await expect(win.getByRole('tab', { name: /02 설계 문답/ })).toBeVisible({ timeout: 60_000 })
  await expect(win.locator('.band')).toContainText('02 설계 문답', { timeout: 60_000 })

  // 앞 단계로 되감는 [단계 선택]은 없다 (D418)
  await expect(win.getByRole('button', { name: '단계 선택', exact: true })).toHaveCount(0)
  await win.screenshot({ path: 'test-results/spec-running.png' })
})
