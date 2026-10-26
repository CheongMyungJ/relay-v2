// [스모크] 커스텀 유형 (M30, M39, D459, D460, D512, D513): 업무 유형 화면에서 기반 단계로 단계를 더해 전역 유형을 만들고
// (산출물 참조 경고), 기본 유형을 베이스로 고르면 칸이 모두 채워진다. 만든 유형은 새 Work 대화상자의 기본 다섯 뒤에 보이고,
// 고르면 설명과 단계 목록이 보인다. 시작해 의도를 승인하면 첫 커스텀 단계가 그 이름의 탭으로 돈다. 첫 단계는 유형에서
// 자동 승인을 켜 두어 승인 화면에 카운트다운과 [취소]가 보이고(4.3, D83, D457), [취소]하면 까닭이 보이며 사람이 [승인]하면
// 마지막 단계(적용, 시작만 하고 기다린다)로 간다. 마지막 단계는 Work를 마무리해 단계 줄에 리뷰와 검증이 없다 (D493).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { makeRepo } from '../support/repo'
import {
  GENERAL_REQUEST,
  REPO_FILES,
  customSteps,
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

/** 시작만 하는 마지막 커스텀 단계: 도구 하나를 쓰고 기다린다 */
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
  // 조사는 산출물과 handoff를 쓰고 멈춘다(자동 승인 카운트다운). 적용은 시작만 한다
  const s: Scenario = {
    tasks: {
      'work-start': intake,
      't-02': customSteps('survey', { commit: false }),
      't-03': WAITING,
    },
  }
  fs.writeFileSync(scenarioFile, JSON.stringify(s))
  // 카운트다운이 끝나기 전에 [취소]를 누를 수 있게 길게 둔다
  fs.mkdirSync(path.join(root, 'home'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'home', 'config.json'),
    JSON.stringify({ auto_approve_countdown_sec: 600 }),
  )
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
  await win.getByRole('button', { name: '새 유형', exact: true }).click()
  await win.getByLabel('유형 id').fill('survey-apply')
  await win.getByLabel('유형 이름').fill('조사 후 적용')
  await win.getByLabel('유형 설명').fill('먼저 조사하고 그대로 적용하는 일')
  await win.getByLabel('단계 1 id').fill('survey')
  await win.getByLabel('단계 1 이름').fill('조사')
  await win.getByLabel('단계 1 절차').fill('바꿀 곳을 모두 찾는다.')
  await win.getByLabel('단계 1 자동 승인').check()
  // 기반 단계를 고르면 그 단계의 절차와 산출물의 절이 채워진다 (D512)
  await win.getByLabel('기반 단계').selectOption('general:execute')
  await win.getByRole('button', { name: '단계 더하기' }).click()
  await expect(win.getByLabel('단계 2 절차')).toHaveValue(/^# relay: execute/)
  await expect(win.getByLabel('단계 2 절', { exact: true })).toHaveValue(/^계획\n변경 요약/)
  await expect(win.getByLabel('단계 2 공통 바탕')).not.toBeChecked()
  await win.getByLabel('단계 2 id').fill('apply')
  await win.getByLabel('단계 2 이름').fill('적용')
  await win.screenshot({ path: 'test-results/custom-editor.png' })
  await win.getByRole('button', { name: '저장' }).click()
  const row = win.getByRole('listitem', { name: '유형 survey-apply' })
  await expect(row).toContainText('단계: 의도 정리 → 조사 → 적용')
  await expect(row).not.toContainText('리뷰와 검증')
  // 단계 id를 바꿔 절차가 가리키는 산출물(execute.md)이 없으면 저장하고 경고한다 (D513)
  await expect(win.getByLabel('산출물 참조 경고')).toContainText('`execute.md`')
  expect(fs.readdirSync(path.join(root, 'home', 'types', 'survey-apply')).sort()).toEqual([
    'apply.md',
    'survey.md',
    'type.json',
  ])
  // 베이스로 기본 유형을 고르면 단계와 유형 단위 칸이 모두 채워진다 (D512)
  await expect(win.getByRole('listitem', { name: '유형 bugfix' })).toContainText('버그 수정')
  await win.getByLabel('새 유형의 베이스').selectOption({ label: '버그 수정 (기본 유형)' })
  await win.getByRole('button', { name: '새 유형', exact: true }).click()
  await expect(win.getByLabel('유형 id')).toHaveValue('')
  await expect(win.getByLabel('단계 1 id')).toHaveValue('fix')
  await expect(win.getByLabel('intake 지시')).toHaveValue(/재현 절차가 더 이상 실패하지 않는다/)
  await expect(win.getByLabel('리뷰 관점')).toHaveValue(/`fix\.md`/)
  await expect(win.getByLabel('마무리 판정 규칙')).toHaveValue(/Reproduction steps/)
  await expect(win.getByLabel('PR 템플릿')).toHaveValue(/## 원인/)
  await expect(win.getByLabel('완료조건 확인 방법')).not.toBeChecked()
  await win.screenshot({ path: 'test-results/custom-base.png' })
  await win.getByRole('button', { name: '취소' }).click()
  await win.getByRole('button', { name: '닫기' }).click()

  // 새 Work: 기본 다섯 뒤에 커스텀 유형이 보이고, 고르면 설명과 단계가 보인다 (D460)
  await win.getByRole('button', { name: '새 Work' }).click()
  await win.getByLabel('요청').fill(GENERAL_REQUEST)
  const types = win.getByRole('radiogroup', { name: '업무 유형' })
  await expect(types.getByRole('radio')).toHaveCount(6)
  await types.getByRole('radio', { name: '조사 후 적용' }).click()
  await expect(win.locator('.work-type-hint')).toContainText('먼저 조사하고 그대로 적용하는 일')
  await expect(win.locator('.work-type-hint')).toContainText('단계: 의도 정리 → 조사 → 적용')
  await expect(win.locator('.work-type-hint')).not.toContainText('리뷰와 검증')
  await win.screenshot({ path: 'test-results/custom-new-work.png' })
  await win.getByRole('button', { name: '시작' }).click()

  const approve = win.getByRole('button', { name: '의도 승인' })
  await expect(approve).toBeEnabled({ timeout: 60_000 })
  await approve.click()
  await expect(win.getByRole('tab', { name: /02 조사/ })).toBeVisible({ timeout: 60_000 })
  await expect(win.locator('.band')).toContainText('02 조사', { timeout: 60_000 })
  await win.screenshot({ path: 'test-results/custom-running.png' })

  // 자동 승인을 켠 가운데 단계는 승인 화면에 카운트다운과 [취소]가 보인다 (4.3, D83, D457)
  const countdown = win.getByRole('status', { name: '자동 승인 카운트다운' })
  await expect(countdown).toContainText('자동 승인까지', { timeout: 60_000 })
  await win.screenshot({ path: 'test-results/countdown.png' })
  await countdown.getByRole('button', { name: '취소', exact: true }).click()
  await expect(countdown).toBeHidden({ timeout: 30_000 })
  await expect(win.locator('.notice.auto-hold')).toContainText(
    '자동 승인하지 않음: [취소]를 누름',
    { timeout: 30_000 },
  )
  await win.screenshot({ path: 'test-results/countdown-cancelled.png' })
  const approveSurvey = win.getByRole('button', { name: '승인', exact: true })
  await expect(approveSurvey).toBeEnabled()
  await approveSurvey.click()
  await expect(win.locator('.band')).toContainText('03 적용', { timeout: 60_000 })
})
