// [스모크] 커스텀 유형 (M30, D459, D460): 업무 유형 화면에서 전역 유형을 만들면 새 Work 대화상자의 기본 다섯 뒤에 보이고,
// 고르면 설명과 단계 목록이 보인다. 시작해 의도를 승인하면 첫 커스텀 단계가 그 이름의 탭으로 돈다(시작만 하고 기다린다).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { makeRepo } from '../support/repo'
import {
  GENERAL_REQUEST,
  REPO_FILES,
  generalIntentDraft,
  steps,
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

/** 시작만 하는 커스텀 단계: 도구 하나를 쓰고 기다린다 */
const WAITING: Step[] = [
  { do: 'prompt' },
  { do: 'tool', name: 'Read', input: { file_path: 'src/avg.js' } },
  { do: 'wait' },
]

let app: ElectronApplication
let root: string
let repo: string

test.beforeAll(async () => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-smoke-custom-')))
  ;({ repo } = makeRepo(root, 'sample', REPO_FILES))
  const scenarioFile = path.join(root, 'scenario.json')
  const intake = steps('intake').map((st) =>
    st.do === 'write' && st.file === 'intent.draft.md' ? { ...st, text: generalIntentDraft() } : st,
  )
  const s: Scenario = { tasks: { 'work-start': intake, 't-02': WAITING } }
  fs.writeFileSync(scenarioFile, JSON.stringify(s))
  const env = {
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

test('업무 유형 화면에서 만든 유형으로 시작하면 의도 승인 뒤 첫 커스텀 단계가 돈다 (D459, D460)', async () => {
  const win = await app.firstWindow()
  await expect(win.locator('.layout')).toBeVisible()
  await win.locator('.sidebar').getByRole('button', { name: '프로젝트 추가' }).click()
  await win.getByRole('button', { name: '레포 폴더 고르기' }).click()
  await expect(win.locator('table.checks')).toContainText('git 레포의 루트인가', {
    timeout: 30_000,
  })
  await win.getByRole('button', { name: '등록' }).click()
  await expect(win.locator('.project-name')).toHaveText('sample', { timeout: 30_000 })

  // 업무 유형 화면: 새 유형을 만든다 (D459)
  await win.locator('.sidebar').getByRole('button', { name: '설정', exact: true }).click()
  await win.getByRole('button', { name: '업무 유형…' }).click()
  await win.getByRole('button', { name: '새 유형' }).click()
  await win.getByLabel('유형 id').fill('survey-apply')
  await win.getByLabel('유형 이름').fill('조사 후 적용')
  await win.getByLabel('유형 설명').fill('먼저 조사하고 그대로 적용하는 일')
  await win.getByLabel('단계 1 id').fill('survey')
  await win.getByLabel('단계 1 이름').fill('조사')
  await win.getByLabel('단계 1 절차').fill('바꿀 곳을 모두 찾는다.')
  await win.getByLabel('시작점').selectOption('execute')
  await win.getByRole('button', { name: '단계 더하기' }).click()
  await expect(win.getByLabel('단계 2 절차')).toHaveValue(/^# relay: execute/)
  await win.getByLabel('단계 2 id').fill('apply')
  await win.getByLabel('단계 2 이름').fill('적용')
  await win.screenshot({ path: 'test-results/custom-editor.png' })
  await win.getByRole('button', { name: '저장' }).click()
  const row = win.getByRole('listitem', { name: '유형 survey-apply' })
  await expect(row).toContainText('단계: 의도 정리 → 조사 → 적용 → 리뷰와 검증')
  expect(fs.readdirSync(path.join(root, 'home', 'types', 'survey-apply')).sort()).toEqual([
    'apply.md',
    'survey.md',
    'type.json',
  ])
  await win.getByRole('button', { name: '닫기' }).click()

  // 새 Work: 기본 다섯 뒤에 커스텀 유형이 보이고, 고르면 설명과 단계가 보인다 (D460)
  await win.getByRole('button', { name: '새 Work' }).click()
  await win.getByLabel('요청').fill(GENERAL_REQUEST)
  const types = win.getByRole('radiogroup', { name: '업무 유형' })
  await expect(types.getByRole('radio')).toHaveCount(6)
  await types.getByRole('radio', { name: '조사 후 적용' }).click()
  await expect(win.locator('.work-type-hint')).toContainText('먼저 조사하고 그대로 적용하는 일')
  await expect(win.locator('.work-type-hint')).toContainText(
    '단계: 의도 정리 → 조사 → 적용 → 리뷰와 검증',
  )
  await win.screenshot({ path: 'test-results/custom-new-work.png' })
  await win.getByRole('button', { name: '시작' }).click()

  const approve = win.getByRole('button', { name: '의도 승인' })
  await expect(approve).toBeEnabled({ timeout: 60_000 })
  await approve.click()
  await expect(win.getByRole('tab', { name: /02 조사/ })).toBeVisible({ timeout: 60_000 })
  await expect(win.locator('.band')).toContainText('02 조사', { timeout: 60_000 })
  await win.screenshot({ path: 'test-results/custom-running.png' })
})
