import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  _electron as electron,
  test,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test'
import { renderEntry } from '../../src/core/knowledge'
import type { RelayApi } from '../../src/shared/api'
import type { KnowledgeEntry } from '../../src/shared/knowledge'
import { git, makeRepo, writeFiles } from '../flow/repo'

const APP = path.resolve(__dirname, '../..')
const evidence = path.join(APP, 'audit-artifacts')
let app: ElectronApplication
let root: string
let win: Page
let home: string
const rule: KnowledgeEntry = {
  id: 'domain-00000001',
  kind: 'domain',
  subkind: null,
  status: 'active',
  superseded_by: null,
  paths: [],
  terms: ['반올림'],
  hashes: {},
  source: { work: 'w-audit', task: 't-01', by: 'human' },
  rule: '청구 금액은 반올림한다',
  why: '회계팀 결정',
  not_in_code: '사람이 정함',
  incentive: '은행가 반올림을 적용한다',
}
const dialog = () => win.getByRole('dialog', { name: '지식 · sample' })
async function start(entries: KnowledgeEntry[] = [rule], team = false, share = true) {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-gui-audit-'))
  home = path.join(root, 'home')
  const { repo } = makeRepo(root, 'sample', { 'src/billing.ts': 'export const n = 1\n' })
  const project = {
    schema_version: 1,
    project_id: 'audit',
    repo_path: repo,
    default_branch: 'main',
    created_at: '2026-10-02T00:00:00Z',
    checks: { origin: false, gh: false, checked_at: 'audit' },
    knowledge_share: share,
  }
  writeFiles(home, { 'projects/audit/project.json': JSON.stringify(project) })
  for (const e of entries)
    writeFiles(team ? repo : home, {
      [`${team ? 'docs/knowledge' : 'projects/audit/knowledge/mine'}/${e.kind}/${e.id}.md`]:
        renderEntry(e),
    })
  if (team) {
    git(repo, 'add', '-A')
    git(repo, 'commit', '-qm', 'knowledge fixture')
  }
  const env = { ...process.env, RELAY_HOME: home, ELECTRON_DISABLE_SANDBOX: '1' } as Record<
    string,
    string
  >
  delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({ args: ['--no-sandbox', APP], env })
  win = await app.firstWindow()
  await win.getByRole('button', { name: '지식', exact: true }).click()
  await expect(dialog()).toContainText('팀 공유')
}
async function shot(name: string) {
  await win.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true })
}
test.afterEach(async () => {
  await app?.close()
  if (root) fs.rmSync(root, { recursive: true, force: true })
})

test('G01 actual Electron edit persists through dialog close and reopen', async () => {
  await start()
  await dialog().getByRole('button', { name: '고침', exact: true }).click()
  await dialog().getByLabel('규칙', { exact: true }).fill('청구 금액은 올림한다')
  await dialog().getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog()).toContainText('청구 금액은 올림한다')
  await dialog().getByRole('button', { name: '닫기', exact: true }).click()
  await win.getByRole('button', { name: '지식', exact: true }).click()
  await expect(dialog()).toContainText('청구 금액은 올림한다')
  await shot('G01-edit-persisted')
})
test('G02 blank rule should display an error in actual UI', async () => {
  await start()
  await dialog().getByRole('button', { name: '고침', exact: true }).click()
  await dialog().getByLabel('규칙', { exact: true }).fill('   ')
  await dialog().getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog().getByRole('button', { name: '고침', exact: true })).toBeEnabled()
  await shot('G02-blank-rule-silent-success')
  await expect(dialog().locator('.error')).toBeVisible({ timeout: 1500 })
})
test('G03 moving team replacement to personal leaves a dangling public tombstone', async () => {
  await start([rule], true)
  await dialog().getByRole('button', { name: '고침', exact: true }).click()
  await dialog().getByLabel('규칙', { exact: true }).fill('내 개인 규칙')
  await dialog().getByRole('button', { name: '대체 항목으로 저장' }).click()
  await expect(dialog()).toContainText('공유 대기 (2)')
  const row = dialog().locator('li.knowledge-item').filter({ hasText: '내 개인 규칙' })
  await row.getByRole('button', { name: '나만으로' }).click()
  await expect(dialog()).toContainText('나만 (1)')
  await shot('G03-private-target-public-tombstone')
  const data = await win.evaluate(() =>
    (globalThis as unknown as { relay: RelayApi }).relay.knowledgeScreen('audit'),
  )
  fs.writeFileSync(path.join(evidence, 'G03-screen.json'), JSON.stringify(data, null, 2))
  expect(data.ok && data.screen.pending.filter((e) => e.status === 'superseded').length).toBe(0)
})
test('G04 invalid terms report an error but close editor; reason and kind cannot be edited', async () => {
  await start()
  await dialog().getByRole('button', { name: '고침', exact: true }).click()
  await expect(dialog().getByLabel('이유', { exact: true })).toHaveCount(0)
  await expect(dialog().getByLabel('종류', { exact: true })).toHaveCount(0)
  await dialog().getByLabel('용어', { exact: true }).fill('')
  await dialog().getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog().locator('.error')).toContainText('용어는 1~5개')
  await expect(dialog().getByLabel('규칙', { exact: true })).toHaveCount(0)
  await shot('G04-validation-closes-editor')
})
test('G05 300 entries render; search filter and replacement history are absent', async () => {
  const entries = Array.from({ length: 300 }, (_, i) => ({
    ...rule,
    id: `domain-${i.toString(36).padStart(8, '0')}`,
    rule: `청구 규칙 ${i + 1}: 환불과 반올림`,
  }))
  const started = Date.now()
  await start(entries)
  await expect(dialog().locator('li.knowledge-item')).toHaveCount(300)
  await expect(dialog().getByRole('searchbox')).toHaveCount(0)
  await expect(dialog().locator('input')).toHaveCount(0)
  const metrics = {
    entries: 300,
    launchAndOpenMs: Date.now() - started,
    ...(await dialog().evaluate((e) => ({
      scrollHeight: e.scrollHeight,
      clientHeight: e.clientHeight,
    }))),
  }
  fs.writeFileSync(path.join(evidence, 'G05-scale.json'), JSON.stringify(metrics, null, 2))
  await shot('G05-300-entries')
})
test('G06 delete is immediate and no undo remains in the knowledge dialog', async () => {
  await start()
  await dialog().getByRole('button', { name: '버림', exact: true }).click()
  await expect(dialog()).toContainText('나만 (0)')
  await expect(dialog().getByRole('button', { name: /되돌|복원|취소/ })).toHaveCount(0)
  await shot('G06-deleted-no-undo')
})
