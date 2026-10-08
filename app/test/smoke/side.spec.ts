// [스모크] 곁 세션 (M21, 시나리오 11): 의도 정리가 승인을 기다리는 동안 액션 바의 [곁 세션 열기]를 누르면 안내 창이
// 뜨고(D392), [열기]를 누르면 곁 세션 탭이 생겨 그 탭으로 옮긴다. [곁 세션 닫기]를 누르면 끝난 터미널로 남고 [새 대화로
// 열기]가 보인다. 안내 창에서 "다시 보지 않기"를 고르면 다음부터 바로 열고, 설정 화면에서 다시 켤 수 있다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { makeRepo } from '../support/repo'
import { REPO_FILES, REQUEST, scenario, type Scenario } from '../support/scenarios'

const isWin = process.platform === 'win32'
const APP_DIR = path.resolve(__dirname, '../..')
const FAKE = path.resolve(
  __dirname,
  '../support/fake-claude',
  isWin ? 'fake-claude.cmd' : 'fake-claude.mjs',
)

let app: ElectronApplication
let root: string
let repo: string

test.beforeAll(async () => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-smoke-side-')))
  ;({ repo } = makeRepo(root, 'sample', REPO_FILES))
  const scenarioFile = path.join(root, 'scenario.json')
  const s: Scenario = { ...scenario(), side: [{ do: 'wait' }] }
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

test('[곁 세션 열기]는 안내 창을 거쳐 곁 세션 탭을 열고, 닫으면 끝난 터미널과 [새 대화로 열기]가 남는다. 다시 보지 않기를 고르면 다음부터 바로 연다 (시나리오 11, D392)', async () => {
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
  await win.getByLabel('요청').fill(REQUEST)
  const types = win.getByRole('radiogroup', { name: '업무 유형' })
  await types.getByRole('radio', { name: '버그 수정' }).click()
  await win.getByRole('button', { name: '시작' }).click()
  await expect(win.getByRole('button', { name: '의도 승인' })).toBeEnabled({ timeout: 60_000 })

  // 의도 정리가 승인을 기다리는 동안 연다 (D390). 먼저 안내 창이 뜬다 (D392)
  await win.getByRole('button', { name: '곁 세션 열기' }).click()
  const notice = win.getByRole('dialog', { name: '곁 세션' })
  await expect(notice).toContainText('묻고 안내받는 곳')
  await expect(notice).toContainText('단계 흐름을 대신하지는 마세요')
  // 열리는 효과가 끝난 뒤 찍는다 (확인용 화면)
  await win.waitForTimeout(400)
  await win.screenshot({ path: 'test-results/side-notice.png' })
  // 취소하면 열지 않는다
  await notice.getByRole('button', { name: '취소' }).click()
  await expect(notice).toBeHidden()
  await expect(win.getByRole('tab', { name: '곁 세션' })).toHaveCount(0)
  await win.getByRole('button', { name: '곁 세션 열기' }).click()
  await notice.getByRole('button', { name: '열기', exact: true }).click()
  await expect(notice).toBeHidden()
  const tab = win.getByRole('tab', { name: '곁 세션' })
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 })
  await expect(win.locator('.band')).toContainText(
    '곁 세션 · Claude Code · 기록하지 않음 · 바꾸기 전에 묻습니다',
  )
  await expect(win.getByRole('button', { name: '곁 세션 닫기' })).toBeVisible()
  // 패널은 지금 task(의도 정리의 승인 화면)다
  await expect(win.getByRole('button', { name: '의도 승인' })).toBeEnabled()
  await win.screenshot({ path: 'test-results/side-open.png' })

  await win.getByRole('button', { name: '곁 세션 닫기' }).click()
  await expect(win.locator('.band')).toContainText('끝남 · 읽기 전용', { timeout: 30_000 })
  await expect(win.locator('.band').getByRole('button', { name: '새 대화로 열기' })).toBeVisible()
  await expect(win.getByRole('button', { name: '곁 세션 열기' })).toBeVisible()
  // [새 대화로 열기]도 안내 창을 거친다. 다시 보지 않기를 고르고 연다
  await win.locator('.band').getByRole('button', { name: '새 대화로 열기' }).click()
  await notice.getByLabel('다시 보지 않기 (설정에서 다시 켤 수 있음)').check()
  await notice.getByRole('button', { name: '새 대화로 열기' }).click()
  await expect(win.getByRole('button', { name: '곁 세션 닫기' })).toBeVisible({ timeout: 30_000 })
  await win.getByRole('button', { name: '곁 세션 닫기' }).click()
  await expect(win.getByRole('button', { name: '곁 세션 열기' })).toBeVisible({ timeout: 30_000 })
  // 다음부터는 안내 창 없이 바로 연다
  await win.getByRole('button', { name: '곁 세션 열기' }).click()
  await expect(win.getByRole('button', { name: '곁 세션 닫기' })).toBeVisible({ timeout: 30_000 })
  await expect(notice).toHaveCount(0)
  // 설정 화면에서 다시 켤 수 있다 (꺼진 채 보인다)
  await win.getByRole('button', { name: '설정', exact: true }).click()
  await expect(win.getByLabel('곁 세션을 열 때 안내 보기')).not.toBeChecked()
  await win.getByRole('button', { name: '취소' }).click()
  // task 탭을 고르면 그 task의 머리 띠다
  await win.getByRole('tab', { name: /01 의도 정리/ }).click()
  await expect(win.locator('.band')).toContainText('01 의도 정리')
})
