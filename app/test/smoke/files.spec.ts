// [스모크] Work의 [파일] 탭 (D464~D468, D490~D492): 탭 줄 끝의 [파일]을 누르면 worktree의 트리가 보이고, 패널은 지금
// task 그대로다. 마크다운은 그려 보이고 [편집]으로 고쳐 Ctrl+S로 저장한다. 연 파일은 탭으로 여럿 두고, 고친 탭을 닫을 때
// 묻고, 연 뒤 바뀐 파일은 덮어쓰기 전에 알린다. 다른 탭에 다녀와도 고치던 글이 남는다. 트리는 Work가 바꾼 파일을 표시하고
// 지운 파일도 보인다. 터미널에서 Ctrl+클릭한 worktree의 글 파일은 [파일] 탭에서 연다. 읽기·쓰기의 세부는 [어댑터], 명령의
// 연결은 [흐름], 표시와 탭의 규칙은 [단위]가 본다.
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
import { makeRepo } from '../support/repo'
import { REPO_FILES, REQUEST, scenario, steps } from '../support/scenarios'

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
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-smoke-tree-')))
  home = path.join(root, 'home')
  ;({ repo } = makeRepo(root, 'sample', {
    ...REPO_FILES,
    'README.md': '# 샘플 안내\n\n- 첫 항목\n- 둘째 항목\n',
  }))
  const scenarioFile = path.join(root, 'scenario.json')
  // 의도 정리 세션이 터미널에 worktree의 파일 경로를 보인다 (D491)
  const [prompt, ...rest] = steps('intake')
  const s = scenario({
    'work-start': [
      ...(prompt ? [prompt] : []),
      { do: 'print', text: 'Read test/avg.test.js' },
      ...rest,
    ],
  })
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
  // 실제로 열지 않고 OS 앱으로 연 경로를 모은다
  await app.evaluate(({ dialog, shell }, dir) => {
    dialog.showOpenDialog = (() =>
      Promise.resolve({ canceled: false, filePaths: [dir] })) as typeof dialog.showOpenDialog
    dialog.showMessageBox = (() =>
      Promise.resolve({ response: 0, checkboxChecked: false })) as typeof dialog.showMessageBox
    const opened: string[] = []
    ;(globalThis as unknown as { opened: string[] }).opened = opened
    shell.openPath = (p: string) => {
      opened.push(p)
      return Promise.resolve('')
    }
  }, repo)
})

test.afterAll(async () => {
  await app?.close()
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

/** 하나뿐인 Work의 worktree */
function worktree(): string {
  const projects = path.join(home, 'projects')
  const [project] = fs.readdirSync(projects)
  const trees = path.join(projects, project ?? '', 'worktrees')
  const [work] = fs.readdirSync(trees)
  return path.join(trees, work ?? '')
}

test('[파일] 탭에서 worktree의 파일을 보고, 마크다운을 그려 보이고, 고쳐 저장한다. 바뀐 파일 표시, 탭, 터미널에서 열기 (D464~D468, D490~D492)', async () => {
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
  await win
    .getByRole('radiogroup', { name: '업무 유형' })
    .getByRole('radio', { name: '버그 수정' })
    .click()
  await win.getByRole('button', { name: '시작' }).click()
  await expect(win.getByRole('button', { name: '의도 승인' })).toBeEnabled({ timeout: 60_000 })

  // 탭 줄 끝의 [파일]. 터미널 대신 트리가 보이고 패널은 지금 task(의도 정리의 승인 화면)다
  const filesTab = win.getByRole('tab', { name: '파일', exact: true })
  await filesTab.click()
  await expect(filesTab).toHaveAttribute('aria-selected', 'true')
  await expect(win.locator('.band')).toContainText('파일 · worktree의 파일을 보고 고칩니다')
  await expect(win.locator('.terminal-host:not([hidden])')).toHaveCount(0)
  await expect(win.getByRole('button', { name: '의도 승인' })).toBeEnabled()
  const tree = win.getByRole('tree', { name: '파일' })
  await expect(tree.locator('.file-name')).toHaveText(['src', 'test', 'package.json', 'README.md'])

  // 마크다운은 [보기]로 그린다
  await tree.getByRole('treeitem', { name: 'README.md' }).click()
  const preview = win.locator('.file-preview .markdown')
  await expect(preview.locator('h1')).toHaveText('샘플 안내')
  await expect(preview.locator('li')).toHaveText(['첫 항목', '둘째 항목'])
  await win.screenshot({ path: 'test-results/files-preview.png' })

  // [편집]으로 고치고 Ctrl+S로 저장한다. worktree의 파일이 바뀌고 원래 줄 끝을 지킨다(Windows의 git은 CRLF로 둘 수 있다)
  const readme = path.join(worktree(), 'README.md')
  const eol = fs.readFileSync(readme, 'utf8').includes('\r\n') ? '\r\n' : '\n'
  await win.locator('.file-mode').getByRole('tab', { name: '편집' }).click()
  const editor = win.getByLabel('README.md 편집')
  await editor.fill('# 고친 안내\n\n본문\n')
  await expect(win.locator('.file-dirty')).toHaveText('저장하지 않음')
  await editor.press('Control+s')
  await expect(win.locator('.file-dirty')).toHaveCount(0)
  expect(fs.readFileSync(readme, 'utf8')).toBe('# 고친 안내\n\n본문\n'.replace(/\n/g, eol))
  expect(fs.readFileSync(path.join(repo, 'README.md'), 'utf8')).toContain('# 샘플 안내')
  // 고친 것이 없으면 Ctrl+S가 쓰지 않는다: 그사이 밖에서 바뀐 파일을 건드리지 않고 충돌도 알리지 않는다
  fs.writeFileSync(readme, '# 밖에서 고침\n')
  await editor.press('Control+s')
  await expect(win.locator('.file-banner')).toHaveCount(0)
  expect(fs.readFileSync(readme, 'utf8')).toBe('# 밖에서 고침\n')
  await win.locator('.file-mode').getByRole('tab', { name: '보기' }).click()
  await expect(preview.locator('h1')).toHaveText('고친 안내')

  // 폴더를 펼쳐 코드 파일을 연다: 바로 편집 칸이다
  await tree.getByRole('treeitem', { name: 'src' }).click()
  await expect(tree.getByRole('treeitem', { name: 'src' })).toHaveAttribute('aria-expanded', 'true')
  await tree.getByRole('treeitem', { name: 'avg.js' }).click()
  const code = win.getByLabel('src/avg.js 편집')
  await expect(code).toHaveValue(/export function avg/)
  await expect(win.locator('.file-mode')).toHaveCount(0)
  await win.screenshot({ path: 'test-results/files-code.png' })

  // 연 파일은 탭으로 남는다. 고친 채 다른 파일을 열어도 묻지 않고, 탭을 오가도 고친 글이 남는다 (D492)
  const fileTabs = win.getByRole('tablist', { name: '연 파일' })
  await expect(fileTabs.getByRole('tab')).toHaveText(['README.md', 'avg.js'])
  await expect(fileTabs.getByRole('tab', { name: 'avg.js' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await code.fill('export const avg = () => 0\n')
  await tree.getByRole('treeitem', { name: 'README.md' }).click()
  await expect(fileTabs.getByRole('tab', { name: 'README.md' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(preview.locator('h1')).toHaveText('고친 안내')
  await expect(win.locator('.file-tab-dirty')).toHaveCount(1)
  await fileTabs.getByRole('tab', { name: 'avg.js' }).click()
  await expect(code).toHaveValue('export const avg = () => 0\n')

  // 고친 탭을 닫으면 묻는다
  await fileTabs.getByRole('button', { name: 'src/avg.js 닫기' }).click()
  const banner = win.locator('.file-banner')
  await expect(banner).toContainText('저장하지 않은 변경이 있습니다')
  await banner.getByRole('button', { name: '취소' }).click()
  await expect(code).toHaveValue('export const avg = () => 0\n')
  // 고치지 않은 탭은 바로 닫는다
  await fileTabs.getByRole('button', { name: 'README.md 닫기' }).click()
  await expect(fileTabs.getByRole('tab')).toHaveText(['avg.js'])

  // 다른 탭에 다녀와도 고치던 글이 남는다
  await win.getByRole('tab', { name: /의도 정리/ }).click()
  await expect(win.locator('.terminal-host:not([hidden])')).toHaveCount(1)
  await filesTab.click()
  await expect(code).toHaveValue('export const avg = () => 0\n')

  // 연 뒤 바뀐 파일(에이전트가 고친 것 등)은 덮어쓰기 전에 알린다
  fs.writeFileSync(path.join(worktree(), 'src', 'avg.js'), '// 에이전트\n')
  await win.getByRole('button', { name: '저장' }).click()
  await expect(banner).toContainText('연 뒤에 파일이 바뀌었습니다')
  expect(fs.readFileSync(path.join(worktree(), 'src', 'avg.js'), 'utf8')).toBe('// 에이전트\n')
  await banner.getByRole('button', { name: '덮어쓰기' }).click()
  await expect(banner).toHaveCount(0)
  expect(fs.readFileSync(path.join(worktree(), 'src', 'avg.js'), 'utf8')).toBe(
    'export const avg = () => 0\n',
  )

  // Work가 바꾼 파일을 트리에 표시한다 (D490): 고친 파일과 그것을 담은 폴더, 지운 파일은 그 자리에 줄을 그어 보인다
  fs.rmSync(path.join(worktree(), 'package.json'))
  await win.getByRole('button', { name: '새로 고침' }).click()
  const row = (name: string) => tree.getByRole('treeitem', { name, exact: true })
  await expect(row('README.md')).toHaveClass(/changed-M/)
  await expect(row('README.md').locator('.file-mark')).toHaveText('M')
  await expect(row('avg.js')).toHaveClass(/changed-M/)
  await expect(row('src')).toHaveClass(/changed-M/)
  await expect(row('test')).not.toHaveClass(/changed-/)
  await expect(row('package.json')).toHaveClass(/deleted/)
  await expect(row('package.json')).toHaveAttribute('aria-disabled', 'true')
  await expect(win.locator('.file-tree-head')).toContainText('바뀐 파일 3')
  await expect(fileTabs.locator('.file-tab.active')).toHaveClass(/changed-M/)
  await win.screenshot({ path: 'test-results/files-changes.png' })

  // 터미널에서 Ctrl+클릭한 worktree의 글 파일은 [파일] 탭에서 연다. 담은 폴더를 펼친다 (D491)
  await win.getByRole('tab', { name: /의도 정리/ }).click()
  const word = await wordAt(win, 'Read test/avg.test.js', 'test/avg.test.js')
  await win.mouse.move(word.x, word.y)
  await expect(win.locator('.terminal-host:not([hidden]) .xterm')).toHaveAttribute(
    'title',
    'Ctrl+클릭으로 열기',
  )
  await win.keyboard.down('Control')
  await win.mouse.click(word.x, word.y)
  await win.keyboard.up('Control')
  await expect(filesTab).toHaveAttribute('aria-selected', 'true')
  await expect(fileTabs.getByRole('tab', { name: 'avg.test.js' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(win.getByLabel('test/avg.test.js 편집')).toHaveValue(/test\('평균'/)
  await expect(row('test')).toHaveAttribute('aria-expanded', 'true')
  await expect(row('avg.test.js')).toHaveAttribute('aria-selected', 'true')
  expect(await opened()).toEqual([])

  // Shift를 더하면 OS 앱으로 연다. 탭을 옮기는 사이 마우스가 그대로라 링크를 다시 알아보게 옮겼다 온다
  await win.getByRole('tab', { name: /의도 정리/ }).click()
  await win.mouse.move(word.x, word.y + 60)
  await win.mouse.move(word.x, word.y)
  await expect(win.locator('.terminal-host:not([hidden]) .xterm')).toHaveAttribute(
    'title',
    'Ctrl+클릭으로 열기',
  )
  await win.keyboard.down('Control')
  await win.keyboard.down('Shift')
  await win.mouse.click(word.x, word.y)
  await win.keyboard.up('Shift')
  await win.keyboard.up('Control')
  await expect.poll(opened).toEqual([path.join(worktree(), 'test', 'avg.test.js')])
  await expect(filesTab).toHaveAttribute('aria-selected', 'false')
})

const opened = () =>
  app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened.slice())

/** 터미널 줄에 보인 낱말의 가운데 자리 */
async function wordAt(win: Page, line: string, word: string): Promise<{ x: number; y: number }> {
  const row = win.locator('.terminal-host:not([hidden]) .xterm-rows > div', { hasText: line })
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
