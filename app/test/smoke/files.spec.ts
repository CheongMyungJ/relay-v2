// [스모크] Work의 [파일] 탭 (D464~D468): 탭 줄 끝의 [파일]을 누르면 worktree의 트리가 보이고, 패널은 지금 task 그대로다.
// 마크다운은 그려 보이고 [편집]으로 고쳐 Ctrl+S로 저장한다. 다른 파일로 옮길 때 고친 것을 묻고, 연 뒤 바뀐 파일은 덮어쓰기
// 전에 알린다. 다른 탭에 다녀와도 고치던 글이 남는다. 읽기·쓰기의 세부는 [어댑터], 명령의 연결은 [흐름]이 본다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { makeRepo } from '../support/repo'
import { REPO_FILES, REQUEST, scenario } from '../support/scenarios'

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
  fs.writeFileSync(scenarioFile, JSON.stringify(scenario()))
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

/** 하나뿐인 Work의 worktree */
function worktree(): string {
  const projects = path.join(home, 'projects')
  const [project] = fs.readdirSync(projects)
  const trees = path.join(projects, project ?? '', 'worktrees')
  const [work] = fs.readdirSync(trees)
  return path.join(trees, work ?? '')
}

test('[파일] 탭에서 worktree의 파일을 보고, 마크다운을 그려 보이고, 고쳐 저장한다 (D464~D468)', async () => {
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

  // [편집]으로 고치고 Ctrl+S로 저장한다. worktree의 파일이 바뀐다
  await win.locator('.file-mode').getByRole('tab', { name: '편집' }).click()
  const editor = win.getByLabel('README.md 편집')
  await editor.fill('# 고친 안내\n\n본문\n')
  await expect(win.locator('.file-dirty')).toHaveText('저장하지 않음')
  await editor.press('Control+s')
  await expect(win.locator('.file-dirty')).toHaveCount(0)
  expect(fs.readFileSync(path.join(worktree(), 'README.md'), 'utf8')).toBe('# 고친 안내\n\n본문\n')
  expect(fs.readFileSync(path.join(repo, 'README.md'), 'utf8')).toContain('# 샘플 안내')
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

  // 고친 채 다른 파일을 고르면 묻는다
  await code.fill('export const avg = () => 0\n')
  await tree.getByRole('treeitem', { name: 'README.md' }).click()
  const banner = win.locator('.file-banner')
  await expect(banner).toContainText('저장하지 않은 변경이 있습니다')
  await banner.getByRole('button', { name: '취소' }).click()
  await expect(code).toHaveValue('export const avg = () => 0\n')

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
})
