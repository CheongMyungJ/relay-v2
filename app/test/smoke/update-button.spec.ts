// [스모크] 사이드바의 버전 표시와 업데이트 버튼 (I121): relay 글자 오른쪽에 실행 중인 앱의 버전이, [설정] 오른쪽에
// 업데이트 아이콘 버튼이 보인다. 스모크는 RELAY_UPDATE=off로 띄우므로 버튼은 꺼진 상태(off)다. 확인·받기·설치의
// 상태 변화는 [단위] updates.test.ts와 update-button.test.ts가 보고, 여기서는 상태 글이 사이드바 폭에 들어가는지만 본다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'

const APP_DIR = path.resolve(__dirname, '../..')

let root: string
let env: Record<string, string>

function launch(): Promise<ElectronApplication> {
  const exe = process.env['RELAY_APP_EXE']
  return exe
    ? electron.launch({ executablePath: exe, env })
    : electron.launch({ args: [APP_DIR], env })
}

test.beforeAll(() => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-update-')))
  env = { ...process.env, RELAY_HOME: path.join(root, 'home'), RELAY_UPDATE: 'off' } as Record<
    string,
    string
  >
})

test.afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

test('relay 옆에 버전이, 설정 옆에 업데이트 버튼이 보인다 (I121)', async () => {
  const app = await launch()
  try {
    const win = await app.firstWindow()
    const version = await app.evaluate(({ app: a }) => a.getVersion())
    const brand = win.locator('.sidebar .brand')
    await expect(brand.locator('.brand-version')).toHaveText(`v${version}`)
    const name = await brand.locator('.brand-name').boundingBox()
    const shown = await brand.locator('.brand-version').boundingBox()
    expect(shown && name && shown.x > name.x + name.width - 1).toBe(true)

    const foot = win.locator('.sidebar-foot')
    const settings = foot.getByRole('button', { name: '설정', exact: true })
    const update = foot.getByRole('button', { name: /^업데이트:/ })
    await expect(update).toBeVisible()
    const s = await settings.boundingBox()
    const u = await update.boundingBox()
    expect(s && u && u.x >= s.x + s.width - 1).toBe(true)
    // RELAY_UPDATE=off: 앱에서 업데이트하지 않는 설치본이라 누를 수 없고 까닭을 보인다
    await expect(update).toBeDisabled()
    await expect(update).toHaveAttribute('title', /업데이트하지 않습니다/)
  } finally {
    await app.close()
  }
})

test('상태 글은 버튼 줄 아래 한 줄에 잘리지 않고 보이고 버튼 줄은 그대로다 (I121)', async () => {
  const app = await launch()
  try {
    const win = await app.firstWindow()
    const foot = win.locator('.sidebar-foot')
    const add = foot.getByRole('button', { name: '프로젝트 추가', exact: true })
    const settings = foot.getByRole('button', { name: '설정', exact: true })
    const update = foot.getByRole('button', { name: /^업데이트:/ })
    const status = foot.locator('.update-status')
    await expect(update).toBeVisible()
    // 화면만 보므로 main의 상태 대신 상태 알림(IPC.update)을 바로 보낸다. 글이 긴 상태들이다
    const states = [
      { kind: 'checking' },
      { kind: 'downloading', version: '10.10.10', percent: 100 },
      { kind: 'ready', version: '10.10.10' },
      { kind: 'manual', version: '10.10.10' },
      { kind: 'error', message: 'net::ERR_INTERNET_DISCONNECTED' },
    ]
    for (const state of states) {
      await app.evaluate(({ BrowserWindow }, s) => {
        BrowserWindow.getAllWindows()[0]?.webContents.send('update:changed', s)
      }, state)
      await expect(status).toBeVisible()
      expect(await status.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
      const a = await add.boundingBox()
      const s = await settings.boundingBox()
      const u = await update.boundingBox()
      const line = await status.boundingBox()
      // 프로젝트 추가가 두 줄로 꺾이지 않고, 업데이트 버튼은 설정 오른쪽 같은 줄, 상태 글은 그 아래다
      expect(a && s && a.height === s.height).toBe(true)
      expect(s && u && u.y === s.y && u.x >= s.x + s.width - 1).toBe(true)
      expect(s && line && line.y >= s.y + s.height - 1).toBe(true)
    }
  } finally {
    await app.close()
  }
})
