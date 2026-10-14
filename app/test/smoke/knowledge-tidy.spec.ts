// [스모크] 지식 정리 후보 (D393): 같은 anchor의 지식 항목이 둘인 레포를 등록하고 새 Work 대화상자를 열면 후보가 펼쳐져
// 보이고, [지식 정리 Work로 채우기]를 누르면 후보로 채운 요청과 일반 유형이 된다. 후보를 찾는 경우는 [흐름]과 [단위]가 본다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { makeRepo } from '../support/repo'
import { REPO_FILES } from '../support/scenarios'

const APP_DIR = path.resolve(__dirname, '../..')

const rule = (anchor: string) =>
  `---\nkind: rule\nsource: human\nanchor: ${anchor}\n---\n# ${anchor}\n\n## 규칙\n- 규칙\n`

let app: ElectronApplication
let root: string

test.beforeAll(async () => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-smoke-tidy-')))
  const { repo } = makeRepo(root, 'sample', {
    ...REPO_FILES,
    'src/vat.js': 'const VAT_RATE = 0.1\nmodule.exports = { VAT_RATE }\n',
    'docs/knowledge/billing/vat-a.md': rule('VAT_RATE'),
    'docs/knowledge/billing/vat-b.md': rule('VAT_RATE'),
  })
  const env = {
    ...process.env,
    RELAY_HOME: path.join(root, 'home'),
    RELAY_UPDATE: 'off',
    RELAY_KNOWLEDGE: 'on',
  } as Record<string, string>
  const exe = process.env['RELAY_APP_EXE']
  app = exe
    ? await electron.launch({ executablePath: exe, env })
    : await electron.launch({ args: [APP_DIR], env })
  await app.evaluate(({ dialog }, dir) => {
    dialog.showOpenDialog = (() =>
      Promise.resolve({ canceled: false, filePaths: [dir] })) as typeof dialog.showOpenDialog
  }, repo)
})

test.afterAll(async () => {
  await app?.close()
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

test('새 Work 대화상자의 지식 정리 후보로 요청을 채운다 (D393)', async () => {
  const win = await app.firstWindow()
  await expect(win.locator('.layout')).toBeVisible()
  await win.locator('.sidebar').getByRole('button', { name: '프로젝트 추가' }).click()
  await win.getByRole('button', { name: '레포 폴더 고르기' }).click()
  await expect(win.locator('table.checks')).toContainText('git 레포의 루트인가', {
    timeout: 30_000,
  })
  await win.getByRole('button', { name: '등록' }).click()

  await win.getByRole('button', { name: '새 Work' }).click()
  await expect(win.locator('.tidy-notice')).toContainText('같은 anchor VAT_RATE', {
    timeout: 30_000,
  })
  await win.getByRole('button', { name: '지식 정리 Work로 채우기' }).click()

  const request = win.getByLabel('요청')
  await expect(request).toHaveValue(/`docs\/knowledge\/`의 팀 지식을 정리한다/, { timeout: 30_000 })
  await expect(request).toHaveValue(/같은 anchor `VAT_RATE`/)
  const types = win.getByRole('radiogroup', { name: '업무 유형' })
  await expect(types.getByRole('radio', { name: '일반' })).toHaveAttribute('aria-checked', 'true')
  await win.screenshot({ path: 'test-results/knowledge-tidy-dialog.png' })
})
