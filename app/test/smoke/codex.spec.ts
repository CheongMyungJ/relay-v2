// 설치본에서도 Electron Node 모드의 브리지와 앱 질문창을 실제로 거친다. 모델 호출은 하지 않는다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { makeRepo } from '../flow/repo'
import { handoff, intentDraft, REPO_FILES, REQUEST } from '../flow/scenarios'

const appDir = path.resolve(__dirname, '../..')
const win32 = process.platform === 'win32'
let app: ElectronApplication | undefined
let root: string
// Playwright는 사용하지 않는 fixture 인자도 객체 분해 형태여야 한다.
// eslint-disable-next-line no-empty-pattern
test.afterEach(async ({}, info) => {
  if (root && info.status !== info.expectedStatus) {
    const record = path.join(root, 'record/fake-codex.jsonl')
    if (fs.existsSync(record))
      await info.attach('fake-codex-record', { path: record, contentType: 'text/plain' })
  }
  await app?.close()
  if (root) fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

test('엔진 설정에서 Codex를 골라 앱 질문창으로 답하고 다음 task를 Claude로 전환한다', async () => {
  test.skip(
    !win32 && !process.env['DISPLAY'],
    'Electron GUI 스모크는 Windows 또는 DISPLAY가 필요합니다.',
  )
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-codex-ui-')))
  const home = path.join(root, 'home')
  fs.mkdirSync(home)
  const { repo } = makeRepo(root, 'codex-ui', REPO_FILES)
  const scenario = path.join(root, 'scenario.json')
  fs.writeFileSync(
    scenario,
    JSON.stringify({
      tasks: {
        'work-start': [
          { do: 'prompt' },
          {
            do: 'ask',
            questions: [
              {
                id: 'scope',
                header: '범위',
                question: '범위를 고르세요.',
                options: [
                  { label: '작게 (추천)', description: '변경을 줄입니다.' },
                  { label: '전체', description: '전체를 고칩니다.' },
                ],
              },
              { id: 'env', header: '환경', question: '환경을 알려주세요.' },
            ],
          },
          { do: 'write', file: 'intent.draft.md', text: intentDraft() },
          { do: 'write', file: 'handoff.md', text: handoff() },
          { do: 'stop' },
          { do: 'wait' },
        ],
        'code-fix': [{ do: 'prompt' }, { do: 'wait' }],
      },
    }),
  )
  const env = {
    ...process.env,
    RELAY_HOME: home,
    CLAUDE_BIN: path.join(
      appDir,
      'test/fake-claude',
      win32 ? 'fake-claude.cmd' : 'fake-claude.mjs',
    ),
    CODEX_BIN: path.join(appDir, 'test/fake-codex', win32 ? 'fake-codex.cmd' : 'fake-codex.mjs'),
    FAKE_CLAUDE_SCENARIO: scenario,
    FAKE_CODEX_SCENARIO: scenario,
    FAKE_CLAUDE_RECORD: path.join(root, 'record'),
    FAKE_CODEX_RECORD: path.join(root, 'record'),
  } as Record<string, string>
  const exe = process.env['RELAY_APP_EXE']
  app = await electron.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: exe ? [] : [appDir],
    env,
  })
  await app.evaluate(({ dialog }, dir) => {
    dialog.showOpenDialog = (() =>
      Promise.resolve({ canceled: false, filePaths: [dir] })) as typeof dialog.showOpenDialog
    dialog.showMessageBox = (() =>
      Promise.resolve({ response: 0, checkboxChecked: false })) as typeof dialog.showMessageBox
  }, repo)
  const window = await app.firstWindow()
  await window.getByRole('button', { name: '설정', exact: true }).click()
  await window.getByLabel('기본 엔진').selectOption('codex')
  await expect(window.getByRole('dialog', { name: '설정', exact: true })).toContainText(
    'Codex 작업은 사람이 승인합니다.',
  )
  await window.getByRole('button', { name: '저장', exact: true }).click()
  await window
    .locator('.sidebar')
    .getByRole('button', { name: '프로젝트 추가', exact: true })
    .click()
  await window.getByRole('button', { name: '레포 폴더 고르기' }).click()
  await expect(window.locator('table.checks')).toContainText('Codex', { timeout: 30_000 })
  await window.getByRole('button', { name: '등록', exact: true }).click()
  await window.getByRole('button', { name: '새 Work', exact: true }).click()
  await window.getByLabel('요청').fill(REQUEST)
  await window.getByRole('button', { name: '시작', exact: true }).click()
  const question = window.getByRole('dialog', { name: 'Codex 질문', exact: true })
  await expect(question).toBeVisible({ timeout: 60_000 })
  await expect(question.getByRole('button', { name: '답변 보내기' })).toBeDisabled()
  await expect(question.getByRole('radio', { name: /작게/ })).not.toBeChecked()
  await question.getByRole('button', { name: '나중에 답변' }).click()
  await expect(question).not.toBeVisible()
  await expect(window.locator('.band')).toContainText('질문 대기')
  await window.getByRole('button', { name: 'Codex 질문 답변' }).click()
  await question.getByRole('radio', { name: /작게/ }).check()
  await question.getByLabel('환경 직접 입력').fill('한글 환경 정보')
  await question.getByRole('button', { name: '답변 보내기' }).click()
  await expect(question).not.toBeVisible()
  await expect(window.getByRole('button', { name: '의도 승인', exact: true })).toBeEnabled({
    timeout: 30_000,
  })
  await expect(window.locator('.band')).toContainText('Codex')
  await expect(window.locator('.status.s-awaiting_approval').first()).toHaveCSS(
    'background-color',
    'rgb(215, 186, 125)',
  )
  await expect(window.locator('.status.s-awaiting_approval').first()).toHaveCSS(
    'padding-top',
    '0px',
  )
  await expect(window.locator('.auto-hold')).toContainText('Codex 작업은 사람이 승인합니다.')
  // 작은 화면에서도 고정 승인 버튼이 설정 대화상자의 클릭을 가로채지 않는다.
  await (
    await app.browserWindow(window)
  ).evaluate((browserWindow) => browserWindow.setSize(1000, 700))
  await window.getByRole('button', { name: '설정', exact: true }).click()
  await expect(window.getByRole('dialog', { name: '설정', exact: true })).toBeVisible()
  await expect(
    window.locator('.review-actions').evaluate((footer) => {
      const rect = footer.getBoundingClientRect()
      return !!footer.ownerDocument
        .elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        ?.closest('.modal-back')
    }),
  ).resolves.toBe(true)
  await window.getByLabel('기본 엔진').selectOption('claude')
  await window.getByRole('button', { name: '저장', exact: true }).click()
  await window.getByRole('button', { name: '의도 승인', exact: true }).click()
  await expect(window.locator('.band')).toContainText('Claude Code', { timeout: 30_000 })
  await expect(window.locator('.terminal-host:not([hidden]) .xterm-rows')).toContainText(
    'FAKE-CLAUDE READY',
    { timeout: 30_000 },
  )
})
