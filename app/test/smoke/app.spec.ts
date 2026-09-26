// [스모크] 설치한 앱이 뜨고, 탭에서 PTY로 띄운 가짜 claude의 출력이 보이고,
// 탭을 닫으면 프로세스 트리가 끝난다 (docs/implementation.md M0).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'

const isWin = process.platform === 'win32'
const APP_DIR = path.resolve(__dirname, '../..')
const FAKE = path.resolve(
  __dirname,
  '../fake-claude',
  isWin ? 'fake-claude.cmd' : 'fake-claude.mjs',
)

let app: ElectronApplication
let workDir: string

test.beforeAll(async () => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-smoke-'))
  const exe = process.env['RELAY_APP_EXE']
  const env = { ...process.env, CLAUDE_BIN: FAKE } as Record<string, string>
  app = exe
    ? await electron.launch({ executablePath: exe, env })
    : await electron.launch({ args: [APP_DIR], env })
  // Electron 기본 대화상자는 Playwright가 가로채지 못하므로 메인 프로세스에서 바꿔 끼운다.
  await app.evaluate(({ dialog }, dir) => {
    dialog.showOpenDialog = (() =>
      Promise.resolve({ canceled: false, filePaths: [dir] })) as typeof dialog.showOpenDialog
  }, workDir)
})

test.afterAll(async () => {
  await app?.close()
  fs.rmSync(workDir, { recursive: true, force: true })
})

test('가짜 claude 출력이 탭에 보이고, 탭을 닫으면 프로세스가 끝난다', async () => {
  const win = await app.firstWindow()
  await expect(win.locator('.layout')).toBeVisible()
  await expect(win.locator('.sidebar')).toBeVisible()
  await expect(win.locator('.panel')).toBeVisible()

  await win.getByRole('button', { name: '폴더를 골라 claude 실행' }).click()
  const rows = win.locator('.terminal-host:not([hidden]) .xterm-rows')
  await expect(rows).toContainText('FAKE-CLAUDE READY', { timeout: 30_000 })
  await expect(rows).toContainText('한글 출력 확인')
  await expect(win.locator('.band')).toContainText('실행 중')
  await win.screenshot({ path: 'test-results/tab.png' })

  const pid = Number(/PID (\d+)/.exec((await rows.textContent()) ?? '')?.[1])
  expect(pid).toBeGreaterThan(0)
  expect(alive(pid)).toBe(true)

  // 창 크기를 바꾸면 PTY 크기도 바뀐다
  const before = lastSize((await rows.textContent()) ?? '')
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    w?.setSize(1000, 700)
  })
  await expect
    .poll(async () => lastSize((await rows.textContent()) ?? ''), { timeout: 15_000 })
    .not.toBe(before)

  await win.getByRole('button', { name: '탭 닫기' }).click()
  await expect(win.getByRole('tab')).toHaveCount(0)
  await expect.poll(() => alive(pid), { timeout: 15_000 }).toBe(false)
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
