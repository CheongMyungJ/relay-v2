// [스모크] 기본 세션 (M23, 시나리오 12): 사이드바 맨 위의 [새 세션]으로 만들면 그 세션이 사이드바에 생기고 골라져 탭과
// 머리 띠가 보인다(D405). 세션의 work-drafts/에 초안을 쓰면 오른쪽 패널에 카드가 생기고, [새 Work로 만들기]가 칸이 채워진
// 새 Work 대화상자를 연다(D404). 만들면 초안 카드가 없어진다. 우클릭 [이름 바꾸기]로 이름을 바꾼다(D403).
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
let home: string
let repo: string

test.beforeAll(async () => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-smoke-session-')))
  home = path.join(root, 'home')
  ;({ repo } = makeRepo(root, 'sample', REPO_FILES))
  const scenarioFile = path.join(root, 'scenario.json')
  const s: Scenario = { ...scenario(), session: [{ do: 'wait' }] }
  fs.writeFileSync(scenarioFile, JSON.stringify(s))
  const env = {
    ...process.env,
    CLAUDE_BIN: FAKE,
    RELAY_HOME: home,
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

test('[새 세션]으로 만들면 사이드바와 탭이 생기고, 초안 카드의 [새 Work로 만들기]가 채워진 대화상자를 연다 (시나리오 12, D404, D405)', async () => {
  const win = await app.firstWindow()
  await expect(win.locator('.layout')).toBeVisible()
  // 프로젝트가 없어도 기본 세션 묶음이 보인다
  const sidebar = win.locator('.sidebar')
  await expect(sidebar.locator('.group-name')).toHaveText('기본 세션')
  await sidebar.getByRole('button', { name: '프로젝트 추가' }).click()
  await win.getByRole('button', { name: '레포 폴더 고르기' }).click()
  await expect(win.locator('table.checks')).toContainText('git 레포의 루트인가', {
    timeout: 30_000,
  })
  await win.getByRole('button', { name: '등록' }).click()
  await expect(win.locator('.project-name')).toHaveText('sample', { timeout: 30_000 })

  // [새 세션] 창의 폴더는 기본값(<RELAY_HOME>/home/)이다 (D398)
  await sidebar.getByRole('button', { name: '새 세션' }).click()
  const create = win.getByRole('dialog', { name: '새 세션' })
  await expect(create.getByLabel('세션 폴더')).toHaveValue(path.join(home, 'home'))
  await create.getByRole('button', { name: '만들기' }).click()
  await expect(create).toBeHidden()
  const item = sidebar.locator('.session-item')
  await expect(item).toHaveCount(1)
  await expect(item).toHaveClass(/selected/)
  await expect(item).toContainText('새 세션')
  await expect(win.getByRole('tab', { name: '새 세션' })).toHaveAttribute('aria-selected', 'true', {
    timeout: 30_000,
  })
  await expect(win.locator('.band')).toContainText(
    `기본 세션 · Claude Code · ${path.join(home, 'home')} · 기록하지 않음 · 바꾸기 전에 묻습니다`,
  )
  await expect(win.locator('.action-bar').getByRole('button', { name: '닫기' })).toBeVisible()
  await expect(win.locator('.panel')).toContainText('Work 초안')

  // 에이전트가 초안을 쓰면 카드가 생긴다 (D404)
  const [id] = fs.readdirSync(path.join(home, 'sessions'))
  const [projectId] = fs.readdirSync(path.join(home, 'projects'))
  fs.writeFileSync(
    path.join(home, 'sessions', id ?? '', 'work-drafts', 'avg.md'),
    `---\nproject: ${projectId}\ntype: bugfix\nbase: main\n---\n${REQUEST}`,
  )
  const card = win.getByLabel('Work 초안')
  await expect(card).toContainText(REQUEST.split('\n')[0] ?? '', { timeout: 30_000 })
  await expect(card).toContainText('sample · 버그 수정 · 기준 main')
  await expect(item).toContainText('Work 초안 1')
  await win.screenshot({ path: 'test-results/session-draft.png' })

  // [새 Work로 만들기]는 그 프로젝트의 새 Work 대화상자를 채워 연다
  await card.getByRole('button', { name: '새 Work로 만들기' }).click()
  const dialog = win.getByRole('dialog', { name: '새 Work · sample' })
  await expect(dialog).toContainText('Work 초안 avg.md으로 채웠습니다')
  await expect(dialog.getByLabel('요청')).toHaveValue(REQUEST.trim())
  await expect(
    dialog.getByRole('radiogroup', { name: '업무 유형' }).getByRole('radio', { name: '버그 수정' }),
  ).toBeChecked()
  await expect(dialog.getByLabel('기준 브랜치')).toHaveValue('main')
  // 열리는 효과가 끝난 뒤 찍는다 (확인용 화면)
  await win.waitForTimeout(400)
  await win.screenshot({ path: 'test-results/session-new-work.png' })
  await dialog.getByRole('button', { name: '시작' }).click()
  // 만들면 그 Work로 옮기고 초안은 지워진다
  await expect(win.getByRole('tab', { name: /01 의도 정리/ })).toBeVisible({ timeout: 30_000 })
  await expect(item).not.toContainText('Work 초안')

  // 세션을 다시 고르면 그 세션의 화면이고 카드는 없다. 우클릭 [이름 바꾸기]
  await item.click()
  await expect(win.locator('.band')).toContainText('기본 세션 · Claude Code')
  await expect(win.getByLabel('Work 초안')).toHaveCount(0)
  await item.click({ button: 'right' })
  await win.getByRole('menuitem', { name: '이름 바꾸기' }).click()
  const rename = win.getByRole('dialog', { name: '이름 바꾸기' })
  await rename.getByLabel('세션 이름').fill('새 Work 구상')
  await rename.getByRole('button', { name: '저장' }).click()
  await expect(item).toContainText('새 Work 구상')
  // 열린 세션은 지우지 않는다. 닫으면 [열기]와 [새 대화로 열기]다
  await item.click({ button: 'right' })
  await expect(win.getByRole('menuitem', { name: '지우기' })).toBeDisabled()
  await win.keyboard.press('Escape')
  await win.locator('.action-bar').getByRole('button', { name: '닫기' }).click()
  await expect(win.locator('.band')).toContainText('끝남 · 읽기 전용', { timeout: 30_000 })
  await expect(
    win.locator('.action-bar').getByRole('button', { name: '열기', exact: true }),
  ).toBeVisible()
  await expect(
    win.locator('.action-bar').getByRole('button', { name: '새 대화로 열기' }),
  ).toBeVisible()
})
