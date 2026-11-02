// Codex의 훅과 relay MCP(ask_human), relay MCP로 묻는 Claude task(D521)의 ask_human 브리지.
// 자율 Work의 자율 진행(D544)이면 자식 Work 도구도 내놓는다(RELAY_CHILD_TOOLS). 도구 이름은 app/src/main/children.ts와 같다.
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

const work = {
  type: 'string',
  minLength: 1,
  description: '자식 Work의 key (spawn_child·list_children의 work)',
}

/** 자식 Work 도구 (D544~D547) */
const childTools = [
  {
    name: 'spawn_child',
    description:
      '이 Work의 조각 하나를 자식 세션에 맡깁니다. 자식은 자기 worktree와 브랜치에서 brief(당신이 쓴 지시)대로만 일합니다. relay는 절차를 더하지 않으니 목표, 맡는 파일, 하지 말 것, 끝났다고 볼 조건, 시험을 brief에 쓰세요. 기준은 부모 브랜치의 지금 커밋이니 먼저 커밋하세요. 자식과는 ListAgents(결과의 tree 폴더)와 SendMessage로 직접 말하고, 자식은 끝나면 SendMessage로 알립니다. 기다릴 때는 턴을 끝내세요: 자식의 메시지가 다음 턴을 엽니다.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'brief'],
      properties: {
        title: {
          type: 'string',
          minLength: 1,
          maxLength: 120,
          description: '자식 Work의 제목 한 줄',
        },
        brief: {
          type: 'string',
          minLength: 1,
          description:
            '자식에게 줄 지시(자유 글): 할 일, 맡는 파일, 하지 말 것, 끝났다고 볼 조건, 돌릴 시험',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: '이 자식이 맡는 파일이나 폴더',
        },
      },
    },
  },
  {
    name: 'list_children',
    description: '이 Work의 자식 Work와 지금 상태, 브랜치, state_key를 봅니다.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'answer_child',
    description:
      '자식의 질문에 답합니다. 사람만 아는 것이면 직접 답하지 말고 먼저 사람에게 물은 뒤 그 답을 전하세요.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['work', 'question_id'],
      properties: {
        work,
        question_id: { type: 'string', minLength: 1 },
        answers: {
          type: 'object',
          description: '질문 id → 고른 선택지 label(여럿이면 목록)이나 글',
        },
        cancel: { type: 'boolean' },
      },
    },
  },
  {
    name: 'decide_child',
    description:
      '끝났다고 말한 자식을 정합니다(자식 세션이 턴을 끝낸 뒤). merge: 전달 없이 완료하고 이 worktree에서 그 브랜치를 git merge합니다. pr: relay가 독립 리뷰를 돌리고 차단 지적이 없으면 pr_title·pr_body로 따로 PR을 만듭니다(부모 변경 위에서 시작한 자식은 안 됨). revise: message로 고칠 점을 주고 다시 엽니다. discard: 포기합니다.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['work', 'decision'],
      properties: {
        work,
        decision: { type: 'string', enum: ['merge', 'pr', 'revise', 'discard'] },
        message: { type: 'string' },
        pr_title: { type: 'string' },
        pr_body: { type: 'string' },
      },
    },
  },
]
const childNames = childTools.map((t) => t.name)
const withChildren = process.env.RELAY_CHILD_TOOLS === '1'
// 사람이 진행하는 자율 진행은 터미널에서 묻는다: ask_human을 내놓지 않는다 (D544)
const withAsk = process.env.RELAY_NO_ASK !== '1'

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
        // Codex task는 스킬 본문을, 정리 세션은 안내를 준다. Claude task(D521)의 절차는 시스템 프롬프트에 있다
        const file = process.env.RELAY_CODEX_SKILL
        const instructions = file
          ? fs.readFileSync(file, 'utf8')
          : process.env.RELAY_HOOK_TASK === 'cleanup'
            ? '정리 세션입니다. push/PR 및 앱 소유 파일 수정은 앱이 합니다. 질문은 ask_human을 사용하세요.'
            : withChildren
              ? 'relay 자율 진행의 도구입니다. 맡길 조각은 spawn_child로 자식 세션에 brief와 함께 맡기세요. 자식과는 ListAgents와 SendMessage로 직접 말하고, 기다릴 때는 턴을 끝내면 자식의 메시지가 다음 턴을 엽니다. 끝났다고 말한 자식은 decide_child로 정하세요.'
              : 'relay task의 질문 도구입니다. 사람에게 물을 것은 ask_human으로 묻고 답을 기다리세요.'
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
        return respond({ tools: [...(withAsk ? [tool] : []), ...(withChildren ? childTools : [])] })
      case 'tools/call': {
        if (withChildren && childNames.includes(message.params?.name)) {
          const controller = new AbortController()
          controllers.set(message.id, controller)
          try {
            const result = await request(
              'child',
              { tool: message.params.name, args: message.params.arguments ?? {} },
              controller.signal,
              QUESTION_TIMEOUT,
            )
            return respond(
              textResult(
                result?.ok === false ? { error: result.error } : (result?.result ?? result),
                result?.ok === false,
              ),
            )
          } finally {
            controllers.delete(message.id)
          }
        }
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
  process.stdin.setEncoding('utf8')
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
      body.hook_event_name === 'SessionEnd' || body.hook_event_name === 'Interrupt'
        ? 2000
        : // Stop은 verify의 지식 검토 호출(D300, 90초까지)을 기다린다. Claude의 Stop 훅(180초)과 맞춘다
          body.hook_event_name === 'Stop'
          ? 170_000
          : 25_000,
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
