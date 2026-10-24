// [스모크] 오른쪽 패널 너비 (D469): 왼쪽 가장자리 손잡이를 끌면 넓어지고 다시 켜도 남으며, 두 번 누르면 기본 너비다.
// 범위와 저장의 판정은 [단위] panel-width가 본다. 여기서는 손잡이가 패널과 이어지는 것만 본다.
// 너비는 브라우저 저장소(userData)에 남아 앞선 실행의 값이 있을 수 있으므로 먼저 기본 너비로 돌린다.
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
/** styles.css의 `.layout` 기본 패널 너비 */
const DEFAULT_WIDTH = 360

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
  await expect(win.locator('.layout')).toBeVisible()
  // 가운데가 줄지 않고 패널이 넓어질 자리가 있게 한다
  await win.setViewportSize({ width: 1400, height: 800 })
  return win
}

async function panelWidth(win: Page): Promise<number> {
  const box = await win.locator('aside.panel').boundingBox()
  return Math.round(box?.width ?? 0)
}

test.beforeAll(() => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-panel-')))
  env = { ...process.env, RELAY_HOME: path.join(root, 'home'), RELAY_UPDATE: 'off' } as Record<
    string,
    string
  >
})

test.afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

test('패널 손잡이를 끌면 넓어지고 다시 켜도 남으며 두 번 누르면 기본 너비다 (D469)', async () => {
  const app = await launch()
  const win = await open(app)
  const handle = win.getByRole('separator', { name: '오른쪽 패널 너비' })
  await handle.dblclick()
  await expect.poll(() => panelWidth(win)).toBe(DEFAULT_WIDTH)

  // 왼쪽으로 150px 끌면 그만큼 넓어진다
  const box = await handle.boundingBox()
  if (!box) throw new Error('손잡이가 보이지 않는다')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await win.mouse.move(x, y)
  await win.mouse.down()
  await win.mouse.move(x - 75, y)
  await win.mouse.move(x - 150, y)
  await win.mouse.up()
  await expect.poll(() => panelWidth(win)).toBe(DEFAULT_WIDTH + 150)

  // 화살표 키로도 바뀐다: 왼쪽은 넓게, 오른쪽은 좁게
  await handle.focus()
  await win.keyboard.press('ArrowRight')
  await expect.poll(() => panelWidth(win)).toBe(DEFAULT_WIDTH + 150 - 24)
  await win.keyboard.press('ArrowLeft')
  await expect.poll(() => panelWidth(win)).toBe(DEFAULT_WIDTH + 150)
  await app.close()

  const again = await launch()
  const win2 = await open(again)
  await expect.poll(() => panelWidth(win2)).toBe(DEFAULT_WIDTH + 150)
  await win2.getByRole('separator', { name: '오른쪽 패널 너비' }).dblclick()
  await expect.poll(() => panelWidth(win2)).toBe(DEFAULT_WIDTH)
  await again.close()
})
