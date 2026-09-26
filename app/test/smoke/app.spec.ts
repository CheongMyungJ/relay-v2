// [스모크] 설치한 앱이 뜨고, 가짜 claude로 intake task 하나를 [의도 승인]까지 누른다 (I27, M2).
// 프로젝트 등록 → 새 Work → intake 탭에 PTY 출력 → 창 크기 변경이 PTY에 전달 → [의도 승인]
// → intent.md 확정, intake 세션 트리 종료, 다음 task 시작.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { makeRepo } from '../flow/repo'
import { REPO_FILES, REQUEST, scenario } from '../flow/scenarios'

const isWin = process.platform === 'win32'
const APP_DIR = path.resolve(__dirname, '../..')
const FAKE = path.resolve(
  __dirname,
  '../fake-claude',
  isWin ? 'fake-claude.cmd' : 'fake-claude.mjs',
)

let app: ElectronApplication
let root: string
let home: string
let repo: string

test.beforeAll(async () => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-smoke-')))
  home = path.join(root, 'home')
  repo = makeRepo(root, 'sample', REPO_FILES).repo
  // intake는 초안과 handoff를 쓰고 멈추고, evidence는 시작만 한다
  const scenarioFile = path.join(root, 'scenario.json')
  fs.writeFileSync(
    scenarioFile,
    JSON.stringify(scenario('M', { evidence: [{ do: 'prompt' }, { do: 'wait' }] })),
  )
  const env = {
    ...process.env,
    CLAUDE_BIN: FAKE,
    RELAY_HOME: home,
    FAKE_CLAUDE_SCENARIO: scenarioFile,
  } as Record<string, string>
  const exe = process.env['RELAY_APP_EXE']
  app = exe
    ? await electron.launch({ executablePath: exe, env })
    : await electron.launch({ args: [APP_DIR], env })
  // Electron 기본 대화상자는 Playwright가 가로채지 못하므로 메인 프로세스에서 바꿔 끼운다.
  await app.evaluate(({ dialog }, dir) => {
    dialog.showOpenDialog = (() =>
      Promise.resolve({ canceled: false, filePaths: [dir] })) as typeof dialog.showOpenDialog
  }, repo)
})

test.afterAll(async () => {
  await app?.close()
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

test('가짜 claude로 intake task를 [의도 승인]까지 누른다', async () => {
  const win = await app.firstWindow()
  await expect(win.locator('.layout')).toBeVisible()
  await expect(win.locator('.sidebar')).toBeVisible()
  await expect(win.locator('.panel')).toBeVisible()

  // 프로젝트 등록 (시나리오 0)
  await win.locator('.sidebar').getByRole('button', { name: '프로젝트 추가' }).click()
  await win.getByRole('button', { name: '레포 폴더 고르기' }).click()
  const checks = win.locator('table.checks')
  await expect(checks).toContainText('git 레포의 루트인가', { timeout: 30_000 })
  await expect(win.getByLabel('기본 브랜치')).toHaveValue('main')
  await win.getByRole('button', { name: '등록' }).click()
  await expect(win.locator('.project-name')).toHaveText('sample', { timeout: 30_000 })

  // 새 Work (시나리오 1)
  await win.getByRole('button', { name: '새 Work' }).click()
  await win.getByLabel('요청').fill(REQUEST)
  await win.getByRole('button', { name: '시작' }).click()

  // intake 탭: PTY 출력과 머리 띠 (시나리오 2-5, D109)
  const rows = win.locator('.terminal-host:not([hidden]) .xterm-rows')
  await expect(rows).toContainText('FAKE-CLAUDE READY', { timeout: 60_000 })
  await expect(win.locator('.band')).toContainText('01 의도 정리 · 새 세션 · 이유: 기본 진행')
  const pid = Number(/PID (\d+)/.exec((await rows.textContent()) ?? '')?.[1])
  expect(pid).toBeGreaterThan(0)
  expect(alive(pid)).toBe(true)

  // 창 크기를 바꾸면 PTY 크기도 바뀐다
  const before = lastSize((await rows.textContent()) ?? '')
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1200, 800)
  })
  await expect
    .poll(async () => lastSize((await rows.textContent()) ?? ''), { timeout: 15_000 })
    .not.toBe(before)

  // 승인 화면 (D83)과 [의도 승인] (4.1)
  const approve = win.getByRole('button', { name: '의도 승인' })
  await expect(approve).toBeEnabled({ timeout: 60_000 })
  await expect(win.getByLabel('size')).toHaveValue('M')
  await win.screenshot({ path: 'test-results/approval.png' })
  await approve.click()

  // 다음 task가 시작되고, intake 세션은 트리째 끝난다 (시나리오 4-4, 5)
  await expect(win.getByRole('tab', { name: /02 재현과 관찰/ })).toBeVisible({ timeout: 60_000 })
  await expect.poll(() => alive(pid), { timeout: 15_000 }).toBe(false)
  // 스냅샷은 할 일(파일 쓰기)보다 먼저 온다
  await expect.poll(() => findFile(path.join(home, 'projects'), 'intent.md')).not.toBeNull()
  const intent = findFile(path.join(home, 'projects'), 'intent.md')
  expect(fs.readFileSync(intent ?? '', 'utf8')).toContain(
    'schema_version: 1\nversion: 1\ntype: bugfix\nsize: M\n',
  )
  await expect(rows).toContainText('FAKE-CLAUDE READY', { timeout: 60_000 })
  await win.screenshot({ path: 'test-results/next-task.png' })
})

function lastSize(text: string): string | undefined {
  return [...text.matchAll(/SIZE (\d+x\d+)/g)].pop()?.[1]
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function findFile(dir: string, name: string): string | null {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isFile() && e.name === name) return p
    if (e.isDirectory() && e.name !== 'worktrees') {
      const found = findFile(p, name)
      if (found) return found
    }
  }
  return null
}
