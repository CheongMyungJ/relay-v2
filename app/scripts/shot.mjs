// 앱 화면을 PNG로 찍는다. 에이전트가 화면을 고친 뒤 사람에게 묻기 전에 스스로 띄워 보는 도구다(CONTRIBUTING.md).
// [스모크]처럼 out/의 빌드를 가짜 claude, 임시 RELAY_HOME과 userData로 띄우므로, 실제 claude나 사람의 relay를 건드리지 않고
// 켜 둔 relay가 있어도 돈다(단일 인스턴스 잠금은 userData마다다).
//
//   npm run shot -- [찍을 파일.png] [--project] [--steps <파일.mjs>] [--scenario <파일.json>]
//
// - 찍을 파일: 없으면 test-results/shot.png. 상대 경로는 npm을 부른 폴더 기준이다
// - --project: [스모크]와 같은 sample 레포(test/support의 makeRepo, REPO_FILES)를 프로젝트로 등록한 뒤 찍는다
// - --steps: default export async (win, ctx) => {}를 찍기 전에 부른다. win은 Playwright Page, ctx는 { app, repo, root }다.
//   여러 장을 찍으려면 그 안에서 win.screenshot({ path })을 부른다
// - --scenario: 가짜 claude의 시나리오(FAKE_CLAUDE_SCENARIO, test/support/scenarios.ts의 모양)
//
// Linux에서 DISPLAY가 없으면 xvfb-run으로 다시 돈다. 시험 도구의 .ts를 바로 읽으므로 Node 22.18 이상이 필요하다.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { _electron as electron } from '@playwright/test'
import { makeRepo } from '../test/support/repo.ts'
import { REPO_FILES } from '../test/support/scenarios.ts'

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'
const USAGE =
  '쓰는 법: npm run shot -- [찍을 파일.png] [--project] [--steps <파일.mjs>] [--scenario <파일.json>]'

if (process.platform === 'linux' && !process.env['DISPLAY'] && !process.env['RELAY_SHOT_XVFB']) {
  // 기본 가상 화면(1280x1024)은 창(1500x950)보다 좁아 창이 줄어든다
  const r = spawnSync(
    'xvfb-run',
    [
      '-a',
      '-s',
      '-screen 0 1920x1080x24',
      process.execPath,
      ...process.execArgv,
      ...process.argv.slice(1),
    ],
    { stdio: 'inherit', env: { ...process.env, RELAY_SHOT_XVFB: '1' } },
  )
  if (r.error) {
    console.error('DISPLAY가 없고 xvfb-run도 없습니다. xvfb를 설치하거나 DISPLAY를 정해 주세요.')
    process.exit(1)
  }
  process.exit(r.status ?? 1)
}

function fail(message) {
  console.error(`${message}\n${USAGE}`)
  process.exit(1)
}

/** 인자를 읽는다. 상대 경로는 npm을 부른 폴더(INIT_CWD) 기준이다: npm run은 app/에서 돈다 */
function parse(argv) {
  const base = process.env['INIT_CWD'] ?? process.cwd()
  const o = { out: path.join(APP_DIR, 'test-results', 'shot.png'), project: false }
  const value = (i, flag) => {
    const v = argv[i]
    if (v === undefined || v.startsWith('--')) fail(`${flag} 뒤에 파일이 없습니다.`)
    return path.resolve(base, v)
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--project') o.project = true
    else if (a === '--steps') o.steps = value(++i, a)
    else if (a === '--scenario') o.scenario = value(++i, a)
    else if (a.startsWith('-')) fail(`모르는 옵션: ${a}`)
    else o.out = path.resolve(base, a)
  }
  if (!/\.(png|jpe?g)$/i.test(o.out)) fail(`찍을 파일은 .png나 .jpg여야 합니다: ${o.out}`)
  return o
}

const opts = parse(process.argv.slice(2))
if (!fs.existsSync(path.join(APP_DIR, 'out', 'main'))) {
  console.error(
    'out/에 빌드가 없습니다. npm run build를 먼저 돌려 주세요(npm run shot은 함께 돌립니다).',
  )
  process.exit(1)
}

const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-shot-')))
const cleanup = () =>
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
process.once('SIGINT', () => {
  cleanup()
  process.exit(130)
})
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

let app
try {
  const { repo } = makeRepo(root, 'sample', REPO_FILES)
  app = await electron.launch({
    args: [APP_DIR, '--no-sandbox', `--user-data-dir=${path.join(root, 'userdata')}`],
    env,
  })
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
  await app?.close().catch(() => {})
  cleanup()
}
