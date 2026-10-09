// [스모크] 요구사항 추출 유형 (requirements-extraction-flow.md 17.12): 새 Work 대화상자에서 요구사항 추출을 골라 시작하고,
// 의도를 승인하면 extract가 run을 돈다. survey가 사람 결정 필요를 내면 멈추고 패널의 진행 상자에 양식이 보인다. 선택지를
// 골라 보내면 반영 대기가 되고, [재개]하면 답을 반영해 trace run을 돌고 승인 대기가 된다. run은 가짜 claude의 -p run이다.
// 설정 화면의 "요구사항 추출" 절(결정 31, 102)에서 run 상한을 바꾸면 config.json에 쓰고 진행 상자의 상한이 바뀐다.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { makeRepo } from '../support/repo'
import {
  extractIntegrate,
  extractReview,
  extractSummarize,
  extractSurvey,
  extractTrace,
} from '../support/requirements'
import { REPO_FILES, scenario } from '../support/scenarios'

const isWin = process.platform === 'win32'
const APP_DIR = path.resolve(__dirname, '../..')
const ROOT = path.resolve(APP_DIR, '..')
const FAKE = path.resolve(
  __dirname,
  '../support/fake-claude',
  isWin ? 'fake-claude.cmd' : 'fake-claude.mjs',
)

/** 렌즈 카드의 열쇠 목록과 integrate의 관점. 스모크는 CommonJS로 옮겨져 skills의 ES 모듈을 바로 부르지 못하므로 node로 읽는다 */
function loadIds(call: string): string[] {
  const load = path.join(ROOT, 'skills', 'extract', 'load.mjs')
  const code = `const m = await import(${JSON.stringify(`file://${load}`)});
console.log(JSON.stringify(m.${call}.map((c) => c.id)))`
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' }),
  ) as string[]
}
const checklistIds = (lens: string) =>
  loadIds(`loadChecklist(${JSON.stringify(lens)}, ${JSON.stringify(ROOT)})`)

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
  // 생산 run 뒤의 끝: 마지막 integrate, review(survey 대상 q1, trace 관찰 s1), summarize (AI 결정 111~113)
  const integrate = extractIntegrate(loadIds(`loadPerspectives(${JSON.stringify(ROOT)})`))
  const runs = [survey, trace, integrate, extractReview(['q1'], ['s1']), extractSummarize()]
  const plan = path.join(root, 'plan.json')
  fs.writeFileSync(plan, JSON.stringify({ runs: runs.map((o) => ({ outputs: [o] })) }))
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
  await expect(win.locator('.band')).toContainText('승인 대기', { timeout: 60_000 })
  // trace 뒤의 integrate, review, summarize까지 run 다섯 (AI 결정 111~113)
  await expect(box).toContainText('run 5/100')
  await expect(box).not.toContainText('h-0001')
  // run 목록 (AI 결정 115): 펼치면 run마다 종류와 결과, 한 줄을 누르면 자세히
  const runs = box.locator('details.requirements-runs')
  await runs.locator('summary').click()
  await expect(runs).toContainText('run 기록 5개')
  await expect(runs).toContainText('integrate')
  await expect(runs).toContainText('summarize')
  await win.screenshot({ path: 'test-results/requirements-runs.png' })
})

test('설정 화면의 요구사항 추출 절: run 상한을 바꾸면 저장되고 진행 상자에 보인다. 마감이 상한보다 길면 받지 않는다 (결정 31, 102)', async () => {
  const win = await app.firstWindow()
  const box = win.getByLabel('요구사항 추출', { exact: true })
  await expect(box).toContainText('run 5/100')
  await win.locator('.sidebar').getByRole('button', { name: '설정', exact: true }).click()
  const budget = win.getByRole('group', { name: '요구사항 추출 예산' })
  await expect(budget.getByLabel('Work당 run 상한', { exact: true })).toHaveValue('100')
  await budget.getByLabel('run 하나의 부드러운 마감(분)', { exact: true }).fill('30')
  await win.getByRole('button', { name: '저장', exact: true }).click()
  await expect(win.locator('.modal .error')).toContainText('시간 상한(분)보다 짧아야 함')
  await budget.getByLabel('run 하나의 부드러운 마감(분)', { exact: true }).fill('10')
  await budget.getByLabel('Work당 run 상한', { exact: true }).fill('50')
  await win.screenshot({ path: 'test-results/requirements-settings.png' })
  await win.getByRole('button', { name: '저장', exact: true }).click()
  await expect(budget).toBeHidden()
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'home', 'config.json'), 'utf8')) as {
    requirements_budget: Record<string, number>
  }
  expect(saved.requirements_budget).toMatchObject({
    run_limit: 50,
    soft_minutes: 10,
    hard_minutes: 30,
  })
  await expect(box).toContainText('run 5/50')
})

test('run 상한에 닿으면 [범위 줄이고 계속]과 [부분 분석으로 넘기기]가 보이고, 넘기면 summarize 하나로 끝난다. verify 승인 대기에서 결과를 저장소로 내보낸다 (결정 26, AI 결정 114, 119)', async () => {
  const win = await app.firstWindow()
  // 상한 1: survey 하나 뒤에 멈춘다. 새 Work의 가짜 run은 survey, 그리고 부분 분석의 summarize
  await win.locator('.sidebar').getByRole('button', { name: '설정', exact: true }).click()
  const budget = win.getByRole('group', { name: '요구사항 추출 예산' })
  await budget.getByLabel('Work당 run 상한', { exact: true }).fill('1')
  await win.getByRole('button', { name: '저장', exact: true }).click()
  await expect(budget).toBeHidden()
  const plan = path.join(root, 'plan.json')
  fs.writeFileSync(
    plan,
    JSON.stringify({ runs: [extractSurvey(), extractSummarize()].map((o) => ({ outputs: [o] })) }),
  )
  fs.rmSync(`${plan}.count`, { force: true })

  await win.getByRole('button', { name: '새 Work' }).click()
  await win.getByLabel('요청').fill('평균 계산을 요구사항으로 정리해 줘')
  await win
    .getByRole('radiogroup', { name: '업무 유형' })
    .getByRole('radio', { name: '요구사항 추출' })
    .click()
  await win.getByRole('button', { name: '시작' }).click()
  await expect(win.locator('.work-item')).toHaveCount(2, { timeout: 30_000 })
  const approve = win.getByRole('button', { name: '의도 승인' })
  await expect(approve).toBeEnabled({ timeout: 60_000 })
  await approve.click()

  const box = win.getByLabel('요구사항 추출', { exact: true })
  await expect(box).toContainText('멈춤: run 상한에 닿음', { timeout: 60_000 })
  await expect(box).toContainText('run 1/1')
  // [범위 줄이고 계속]: 열린 단위를 골라 메모와 함께 뺀다. 여기서는 열어 보고 닫는다
  await box.getByRole('button', { name: '범위 줄이고 계속' }).click()
  const narrow = box.getByRole('group', { name: '범위 줄이기' })
  await expect(narrow).toContainText('u-0002 trace(command): src/avg.js avg')
  await expect(narrow.getByRole('button', { name: '빼고 계속' })).toBeDisabled()
  await win.screenshot({ path: 'test-results/requirements-narrow.png' })
  await narrow.getByRole('button', { name: '취소' }).click()
  // [부분 분석으로 넘기기]: 확인하면 열린 단위를 보류로 닫고 summarize 하나를 상한 밖에서 돈다
  await box.getByRole('button', { name: '부분 분석으로 넘기기' }).first().click()
  const confirm = box.locator('.notice').filter({ hasText: '보류: 예산 상한' })
  await expect(confirm).toContainText('열린 단위 1개')
  await confirm.getByRole('button', { name: '부분 분석으로 넘기기' }).click()
  await expect(win.locator('.band')).toContainText('승인 대기', { timeout: 60_000 })
  await expect(box).toContainText('run 2/1')
  await expect(box).toContainText('부분 분석: 보류한 단위가 있다')
  await win.screenshot({ path: 'test-results/requirements-partial.png' })

  // extract를 승인하면 verify가 돌고, 승인 대기에서 결과를 저장소로 내보낸다
  await win.getByRole('button', { name: '승인', exact: true }).click()
  // 부분 분석은 보류한 단위를 열린 질문으로 남겨 승인 전에 한 번 묻는다
  const unanswered = win.getByRole('dialog', { name: '답하지 않은 열린 질문' })
  await expect(unanswered).toContainText('부분 분석이다')
  await unanswered.getByRole('button', { name: '승인', exact: true }).click()
  const exportBox = win.getByLabel('결과 내보내기', { exact: true })
  await expect(exportBox).toBeVisible({ timeout: 60_000 })
  await expect(exportBox).toContainText('부분 분석')
  await expect(exportBox.getByLabel('내보낼 폴더', { exact: true })).toHaveValue(
    /^docs\/requirements\/w-/,
  )
  await exportBox.getByRole('button', { name: '결과를 저장소에 커밋' }).click()
  await expect(exportBox).toContainText('내보냄: docs/requirements/w-', { timeout: 30_000 })
  await win.screenshot({ path: 'test-results/requirements-export.png' })
})
