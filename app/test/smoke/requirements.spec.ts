// [스모크] 요구사항 추출 유형 (requirements-extraction-flow.md 17.12): 새 Work 대화상자에서 요구사항 추출을 골라 시작하고,
// 의도를 승인하면 extract가 run을 돈다. survey가 사람 결정 필요를 내면 멈추고 패널의 진행 상자에 양식이 보인다. 선택지를
// 골라 보내면 반영 대기가 되고, [재개]하면 답을 반영해 trace run을 돌고 승인 대기가 된다. run은 가짜 claude의 -p run이다.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { makeRepo } from '../support/repo'
import { extractSurvey, extractTrace } from '../support/requirements'
import { REPO_FILES, scenario } from '../support/scenarios'

const isWin = process.platform === 'win32'
const APP_DIR = path.resolve(__dirname, '../..')
const ROOT = path.resolve(APP_DIR, '..')
const FAKE = path.resolve(
  __dirname,
  '../support/fake-claude',
  isWin ? 'fake-claude.cmd' : 'fake-claude.mjs',
)

/** 렌즈 카드의 열쇠 목록. 스모크는 CommonJS로 옮겨져 skills의 ES 모듈을 바로 부르지 못하므로 node로 읽는다 */
function checklistIds(lens: string): string[] {
  const load = path.join(ROOT, 'skills', 'extract', 'load.mjs')
  const code = `const { loadChecklist } = await import(${JSON.stringify(`file://${load}`)});
console.log(JSON.stringify(loadChecklist(${JSON.stringify(lens)}, ${JSON.stringify(ROOT)}).map((c) => c.id)))`
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' }),
  ) as string[]
}

let app: ElectronApplication
let root: string
let repo: string

test.beforeAll(async () => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-smoke-req-')))
  ;({ repo } = makeRepo(root, 'sample', REPO_FILES))
  const scenarioFile = path.join(root, 'scenario.json')
  fs.writeFileSync(scenarioFile, JSON.stringify(scenario()))
  const survey = extractSurvey({
    human_decisions: [
      {
        key: 'd1',
        trigger: 'shipping_config',
        question: '어느 구성이 출하되나?',
        options: ['node만', '모두'],
        refs: ['k1'],
      },
    ],
  })
  const trace = extractTrace(checklistIds('command'))
  const plan = path.join(root, 'plan.json')
  fs.writeFileSync(plan, JSON.stringify({ runs: [survey, trace].map((o) => ({ outputs: [o] })) }))
  const env = {
    ...process.env,
    CLAUDE_BIN: FAKE,
    RELAY_HOME: path.join(root, 'home'),
    RELAY_UPDATE: 'off',
    FAKE_CLAUDE_SCENARIO: scenarioFile,
    FAKE_CLAUDE_RECORD: path.join(root, 'record'),
    FAKE_CLAUDE_RUN: plan,
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

test('요구사항 추출: 사람 결정 필요에 패널 양식으로 답하고 [재개]하면 이어서 돌아 승인 대기가 된다 (결정 7, 41)', async () => {
  const win = await app.firstWindow()
  await expect(win.locator('.layout')).toBeVisible()
  await win.locator('.sidebar').getByRole('button', { name: '프로젝트 추가' }).click()
  await win.getByRole('button', { name: '레포 폴더 고르기' }).click()
  await expect(win.locator('table.checks')).toContainText('git 레포의 루트인가', {
    timeout: 30_000,
  })
  await win.getByRole('button', { name: '등록' }).click()
  await expect(win.locator('.project-name')).toHaveText('sample', { timeout: 30_000 })

  await win.getByRole('button', { name: '새 Work' }).click()
  await win.getByLabel('요청').fill('이 저장소의 평균 계산 동작을 요구사항으로 정리해 줘')
  const types = win.getByRole('radiogroup', { name: '업무 유형' })
  await types.getByRole('radio', { name: '요구사항 추출' }).click()
  await win.getByRole('button', { name: '시작' }).click()

  const approve = win.getByRole('button', { name: '의도 승인' })
  await expect(approve).toBeEnabled({ timeout: 60_000 })
  await approve.click()

  // survey가 결정을 내면 멈추고 진행 상자에 양식이 보인다
  const box = win.getByLabel('요구사항 추출', { exact: true })
  await expect(box).toContainText('멈춤: 사람 결정 필요에 답해야 함', { timeout: 60_000 })
  await expect(box).toContainText('run 1/100')
  await expect(box).toContainText('h-0001 · 어느 구성이 출하되나?')
  await box.getByRole('radio', { name: 'node만' }).check()
  await box.getByRole('button', { name: '답 보내기' }).click()
  await expect(box).toContainText('답: node만 (반영 대기)', { timeout: 30_000 })
  await win.screenshot({ path: 'test-results/requirements-decision.png' })

  // [재개]하면 답을 반영하고 trace run을 돌아 승인 대기가 된다
  await win.locator('.action-bar').getByRole('button', { name: '재개', exact: true }).click()
  await expect(box).toContainText('run 2/100', { timeout: 60_000 })
  await expect(box).not.toContainText('h-0001')
  await expect(win.locator('.band')).toContainText('승인 대기', { timeout: 60_000 })
})
