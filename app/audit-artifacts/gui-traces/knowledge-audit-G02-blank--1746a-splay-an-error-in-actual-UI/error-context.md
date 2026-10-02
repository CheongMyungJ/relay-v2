# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: knowledge-audit.spec.ts >> G02 blank rule should display an error in actual UI
- Location: test/audit/knowledge-audit.spec.ts:90:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: '지식 · sample' }).locator('.error')
Expected: visible
Timeout: 1500ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('dialog', { name: '지식 · sample' }).locator('.error') with timeout 1500ms
  - waiting for getByRole('dialog', { name: '지식 · sample' }).locator('.error')

```

```yaml
- complementary:
  - button "sample"
  - button "지식"
  - button "새 Work"
  - button "프로젝트 추가"
  - button "설정"
- main:
  - tablist
  - text: 왼쪽에서 Work를 고르거나 새 Work를 만드세요
- complementary: handoff 상태와 산출물
- dialog "지식 · sample":
  - heading "지식 · sample" [level=2]
  - text: 지식 폴더
  - code: docs/knowledge/
  - text: "· 팀 지식: main (85af01843123) · 팀 공유 켬"
  - heading "팀 (0)" [level=3]
  - text: 없음
  - heading "공유 대기 (0)" [level=3]
  - text: 없음
  - heading "나만 (1)" [level=3]
  - list:
    - listitem:
      - text: "[도메인 규칙] 청구 금액은 반올림한다 — 나만"
      - code: domain-00000001
      - text: "출처: w-audit t-01 · 사람 · 용어: 반올림 이유: 회계팀 결정"
      - button "고침"
      - button "버림"
      - button "팀으로"
  - button "닫기"
```

# Test source

```ts
  1   | import fs from 'node:fs'
  2   | import os from 'node:os'
  3   | import path from 'node:path'
  4   | import {
  5   |   _electron as electron,
  6   |   test,
  7   |   expect,
  8   |   type ElectronApplication,
  9   |   type Page,
  10  | } from '@playwright/test'
  11  | import { renderEntry } from '../../src/core/knowledge'
  12  | import type { RelayApi } from '../../src/shared/api'
  13  | import type { KnowledgeEntry } from '../../src/shared/knowledge'
  14  | import { git, makeRepo, writeFiles } from '../flow/repo'
  15  |
  16  | const APP = path.resolve(__dirname, '../..')
  17  | const evidence = path.join(APP, 'audit-artifacts')
  18  | let app: ElectronApplication
  19  | let root: string
  20  | let win: Page
  21  | let home: string
  22  | const rule: KnowledgeEntry = {
  23  |   id: 'domain-00000001',
  24  |   kind: 'domain',
  25  |   subkind: null,
  26  |   status: 'active',
  27  |   superseded_by: null,
  28  |   paths: [],
  29  |   terms: ['반올림'],
  30  |   hashes: {},
  31  |   source: { work: 'w-audit', task: 't-01', by: 'human' },
  32  |   rule: '청구 금액은 반올림한다',
  33  |   why: '회계팀 결정',
  34  |   not_in_code: '사람이 정함',
  35  |   incentive: '은행가 반올림을 적용한다',
  36  | }
  37  | const dialog = () => win.getByRole('dialog', { name: '지식 · sample' })
  38  | async function start(entries: KnowledgeEntry[] = [rule], team = false, share = true) {
  39  |   root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-gui-audit-'))
  40  |   home = path.join(root, 'home')
  41  |   const { repo } = makeRepo(root, 'sample', { 'src/billing.ts': 'export const n = 1\n' })
  42  |   const project = {
  43  |     schema_version: 1,
  44  |     project_id: 'audit',
  45  |     repo_path: repo,
  46  |     default_branch: 'main',
  47  |     created_at: '2026-10-02T00:00:00Z',
  48  |     checks: { origin: false, gh: false, checked_at: 'audit' },
  49  |     knowledge_share: share,
  50  |   }
  51  |   writeFiles(home, { 'projects/audit/project.json': JSON.stringify(project) })
  52  |   for (const e of entries)
  53  |     writeFiles(team ? repo : home, {
  54  |       [`${team ? 'docs/knowledge' : 'projects/audit/knowledge/mine'}/${e.kind}/${e.id}.md`]:
  55  |         renderEntry(e),
  56  |     })
  57  |   if (team) {
  58  |     git(repo, 'add', '-A')
  59  |     git(repo, 'commit', '-qm', 'knowledge fixture')
  60  |   }
  61  |   const env = { ...process.env, RELAY_HOME: home, ELECTRON_DISABLE_SANDBOX: '1' } as Record<
  62  |     string,
  63  |     string
  64  |   >
  65  |   delete env.ELECTRON_RUN_AS_NODE
  66  |   app = await electron.launch({ args: ['--no-sandbox', APP], env })
  67  |   win = await app.firstWindow()
  68  |   await win.getByRole('button', { name: '지식', exact: true }).click()
  69  |   await expect(dialog()).toContainText('팀 공유')
  70  | }
  71  | async function shot(name: string) {
  72  |   await win.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true })
  73  | }
  74  | test.afterEach(async () => {
  75  |   await app?.close()
  76  |   if (root) fs.rmSync(root, { recursive: true, force: true })
  77  | })
  78  |
  79  | test('G01 actual Electron edit persists through dialog close and reopen', async () => {
  80  |   await start()
  81  |   await dialog().getByRole('button', { name: '고침', exact: true }).click()
  82  |   await dialog().getByLabel('규칙', { exact: true }).fill('청구 금액은 올림한다')
  83  |   await dialog().getByRole('button', { name: '저장', exact: true }).click()
  84  |   await expect(dialog()).toContainText('청구 금액은 올림한다')
  85  |   await dialog().getByRole('button', { name: '닫기', exact: true }).click()
  86  |   await win.getByRole('button', { name: '지식', exact: true }).click()
  87  |   await expect(dialog()).toContainText('청구 금액은 올림한다')
  88  |   await shot('G01-edit-persisted')
  89  | })
  90  | test('G02 blank rule should display an error in actual UI', async () => {
  91  |   await start()
  92  |   await dialog().getByRole('button', { name: '고침', exact: true }).click()
  93  |   await dialog().getByLabel('규칙', { exact: true }).fill('   ')
  94  |   await dialog().getByRole('button', { name: '저장', exact: true }).click()
  95  |   await expect(dialog().getByRole('button', { name: '고침', exact: true })).toBeEnabled()
  96  |   await shot('G02-blank-rule-silent-success')
> 97  |   await expect(dialog().locator('.error')).toBeVisible({ timeout: 1500 })
      |                                            ^ Error: expect(locator).toBeVisible() failed
  98  | })
  99  | test('G03 moving team replacement to personal leaves a dangling public tombstone', async () => {
  100 |   await start([rule], true)
  101 |   await dialog().getByRole('button', { name: '고침', exact: true }).click()
  102 |   await dialog().getByLabel('규칙', { exact: true }).fill('내 개인 규칙')
  103 |   await dialog().getByRole('button', { name: '대체 항목으로 저장' }).click()
  104 |   await expect(dialog()).toContainText('공유 대기 (2)')
  105 |   const row = dialog().locator('li.knowledge-item').filter({ hasText: '내 개인 규칙' })
  106 |   await row.getByRole('button', { name: '나만으로' }).click()
  107 |   await expect(dialog()).toContainText('나만 (1)')
  108 |   await shot('G03-private-target-public-tombstone')
  109 |   const data = await win.evaluate(() =>
  110 |     (globalThis as unknown as { relay: RelayApi }).relay.knowledgeScreen('audit'),
  111 |   )
  112 |   fs.writeFileSync(path.join(evidence, 'G03-screen.json'), JSON.stringify(data, null, 2))
  113 |   expect(data.ok && data.screen.pending.filter((e) => e.status === 'superseded').length).toBe(0)
  114 | })
  115 | test('G04 invalid terms report an error but close editor; reason and kind cannot be edited', async () => {
  116 |   await start()
  117 |   await dialog().getByRole('button', { name: '고침', exact: true }).click()
  118 |   await expect(dialog().getByLabel('이유', { exact: true })).toHaveCount(0)
  119 |   await expect(dialog().getByLabel('종류', { exact: true })).toHaveCount(0)
  120 |   await dialog().getByLabel('용어', { exact: true }).fill('')
  121 |   await dialog().getByRole('button', { name: '저장', exact: true }).click()
  122 |   await expect(dialog().locator('.error')).toContainText('용어는 1~5개')
  123 |   await expect(dialog().getByLabel('규칙', { exact: true })).toHaveCount(0)
  124 |   await shot('G04-validation-closes-editor')
  125 | })
  126 | test('G05 300 entries render; search filter and replacement history are absent', async () => {
  127 |   const entries = Array.from({ length: 300 }, (_, i) => ({
  128 |     ...rule,
  129 |     id: `domain-${i.toString(36).padStart(8, '0')}`,
  130 |     rule: `청구 규칙 ${i + 1}: 환불과 반올림`,
  131 |   }))
  132 |   const started = Date.now()
  133 |   await start(entries)
  134 |   await expect(dialog().locator('li.knowledge-item')).toHaveCount(300)
  135 |   await expect(dialog().getByRole('searchbox')).toHaveCount(0)
  136 |   await expect(dialog().locator('input')).toHaveCount(0)
  137 |   const metrics = {
  138 |     entries: 300,
  139 |     launchAndOpenMs: Date.now() - started,
  140 |     ...(await dialog().evaluate((e) => ({
  141 |       scrollHeight: e.scrollHeight,
  142 |       clientHeight: e.clientHeight,
  143 |     }))),
  144 |   }
  145 |   fs.writeFileSync(path.join(evidence, 'G05-scale.json'), JSON.stringify(metrics, null, 2))
  146 |   await shot('G05-300-entries')
  147 | })
  148 | test('G06 delete is immediate and no undo remains in the knowledge dialog', async () => {
  149 |   await start()
  150 |   await dialog().getByRole('button', { name: '버림', exact: true }).click()
  151 |   await expect(dialog()).toContainText('나만 (0)')
  152 |   await expect(dialog().getByRole('button', { name: /되돌|복원|취소/ })).toHaveCount(0)
  153 |   await shot('G06-deleted-no-undo')
  154 | })
  155 |
```
