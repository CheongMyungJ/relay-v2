// relay MCP (D516~D523): 앱을 띄우고 브리지(설치본은 resources/의 relay-mcp.mjs)를 Electron의 Node 모드로 띄워 도구로 Work를
// 맡긴다. 사이드바의 MCP 표시와 패널의 호출자 띠, 질문창이 사람에게 뜨지 않는 것, [직접 맡기] 뒤 사람이 질문창으로 답하는
// 것을 화면으로 본다. 모델 호출은 하지 않는다
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import electronPath from 'electron'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { makeRepo } from '../support/repo'
import { handoff, intentDraft, REPO_FILES, REQUEST } from '../support/scenarios'

const appDir = path.resolve(__dirname, '../..')
const win32 = process.platform === 'win32'
let app: ElectronApplication | undefined
let bridge: ChildProcess | undefined
let root: string

// eslint-disable-next-line no-empty-pattern
test.afterEach(async ({}, info) => {
  if (root && info.status !== info.expectedStatus) {
    const record = path.join(root, 'record/fake-claude.jsonl')
    if (fs.existsSync(record))
      await info.attach('fake-claude-record', { path: record, contentType: 'text/plain' })
  }
  bridge?.kill()
  await app?.close()
  if (root) fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

/** 브리지를 띄우고 도구를 부른다. 결과는 JSON 글이다 */
function startBridge(env: Record<string, string>) {
  const exe = process.env['RELAY_APP_EXE']
  const bin = exe ?? (electronPath as unknown as string)
  const script = exe
    ? path.join(path.dirname(exe), 'resources', 'relay-mcp.mjs')
    : path.join(appDir, 'scripts/relay-mcp.mjs')
  const child = spawn(bin, [script], {
    env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'pipe',
  })
  child.stderr.on('data', (d: Buffer) => process.stderr.write(d))
  bridge = child
  const pending = new Map<number, (m: Record<string, unknown>) => void>()
  readline.createInterface({ input: child.stdout }).on('line', (line) => {
    const msg = JSON.parse(line) as Record<string, unknown>
    pending.get(msg['id'] as number)?.(msg)
  })
  let id = 0
  const rpc = (method: string, params: unknown = {}) => {
    const n = ++id
    const p = new Promise<Record<string, unknown>>((resolve) => pending.set(n, resolve))
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: n, method, params })}\n`)
    return p
  }
  const call = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
    const m = await rpc('tools/call', { name, arguments: args })
    const r = m['result'] as { content: { text: string }[]; isError: boolean }
    const text = r.content[0]?.text ?? ''
    if (r.isError) throw new Error(`${name}: ${text}`)
    return JSON.parse(text) as T
  }
  return { rpc, call }
}

test('relay MCP 호출자가 맡긴 Work는 화면에 표시되고, [직접 맡기] 뒤 사람이 질문창으로 답한다', async () => {
  test.skip(
    !win32 && !process.env['DISPLAY'],
    'Electron GUI 스모크는 Windows 또는 DISPLAY가 필요합니다.',
  )
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-mcp-ui-')))
  const home = path.join(root, 'home')
  fs.mkdirSync(home)
  const { repo } = makeRepo(root, 'mcp-ui', REPO_FILES)
  const scenario = path.join(root, 'scenario.json')
  fs.writeFileSync(
    scenario,
    JSON.stringify({
      tasks: {
        'work-start': [
          { do: 'prompt' },
          { do: 'mcpAsk', question: '범위를 고르세요.' },
          { do: 'write', file: 'intent.draft.md', text: intentDraft() },
          { do: 'write', file: 'handoff.md', text: handoff() },
          { do: 'stop' },
          { do: 'wait' },
        ],
      },
    }),
  )
  const env = {
    ...process.env,
    RELAY_HOME: home,
    RELAY_UPDATE: 'off',
    CLAUDE_BIN: path.join(
      appDir,
      'test/support/fake-claude',
      win32 ? 'fake-claude.cmd' : 'fake-claude.mjs',
    ),
    FAKE_CLAUDE_SCENARIO: scenario,
    FAKE_CLAUDE_RECORD: path.join(root, 'record'),
  } as Record<string, string>
  const exe = process.env['RELAY_APP_EXE']
  app = await electron.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: exe ? [] : [appDir],
    env,
  })
  // 끝낼 때 살아 있는 세션의 종료 확인 창에 [종료]로 답한다
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = (() =>
      Promise.resolve({ response: 0, checkboxChecked: false })) as typeof dialog.showMessageBox
  })
  const window = await app.firstWindow()
  await expect(window.locator('.sidebar')).toBeVisible()
  await expect
    .poll(() => fs.existsSync(path.join(home, 'mcp.json')), { timeout: 30_000 })
    .toBe(true)

  const { rpc, call } = startBridge(env)
  await rpc('initialize', { protocolVersion: '2024-11-05' })
  const tools = (await rpc('tools/list'))['result'] as { tools: { name: string }[] }
  expect(tools.tools.map((t) => t.name)).toContain('start_work')
  const registered = await call<{ project: string }>('register_project', {
    path: repo,
    default_branch: 'main',
  })
  const started = await call<{ work: string }>('start_work', {
    project: registered.project,
    type: 'bugfix',
    request: REQUEST,
  })

  // 사이드바의 MCP 표시와 패널의 호출자 띠. 질문은 호출자에게 가므로 사람에게 질문창이 뜨지 않는다
  await expect(window.locator('.caller-tag')).toBeVisible({ timeout: 30_000 })
  await window.locator('.work-item').first().click()
  const band = window.getByRole('region', { name: 'MCP 호출자' })
  await expect(band).toContainText('MCP 호출자가 진행하는 Work')
  await expect
    .poll(async () => (await call<{ state: string }>('get_work', { work: started.work })).state, {
      timeout: 60_000,
    })
    .toBe('question')
  await expect(window.getByRole('dialog', { name: '에이전트 질문' })).toHaveCount(0)

  // [직접 맡기]: 띠가 사라지고 사람이 질문창으로 답한다
  await band.getByRole('button', { name: '직접 맡기' }).click()
  await expect(band).toHaveCount(0)
  await expect(window.locator('.caller-tag')).toHaveCount(0)
  const question = window.getByRole('dialog', { name: '에이전트 질문', exact: true })
  await expect(question).toBeVisible({ timeout: 30_000 })
  await question.getByRole('radio', { name: /작은 범위/ }).check()
  await question.getByRole('button', { name: '답변 보내기' }).click()
  await expect(question).not.toBeVisible()
  await expect(window.getByRole('button', { name: '의도 승인', exact: true })).toBeEnabled({
    timeout: 30_000,
  })
  const work = await call<{ driver: string; next: string[] }>('get_work', { work: started.work })
  expect(work).toMatchObject({ driver: 'human', next: ['wait'] })
})
