// 앱 화면을 PNG로 찍는다. 에이전트가 화면을 고친 뒤 사람에게 묻기 전에 스스로 띄워 보는 도구다(CONTRIBUTING.md).
// [스모크]처럼 out/의 빌드를 가짜 claude와 임시 RELAY_HOME으로 띄우므로, 실제 claude나 사람의 relay 기록을 건드리지 않는다.
//
//   npm run shot -- [찍을 파일.png] [--project] [--steps <파일.mjs>] [--scenario <파일.json>]
//
// - 찍을 파일: 없으면 test-results/shot.png
// - --project: 임시 sample 레포를 프로젝트로 등록한 뒤 찍는다
// - --steps: default export async (win, ctx) => {}를 찍기 전에 부른다. win은 Playwright Page, ctx는 { app, repo, root }다.
//   여러 장을 찍으려면 그 안에서 win.screenshot({ path })을 부른다
// - --scenario: 가짜 claude의 시나리오(FAKE_CLAUDE_SCENARIO, test/support/scenarios.ts의 모양)
//
// Linux에서 DISPLAY가 없으면 xvfb-run으로 다시 돈다.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { _electron as electron } from '@playwright/test'

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

if (process.platform === 'linux' && !process.env['DISPLAY'] && !process.env['RELAY_SHOT_XVFB']) {
  const r = spawnSync('xvfb-run', ['-a', process.execPath, ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, RELAY_SHOT_XVFB: '1' },
  })
  if (r.error) {
    console.error('DISPLAY가 없고 xvfb-run도 없습니다. xvfb를 설치하거나 DISPLAY를 정해 주세요.')
    process.exit(1)
  }
  process.exit(r.status ?? 1)
}

function parse(argv) {
  const o = { out: path.join(APP_DIR, 'test-results', 'shot.png'), project: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--project') o.project = true
    else if (a === '--steps') o.steps = path.resolve(argv[++i])
    else if (a === '--scenario') o.scenario = path.resolve(argv[++i])
    else o.out = path.resolve(a)
  }
  return o
}

function makeRepo(root) {
  const repo = path.join(root, 'sample')
  fs.mkdirSync(repo, { recursive: true })
  fs.writeFileSync(path.join(repo, 'README.md'), '# sample\n')
  const git = (...args) => spawnSync('git', args, { cwd: repo, stdio: 'ignore' })
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('-c', 'user.name=relay', '-c', 'user.email=relay@example.com', 'commit', '-q', '-m', 'init')
  return repo
}

const opts = parse(process.argv.slice(2))
if (!fs.existsSync(path.join(APP_DIR, 'out', 'main'))) {
  console.error(
    'out/에 빌드가 없습니다. npm run build를 먼저 돌려 주세요(npm run shot은 함께 돌립니다).',
  )
  process.exit(1)
}

const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-shot-')))
const repo = makeRepo(root)
const fake = path.join(
  APP_DIR,
  'test/support/fake-claude',
  isWin ? 'fake-claude.cmd' : 'fake-claude.mjs',
)
const env = {
  ...process.env,
  CLAUDE_BIN: fake,
  RELAY_HOME: path.join(root, 'home'),
  RELAY_UPDATE: 'off',
  FAKE_CLAUDE_RECORD: path.join(root, 'record'),
  ...(opts.scenario ? { FAKE_CLAUDE_SCENARIO: opts.scenario } : {}),
}

const app = await electron.launch({ args: [APP_DIR, '--no-sandbox'], env })
try {
  // 폴더 고르기와 확인 창은 묻지 않고 sample 레포와 첫 단추로 답한다 ([스모크]와 같다)
  await app.evaluate(({ dialog }, dir) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [dir] })
    dialog.showMessageBox = () => Promise.resolve({ response: 0, checkboxChecked: false })
  }, repo)
  const win = await app.firstWindow()
  await win.locator('.layout').waitFor({ timeout: 30_000 })
  if (opts.project) {
    await win.locator('.sidebar').getByRole('button', { name: '프로젝트 추가' }).click()
    await win.getByRole('button', { name: '레포 폴더 고르기' }).click()
    await win.getByRole('button', { name: '등록' }).click()
    await win.locator('.project-name').filter({ hasText: 'sample' }).waitFor({ timeout: 30_000 })
  }
  if (opts.steps) {
    const mod = await import(pathToFileURL(opts.steps).href)
    await mod.default(win, { app, repo, root })
  }
  // 글꼴과 전환 효과가 자리 잡을 때까지 잠깐 둔다
  await win.waitForTimeout(500)
  fs.mkdirSync(path.dirname(opts.out), { recursive: true })
  await win.screenshot({ path: opts.out })
  console.log(opts.out)
} finally {
  await app.close()
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
}
