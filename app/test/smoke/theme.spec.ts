// [스모크] 화면 테마 (D335): 설정 화면에서 다크와 라이트를 고르면 바로 바뀌고, 다시 켜도 고른 테마다.
// main이 nativeTheme.themeSource를 정하고 CSS는 prefers-color-scheme만 본다. Playwright는 페이지에서 라이트를
// 흉내 내므로 흉내를 꺼야 앱이 정한 테마가 보인다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test'

const APP_DIR = path.resolve(__dirname, '../..')
/** 사이드바 바탕 (styles.css의 --bg-side) */
const SIDEBAR = { 다크: 'rgb(22, 24, 29)', 라이트: 'rgb(246, 247, 249)' } as const

let root: string
let env: Record<string, string>

function launch(): Promise<ElectronApplication> {
  const exe = process.env['RELAY_APP_EXE']
  return exe
    ? electron.launch({ executablePath: exe, env })
    : electron.launch({ args: [APP_DIR], env })
}

async function open(app: ElectronApplication): Promise<Page> {
  const win = await app.firstWindow()
  await win.emulateMedia({ colorScheme: null })
  await expect(win.locator('.layout')).toBeVisible()
  return win
}

test.beforeAll(() => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-theme-')))
  env = { ...process.env, RELAY_HOME: path.join(root, 'home'), RELAY_UPDATE: 'off' } as Record<
    string,
    string
  >
})

test.afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

test('설정 화면에서 테마를 고르면 바로 바뀌고 다시 켜도 남는다 (D335)', async () => {
  const app = await launch()
  const win = await open(app)
  for (const label of ['다크', '라이트'] as const) {
    await win.locator('.sidebar').getByRole('button', { name: '설정', exact: true }).click()
    await win.getByLabel('테마').selectOption({ label })
    await win.getByRole('button', { name: '저장', exact: true }).click()
    await expect(win.locator('.sidebar')).toHaveCSS('background-color', SIDEBAR[label])
  }
  // 터미널은 테마와 관계없이 어둡다
  await expect(win.locator('.terminal')).toHaveCSS('background-color', 'rgb(17, 19, 23)')
  await app.close()

  const config = JSON.parse(fs.readFileSync(path.join(root, 'home', 'config.json'), 'utf8')) as {
    theme: string
  }
  expect(config.theme).toBe('light')
  const again = await launch()
  const win2 = await open(again)
  await expect(win2.locator('.sidebar')).toHaveCSS('background-color', SIDEBAR['라이트'])
  await again.close()
})
