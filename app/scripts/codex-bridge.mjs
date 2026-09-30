// 설치본은 Electron의 Node 실행 모드를 사용한다. 별도의 Node 설치나 외부 패키지가 필요하지 않다.
import http from 'node:http'
import fs from 'node:fs'
import readline from 'node:readline'

const MAX_BODY = 8 * 1024 * 1024
const QUESTION_TIMEOUT = 24 * 60 * 60 * 1000
const controllers = new Map()

function request(kind, body, signal, timeout = 30_000) {
  const port = Number(process.env.RELAY_HOOK_PORT)
  const task = process.env.RELAY_HOOK_TASK
  const token = process.env.RELAY_HOOK_TOKEN
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !task || !token)
    throw new Error('relay 연결 정보가 없습니다.')
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: `/${kind}/${encodeURIComponent(task)}${kind === 'hook' ? `/${encodeURIComponent(body.hook_event_name)}` : ''}`,
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
          if (res.statusCode !== 200)
            return reject(new Error(`relay 연결 실패 (${res.statusCode})`))
          try {
            resolve(raw.trim() ? JSON.parse(raw) : null)
          } catch {
            reject(new Error('relay 응답이 JSON이 아닙니다.'))
          }
        })
      },
    )
    req.setTimeout(timeout, () => req.destroy(new Error('relay 응답 제한 시간이 지났습니다.')))
    req.on('error', reject)
    req.end(JSON.stringify(body))
  })
}

const tool = {
  name: 'ask_human',
  description:
    '사람에게 1~4개 질문을 한 번에 묻고 앱 질문창의 실제 답을 기다립니다. 추천 선택지는 첫 번째에 (추천)를 붙이고 이유를 설명하세요. 취소는 답이나 동의가 아닙니다. 질문을 일반 텍스트로 끝내지 말고 이 도구를 사용하세요.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'header', 'question'],
          properties: {
            id: { type: 'string', minLength: 1, maxLength: 80 },
            header: { type: 'string', minLength: 1, maxLength: 80 },
            question: { type: 'string', minLength: 1, maxLength: 4000 },
            multiSelect: { type: 'boolean' },
            options: {
              type: 'array',
              minItems: 2,
              maxItems: 8,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['label', 'description'],
                properties: {
                  label: { type: 'string', minLength: 1, maxLength: 200 },
                  description: { type: 'string', minLength: 1, maxLength: 2000 },
                },
              },
            },
          },
        },
      },
    },
  },
}

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`)
const textResult = (value, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
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
      case 'initialize': {
        const file = process.env.RELAY_CODEX_SKILL
        const instructions = file
          ? fs.readFileSync(file, 'utf8')
          : '정리 세션입니다. push/PR 및 앱 소유 파일 수정은 앱이 합니다. 질문은 ask_human을 사용하세요.'
        return respond({
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'relay', version: '1.0.0' },
          instructions,
        })
      }
      case 'ping':
        return respond({})
      case 'tools/list':
        return respond({ tools: [tool] })
      case 'tools/call': {
        if (message.params?.name !== 'ask_human') throw new Error('지원하지 않는 relay 도구입니다.')
        const controller = new AbortController()
        controllers.set(message.id, controller)
        try {
          const result = await request(
            'question',
            message.params.arguments ?? {},
            controller.signal,
            QUESTION_TIMEOUT,
          )
          return respond(textResult(result, result?.cancelled === true))
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
    if (message.method === 'tools/call')
      return respond(textResult({ cancelled: true, reason: error.message }, true))
    send({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: error.message } })
  }
}

if (process.argv[2] === 'hook') {
  let raw = ''
  for await (const chunk of process.stdin) {
    raw += chunk
    if (Buffer.byteLength(raw) > MAX_BODY) throw new Error('훅 본문이 너무 큽니다.')
  }
  const body = JSON.parse(raw)
  try {
    const reply = await request(
      'hook',
      body,
      undefined,
      body.hook_event_name === 'SessionEnd' || body.hook_event_name === 'Interrupt' ? 2000 : 25_000,
    )
    if (reply) process.stdout.write(JSON.stringify(reply))
  } catch (error) {
    // 보호 훅의 연결 실패는 명시적 거절로 돌려준다. 질문에 기본값을 만들지 않는다.
    const reason = `relay: ${error.message}`
    if (body.hook_event_name === 'PreToolUse')
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: reason,
          },
        }),
      )
    else {
      process.stderr.write(`${reason}\n`)
      process.exitCode = 1
    }
  }
} else if (process.argv[2] === 'mcp') {
  const lines = readline.createInterface({ input: process.stdin })
  lines.on('line', (line) => {
    try {
      void rpc(JSON.parse(line))
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
    }
  })
  lines.on('close', () => {
    for (const c of controllers.values()) c.abort()
  })
} else {
  process.stderr.write('사용법: codex-bridge.mjs hook|mcp\n')
  process.exitCode = 1
}
