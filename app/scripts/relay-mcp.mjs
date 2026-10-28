// relay MCP 브리지 (D516, D517). 바깥 MCP 클라이언트(Claude Code 등)가 stdio 서버로 띄운다. 도구 호출을 떠 있는 relay
// 앱의 훅 서버(/control)로 넘기고, 앱이 없으면 띄운 뒤 연결 정보(<RELAY_HOME>/mcp.json)가 생길 때까지 기다린다.
// 설치본은 Electron의 Node 실행 모드(ELECTRON_RUN_AS_NODE=1 <relay 실행 파일> <이 파일>)로 돈다. 별도 Node가 필요 없다.
// tools/list는 앱 없이 답한다: 도구 정의 파일(relay-mcp-tools.json, 개발 중에는 src/shared/mcp-tools.json)을 읽는다.
// 앱 안의 세션(task, 곁·기본 세션)에서 떴으면 그 세션의 훅 토큰을 X-Relay-Session으로 함께 보낸다: 앱은 조회만 받는다 (D520)
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MAX_BODY = 32 * 1024 * 1024
/** 앱을 띄운 뒤 연결 정보를 기다리는 ms (D516 기본값). 시험이 줄인다 */
const LAUNCH_WAIT_MS = Number(process.env.RELAY_MCP_LAUNCH_MS) || 60_000
/** 도구 호출 하나의 상한. wait의 최대(600초, D525)보다 길다 */
const CALL_TIMEOUT_MS = 11 * 60 * 1000
const controllers = new Map()

const INSTRUCTIONS = [
  'relay는 Claude Code에게 일을 단계(의도 정리 → 작업 단계 → 마무리)로 나눠 맡기고, 단계가 끝날 때마다 결과를 보고 승인하는 앱입니다.',
  '흐름: list_projects(없으면 register_project) → list_types → start_work → wait를 되풀이하고 state에 따라 answer, approve, revise를 부릅니다. 마지막 단계에서 approve(전달 없이 완료)나 deliver(push, PR 생성)로 끝냅니다.',
  '승인하기 전에 get_work의 review(요약, 결정, 가정, 위험, 강조, 산출물 경로)와 변경을 확인하세요. 고칠 점은 승인 대신 revise로 보냅니다.',
  '사용자가 정해야 할 결정(question)은 사용자에게 물어 그 답을 answer로 전하세요. 사용자가 맡겼으면 "알아서 해"라고 답할 수 있습니다.',
  'push, PR 생성, PR 대응 단계의 승인(답글 게시)은 되돌릴 수 없습니다. 머지는 사람이 relay 앱이나 GitHub에서 합니다.',
].join('\n')

const relayHome = () =>
  path.resolve(process.env.RELAY_HOME ? process.env.RELAY_HOME : path.join(os.homedir(), '.relay'))

function readTools() {
  for (const file of [
    path.join(HERE, 'relay-mcp-tools.json'),
    path.resolve(HERE, '../src/shared/mcp-tools.json'),
  ]) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      // 다음 자리를 본다
    }
  }
  throw new Error('relay MCP 도구 정의 파일을 찾을 수 없습니다. relay 설치를 확인하세요.')
}

/** 연결 정보 (D517). 없거나 읽지 못하면 null */
function connection() {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(relayHome(), 'mcp.json'), 'utf8'))
    return Number.isInteger(c.port) && typeof c.token === 'string' ? c : null
  } catch {
    return null
  }
}

/** 앱에 닿지 못함: 꺼졌거나 다시 켜져 토큰이 바뀌었다 */
class Unreachable extends Error {}

function post(conn, body, signal, timeout = CALL_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const session = process.env.RELAY_HOOK_TOKEN
    const req = http.request(
      {
        host: '127.0.0.1',
        port: conn.port,
        path: '/control',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${conn.token}`,
          'Content-Type': 'application/json',
          ...(session ? { 'X-Relay-Session': session } : {}),
        },
        signal,
      },
      (res) => {
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          raw += chunk
          if (Buffer.byteLength(raw) > MAX_BODY) req.destroy(new Error('relay 응답이 너무 큽니다.'))
        })
        res.on('error', reject)
        res.on('end', () => {
          if (res.statusCode === 403 || res.statusCode === 404)
            return reject(new Unreachable(`relay 연결 거절 (${res.statusCode})`))
          let data
          try {
            data = raw.trim() ? JSON.parse(raw) : null
          } catch {
            return reject(new Error('relay 응답이 JSON이 아닙니다.'))
          }
          if (res.statusCode !== 200)
            return reject(new Error(data?.error ?? `relay 처리 실패 (${res.statusCode})`))
          resolve(data)
        })
      },
    )
    req.setTimeout(timeout, () => req.destroy(new Error('relay 응답 제한 시간이 지났습니다.')))
    req.on('error', (e) =>
      reject(signal?.aborted ? e : e.code === 'ECONNREFUSED' ? new Unreachable(e.message) : e),
    )
    req.end(JSON.stringify(body))
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * relay 앱을 띄우는 명령. RELAY_APP_EXE가 있으면 그것, 설치본(옆에 app.asar)이면 이 실행 파일, 개발 중이면 Electron에 앱
 * 폴더(빌드한 out/)를 준다. Node로 돌면 띄울 수 없다
 */
function launchCommand() {
  if (process.env.RELAY_APP_EXE) return { cmd: process.env.RELAY_APP_EXE, args: [] }
  if (!process.versions.electron) return null
  if (fs.existsSync(path.join(HERE, 'app.asar'))) return { cmd: process.execPath, args: [] }
  return { cmd: process.execPath, args: [path.resolve(HERE, '..')] }
}

let launching = null

/** 앱을 띄우고 연결 정보가 생겨 닿을 때까지 기다린다. 동시에 부른 호출은 한 번만 띄운다 */
function launch(stale) {
  launching ??= (async () => {
    const command = launchCommand()
    if (!command) throw new Error('relay 앱이 꺼져 있습니다. relay 앱을 켠 뒤 다시 부르세요.')
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    delete env.RELAY_HOOK_TOKEN
    const child = spawn(command.cmd, command.args, { detached: true, stdio: 'ignore', env })
    child.on('error', () => {})
    child.unref()
    const until = Date.now() + LAUNCH_WAIT_MS
    while (Date.now() < until) {
      await sleep(500)
      const conn = connection()
      if (!conn || (stale && conn.token === stale.token)) continue
      try {
        await post(conn, {}, undefined, 5000)
        return conn
      } catch {
        // 아직 준비 중이다
      }
    }
    throw new Error(
      `relay 앱을 띄웠지만 ${Math.round(LAUNCH_WAIT_MS / 1000)}초 안에 연결하지 못했습니다. relay 앱을 켠 뒤 다시 부르세요.`,
    )
  })().finally(() => {
    launching = null
  })
  return launching
}

/** 앱에 보낸다. 닿지 못하면 연결 정보를 다시 읽고, 그래도 안 되면 앱을 띄운다 */
async function control(body, signal) {
  const first = connection()
  if (first) {
    try {
      return await post(first, body, signal)
    } catch (e) {
      if (!(e instanceof Unreachable)) throw e
    }
    const again = connection()
    if (again && again.token !== first.token) {
      try {
        return await post(again, body, signal)
      } catch (e) {
        if (!(e instanceof Unreachable)) throw e
      }
    }
  }
  const conn = await launch(first)
  return post(conn, body, signal)
}

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`)
const textResult = (value, isError = false) => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
  isError,
})

async function rpc(message) {
  if (message.method === 'notifications/cancelled') {
    controllers.get(message.params?.requestId)?.abort()
    return
  }
  if (message.id === undefined) return
  const respond = (result) => send({ jsonrpc: '2.0', id: message.id, result })
  try {
    switch (message.method) {
      case 'initialize':
        return respond({
          protocolVersion: message.params?.protocolVersion ?? '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'relay', version: '1.0.0' },
          instructions: INSTRUCTIONS,
        })
      case 'ping':
        return respond({})
      case 'tools/list':
        return respond({ tools: readTools() })
      case 'tools/call': {
        const controller = new AbortController()
        controllers.set(message.id, controller)
        try {
          const r = await control(
            { tool: message.params?.name, args: message.params?.arguments ?? {} },
            controller.signal,
          )
          return respond(
            r?.ok ? textResult(r.result) : textResult(r?.error ?? 'relay 처리 실패', true),
          )
        } finally {
          controllers.delete(message.id)
        }
      }
      default:
        return send({
          jsonrpc: '2.0',
          id: message.id,
          error: { code: -32601, message: 'Method not found' },
        })
    }
  } catch (error) {
    if (message.method === 'tools/call') return respond(textResult(error.message, true))
    send({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: error.message } })
  }
}

const lines = readline.createInterface({ input: process.stdin })
lines.on('line', (line) => {
  let message
  try {
    message = JSON.parse(line)
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
    return
  }
  void rpc(message)
})
lines.on('close', () => {
  for (const c of controllers.values()) c.abort()
})
