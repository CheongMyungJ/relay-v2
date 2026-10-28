// [어댑터] relay MCP (D516, D517, D520): 훅 서버의 /control, 연결 정보 파일, stdio 브리지(scripts/relay-mcp.mjs)를 실제
// 프로세스와 HTTP로 본다. 브리지는 앱이 없어도 도구 목록에 답하고, 호출은 연결 정보의 포트와 토큰으로 넘기며, 앱이 없으면
// 띄운다(RELAY_APP_EXE로 가짜 앱을 준다)
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { afterEach, describe, expect, it } from 'vitest'
import { HookServer, type ControlRequest } from '../../src/adapters/hooks'
import {
  mcpConnectionFile,
  removeMcpConnection,
  writeMcpConnection,
} from '../../src/adapters/store'
import { MCP_TOOLS } from '../../src/core/mcp'

const BRIDGE = path.resolve(__dirname, '../../scripts/relay-mcp.mjs')

let server: HookServer | undefined
let bridge: ChildProcess | undefined
const dirs: string[] = []

afterEach(async () => {
  bridge?.kill()
  bridge = undefined
  await server?.close()
  server = undefined
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-mcp-'))
  dirs.push(d)
  return d
}

async function control(port: number, token: string | null, body: unknown, session?: string) {
  const res = await fetch(`http://127.0.0.1:${port}/control`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(session ? { 'X-Relay-Session': session } : {}),
    },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: (await res.text()) || null }
}

/** 브리지를 띄우고 JSON-RPC로 부른다 */
function start(env: Record<string, string>) {
  const child = spawn(process.execPath, [BRIDGE], {
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  bridge = child
  const pending = new Map<number, (m: Record<string, unknown>) => void>()
  readline.createInterface({ input: child.stdout }).on('line', (line) => {
    const msg = JSON.parse(line) as Record<string, unknown>
    pending.get(msg['id'] as number)?.(msg)
  })
  let id = 0
  return (method: string, params: unknown = {}) => {
    const n = ++id
    const p = new Promise<Record<string, unknown>>((resolve) => pending.set(n, resolve))
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: n, method, params })}\n`)
    return p
  }
}

const resultText = (m: Record<string, unknown>) => {
  const r = m['result'] as { content: { text: string }[]; isError: boolean }
  return { text: r.content[0]?.text ?? '', isError: r.isError }
}

describe('[어댑터] 훅 서버의 /control (D516, D520)', () => {
  it('토큰이 맞는 호출만 넘기고, 브리지를 띄운 앱 세션의 토큰이면 inApp이다', async () => {
    server = new HookServer()
    const port = await server.listen()
    const seen: ControlRequest[] = []
    server.setControl('ctl', async (req) => {
      seen.push(req)
      return { ok: true, result: req.body['tool'] ?? null }
    })
    server.register('task-tok', 't-01', async () => null)
    expect((await control(port, null, { tool: 'x' })).status).toBe(403)
    expect((await control(port, 'task-tok', { tool: 'x' })).status).toBe(403)
    expect(await control(port, 'ctl', { tool: 'list_works' })).toEqual({
      status: 200,
      body: JSON.stringify({ ok: true, result: 'list_works' }),
    })
    await control(port, 'ctl', { tool: 'a' }, 'task-tok')
    await control(port, 'ctl', { tool: 'b' }, 'unknown')
    expect(seen.map((s) => s.inApp)).toEqual([false, true, false])
  })

  it('처리가 던지면 500과 error이고, 그만 받으면 403이다', async () => {
    server = new HookServer()
    const port = await server.listen()
    const stop = server.setControl('ctl', async () => {
      throw new Error('터짐')
    })
    expect(await control(port, 'ctl', {})).toEqual({
      status: 500,
      body: JSON.stringify({ error: '터짐' }),
    })
    stop()
    expect((await control(port, 'ctl', {})).status).toBe(403)
  })

  it('호출한 쪽이 끊으면 처리의 signal이 끊긴다 (wait를 그만둔다)', async () => {
    server = new HookServer()
    const port = await server.listen()
    let aborted!: () => void
    const done = new Promise<void>((r) => (aborted = r))
    server.setControl('ctl', (_req, signal) => {
      signal.addEventListener('abort', () => aborted())
      return new Promise(() => {})
    })
    const c = new AbortController()
    const req = fetch(`http://127.0.0.1:${port}/control`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ctl' },
      body: '{}',
      signal: c.signal,
    }).catch(() => null)
    await new Promise((r) => setTimeout(r, 100))
    c.abort()
    await req
    await done
  })
})

describe('[어댑터] 연결 정보 mcp.json (D517)', () => {
  it('본인만 읽게 쓰고, 이 앱이 쓴 것만 지운다', async () => {
    const home = tmp()
    await writeMcpConnection(home, { port: 1, token: 't', pid: 42 })
    const file = mcpConnectionFile(home)
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ port: 1, token: 't', pid: 42 })
    if (process.platform !== 'win32') expect(fs.statSync(file).mode & 0o777).toBe(0o600)
    await removeMcpConnection(home, 7)
    expect(fs.existsSync(file)).toBe(true)
    await removeMcpConnection(home, 42)
    expect(fs.existsSync(file)).toBe(false)
    await removeMcpConnection(home, 42)
  })
})

describe('[어댑터] stdio 브리지 relay-mcp.mjs (D516, D518)', () => {
  it('앱 없이 initialize와 tools/list에 답하고, 도구 정의는 앱과 같은 파일이다', async () => {
    const rpc = start({ RELAY_HOME: tmp() })
    const init = await rpc('initialize', { protocolVersion: '2025-06-18' })
    expect(init['result']).toMatchObject({
      protocolVersion: '2025-06-18',
      serverInfo: { name: 'relay' },
      instructions: expect.stringContaining('start_work'),
    })
    const list = await rpc('tools/list')
    expect((list['result'] as { tools: unknown }).tools).toEqual(MCP_TOOLS)
  })

  it('tools/call을 연결 정보의 앱으로 넘기고 결과를 글로, 실패를 isError로 돌려준다. 앱 세션의 토큰을 함께 보낸다', async () => {
    const home = tmp()
    server = new HookServer()
    const port = await server.listen()
    const seen: ControlRequest[] = []
    server.register('session-tok', 'session', async () => null)
    server.setControl('ctl', async (req) => {
      seen.push(req)
      return req.body['tool'] === 'bad'
        ? { ok: false, error: '안 됨' }
        : { ok: true, result: { got: req.body['args'] } }
    })
    await writeMcpConnection(home, { port, token: 'ctl', pid: process.pid })
    const rpc = start({ RELAY_HOME: home, RELAY_HOOK_TOKEN: 'session-tok' })
    const ok = await rpc('tools/call', { name: 'get_work', arguments: { work: 'p/w' } })
    expect(resultText(ok)).toEqual({
      text: JSON.stringify({ got: { work: 'p/w' } }),
      isError: false,
    })
    expect(resultText(await rpc('tools/call', { name: 'bad', arguments: {} }))).toEqual({
      text: '안 됨',
      isError: true,
    })
    expect(seen.map((s) => s.inApp)).toEqual([true, true])
  })

  it('앱이 없으면 RELAY_APP_EXE로 띄우고 새 연결 정보가 생기면 잇는다', async () => {
    const home = tmp()
    server = new HookServer()
    const port = await server.listen()
    server.setControl('fresh', async (req) => ({ ok: true, result: req.body['tool'] ?? 'ping' }))
    // 꺼진 앱이 남긴 연결 정보: 닿지 않는 포트다
    await writeMcpConnection(home, { port: 1, token: 'stale', pid: 1 })
    // 가짜 앱: 띄워지면 새 연결 정보를 쓴다
    const fake = path.join(tmp(), 'fake-app.mjs')
    fs.writeFileSync(
      fake,
      `#!${process.execPath}\nimport fs from 'node:fs'\nfs.writeFileSync(${JSON.stringify(
        mcpConnectionFile(home),
      )}, JSON.stringify({ port: ${port}, token: 'fresh', pid: process.pid }))\n`,
    )
    fs.chmodSync(fake, 0o755)
    const launcher =
      process.platform === 'win32'
        ? (() => {
            const cmd = path.join(path.dirname(fake), 'fake-app.cmd')
            fs.writeFileSync(cmd, `@"${process.execPath}" "${fake}"\r\n`)
            return cmd
          })()
        : fake
    const rpc = start({ RELAY_HOME: home, RELAY_APP_EXE: launcher, RELAY_MCP_LAUNCH_MS: '20000' })
    const r = await rpc('tools/call', { name: 'list_works', arguments: {} })
    // 글인 결과는 그대로 준다
    expect(resultText(r)).toEqual({ text: 'list_works', isError: false })
  })

  it('앱이 없고 띄울 수 없으면(Node로 돈 브리지) 앱을 켜라고 돌려준다', async () => {
    const rpc = start({ RELAY_HOME: tmp() })
    const r = await rpc('tools/call', { name: 'list_works', arguments: {} })
    expect(resultText(r)).toEqual({
      text: expect.stringContaining('relay 앱을 켠 뒤 다시 부르세요'),
      isError: true,
    })
  })
})
