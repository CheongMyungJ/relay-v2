// [스모크] 터미널의 파일 (D410, D411): 출력에 보인 경로는 Ctrl+클릭으로 연다(그냥 누르면 열지 않음). 클립보드의 그림을
// 붙여넣으면 RELAY_HOME/pastes/에 저장한다. 경로 풀기와 저장은 [흐름], 경로 찾기는 [단위]가 자세히 본다.
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
import { scenario, type Scenario } from '../support/scenarios'

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
let cwd: string

test.beforeAll(async () => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-smoke-files-')))
  home = path.join(root, 'home')
  cwd = path.join(root, 'notes')
  fs.mkdirSync(cwd)
  fs.writeFileSync(path.join(cwd, 'notes.md'), '# 메모\n')
  const scenarioFile = path.join(root, 'scenario.json')
  const s: Scenario = {
    ...scenario(),
    session: [
      { do: 'print', text: 'Wrote 1 lines to notes.md' },
      { do: 'print', text: 'PR: https://github.com/o/r/pull/7' },
      { do: 'wait' },
    ],
  }
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
  // 실제로 열지 않고 연 경로를 모은다. 끝낼 때 살아 있는 세션의 확인은 [끝내기]다
  await app.evaluate(({ dialog, shell }) => {
    dialog.showMessageBox = (() =>
      Promise.resolve({ response: 0, checkboxChecked: false })) as typeof dialog.showMessageBox
    const opened: string[] = []
    ;(globalThis as unknown as { opened: string[] }).opened = opened
    shell.openPath = (p: string) => {
      opened.push(p)
      return Promise.resolve('')
    }
    shell.openExternal = (url: string) => {
      opened.push(url)
      return Promise.resolve()
    }
  })
})

test.afterAll(async () => {
  await app?.close()
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

const opened = () =>
  app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened.slice())

test('출력의 경로를 Ctrl+클릭하면 열고, 붙여넣은 그림은 저장한다 (D410, D411)', async () => {
  const win = await app.firstWindow()
  await expect(win.locator('.layout')).toBeVisible()
  await win.locator('.sidebar').getByRole('button', { name: '새 세션' }).click()
  const create = win.getByRole('dialog', { name: '새 세션' })
  await create.getByLabel('세션 폴더').fill(cwd)
  await create.getByRole('button', { name: '만들기' }).click()
  await expect(create).toBeHidden()

  const { x, y } = await wordAt(win, 'Wrote 1 lines to notes.md', 'notes.md')

  await win.mouse.move(x, y)
  // 링크로 알아보면 여는 방법을 알린다
  await expect(win.locator('.terminal-host:not([hidden]) .xterm')).toHaveAttribute(
    'title',
    'Ctrl+클릭으로 열기',
  )
  // 그냥 누르면 열지 않는다
  await win.mouse.click(x, y)
  await win.waitForTimeout(300)
  expect(await opened()).toEqual([])
  await win.keyboard.down('Control')
  await win.mouse.click(x, y)
  await win.keyboard.up('Control')
  await expect.poll(opened).toEqual([path.join(cwd, 'notes.md')])

  // 주소는 브라우저로 연다
  const url = await wordAt(win, 'PR: https://github.com/o/r/pull/7', 'github.com')
  await win.mouse.move(url.x, url.y)
  await win.keyboard.down('Control')
  await win.mouse.click(url.x, url.y)
  await win.keyboard.up('Control')
  await expect.poll(opened).toEqual([path.join(cwd, 'notes.md'), 'https://github.com/o/r/pull/7'])

  // 디스크에 없는 그림(화면 캡처)을 붙여넣으면 저장한다
  await win.locator('.terminal-host:not([hidden]) textarea').evaluate((textarea) => {
    const view = textarea.ownerDocument.defaultView
    if (!view) throw new Error('창이 없음')
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const data = new view.DataTransfer()
    data.items.add(new view.File([png], 'image.png', { type: 'image/png' }))
    textarea.dispatchEvent(new view.ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
  })
  await expect
    .poll(() =>
      fs.existsSync(path.join(home, 'pastes')) ? fs.readdirSync(path.join(home, 'pastes')) : [],
    )
    .toEqual([expect.stringMatching(/^paste-\d{8}-\d{6}-[0-9a-f]{8}\.png$/)])
})

/** 터미널 줄에 보인 낱말의 가운데 자리 */
async function wordAt(win: Page, line: string, word: string): Promise<{ x: number; y: number }> {
  const row = win.locator('.xterm-rows > div', { hasText: line })
  await expect(row).toBeVisible({ timeout: 30_000 })
  return row.evaluate((el, word) => {
    const doc = el.ownerDocument
    const walker = doc.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = n.textContent?.indexOf(word) ?? -1
      if (i < 0) continue
      const range = doc.createRange()
      range.setStart(n, i)
      range.setEnd(n, i + word.length)
      const r = range.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    }
    throw new Error(`터미널 줄에 ${word}가 없음`)
  }, word)
}
