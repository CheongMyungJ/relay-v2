#!/usr/bin/env node
// 실제 Codex 옵션을 받아 실제 relay 브리지를 실행하는 PTY 시험용 CLI. 모델 요청은 하지 않는다.
import { spawn, execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const argv = process.argv.slice(2)
const env = process.env
if (argv[0] === '--version') {
  console.log('codex-cli 0.159.0 (가짜 Codex)')
  process.exit(0)
}
if (argv[0] === '--help') {
  console.log('--no-daemon --dangerously-bypass-approvals-and-sandbox')
  process.exit(0)
}
if (argv[0] === 'features') {
  console.log('hooks stable true')
  process.exit(0)
}
if (argv[0] === 'login') {
  process.exit(env.FAKE_CODEX_AUTH === 'fail' ? 1 : 0)
}

const config = new Map()
let resumeId = null
let resumePrompt = null
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '-c') {
    const v = argv[++i]
    const eq = v.indexOf('=')
    config.set(v.slice(0, eq), v.slice(eq + 1))
  } else if (argv[i] === 'resume') {
    resumeId = argv[++i]
    resumePrompt = argv[i + 1] ?? null
  }
}
const field = (table, key) => {
  const literal = new RegExp(`"${key}"\\s*=\\s*("(?:\\\\.|[^"\\\\])*"|\\[[^\\]]*\\])`).exec(
    table,
  )?.[1]
  return literal ? JSON.parse(literal) : undefined
}
const mcpConfig = config.get('mcp_servers.relay') ?? ''
const executable = field(mcpConfig, 'command')
const mcpArgs = field(mcpConfig, 'args')
const skill = field(mcpConfig, 'RELAY_CODEX_SKILL')
const recordDir = env.FAKE_CODEX_RECORD
const record = (entry) => {
  if (recordDir) {
    fs.mkdirSync(recordDir, { recursive: true })
    fs.appendFileSync(
      path.join(recordDir, 'fake-codex.jsonl'),
      `${JSON.stringify({ pid: process.pid, ...entry })}\n`,
    )
  }
}
let sessionId = resumeId ?? randomUUID()
const sessionFile = () => path.join(recordDir, 'codex-sessions', `${sessionId}.json`)
let context
if (resumeId) {
  if (!fs.existsSync(sessionFile())) {
    console.error('No conversation found')
    process.exit(1)
  }
  context = JSON.parse(fs.readFileSync(sessionFile(), 'utf8'))
} else {
  const taskDir = skill ? path.resolve(path.dirname(skill), '../../..') : process.cwd()
  context = {
    taskDir,
    skill: skill ? path.basename(path.dirname(skill)).replace(/^relay-/, '') : null,
  }
}
const save = () => {
  fs.mkdirSync(path.dirname(sessionFile()), { recursive: true })
  fs.writeFileSync(sessionFile(), JSON.stringify(context))
}
save()
record({ type: 'start', args: argv, sessionId, context })
console.log(`FAKE-CODEX READY PID ${process.pid}`)
let enters = 0
const enterWaiters = []
if (process.stdin.isTTY) process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.on('data', (data) => {
  enters += (data.toString('utf8').match(/[\r\n]/g) ?? []).length
  while (enters > 0 && enterWaiters.length > 0) {
    enters--
    enterWaiters.shift()()
  }
})
const waitEnter = () => {
  if (enters > 0) {
    enters--
    return Promise.resolve()
  }
  return new Promise((resolve) => enterWaiters.push(resolve))
}

async function hook(event, extra = {}) {
  const body = { hook_event_name: event, session_id: sessionId, cwd: process.cwd(), ...extra }
  const table = config.get(`hooks.${event}`)
  if (!table) return null
  const command = field(table, process.platform === 'win32' ? 'commandWindows' : 'command')
  const child =
    process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', command], { env, stdio: ['pipe', 'pipe', 'pipe'] })
      : spawn('/bin/sh', ['-c', command], { env, stdio: ['pipe', 'pipe', 'pipe'] })
  let raw = '',
    error = ''
  child.stdout.on('data', (s) => {
    raw += s
  })
  child.stderr.on('data', (s) => {
    error += s
  })
  child.stdin.end(JSON.stringify(body))
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', resolve)
  })
  const reply = raw.trim() ? JSON.parse(raw) : null
  record({ type: 'hook', event, body, code, response: reply, error })
  return reply
}

const mcp = spawn(executable, mcpArgs, {
  env: { ...env, ELECTRON_RUN_AS_NODE: '1', ...(skill ? { RELAY_CODEX_SKILL: skill } : {}) },
  stdio: ['pipe', 'pipe', 'pipe'],
})
let rpcId = 0
const pending = new Map()
readline.createInterface({ input: mcp.stdout }).on('line', (line) => {
  const msg = JSON.parse(line)
  pending.get(msg.id)?.(msg)
  pending.delete(msg.id)
})
mcp.stderr.on('data', (s) => console.error(String(s)))
function rpc(method, params) {
  const id = ++rpcId
  const promise = new Promise((resolve) => pending.set(id, resolve))
  mcp.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
  return promise
}
await rpc('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'fake-codex', version: '1' },
})
await hook('SessionStart', { source: resumeId ? 'resume' : 'startup' })
const scenario = JSON.parse(fs.readFileSync(env.FAKE_CODEX_SCENARIO, 'utf8'))
const fill = (s) => String(s).replaceAll('{taskDir}', context.taskDir)
const filled = (value) =>
  typeof value === 'string'
    ? fill(value)
    : Array.isArray(value)
      ? value.map(filled)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, filled(v)]))
        : value
async function steps(list) {
  for (const step of list) {
    console.log(`[가짜 codex] ${step.do}`)
    if (step.do === 'prompt') {
      await hook('UserPromptSubmit', {
        prompt: resumePrompt ?? '사람 요청',
        permission_mode: 'bypassPermissions',
      })
      resumePrompt = null
    } else if (step.do === 'ask') {
      const waiting = rpc('tools/call', {
        name: 'ask_human',
        arguments: {
          questions: step.questions ?? [
            {
              id: 'scope',
              header: '범위',
              question: '어느 범위를 적용할까요?',
              options: [
                { label: '작은 범위 (추천)', description: '변경을 줄입니다.' },
                { label: '전체', description: '전체를 바꿉니다.' },
              ],
            },
          ],
        },
      })
      if (step.afterEnter) {
        await waitEnter()
        await steps(step.afterEnter)
      }
      const message = await waiting
      record({ type: 'answer', result: message.result })
    } else if (step.do === 'write') {
      const p = path.join(context.taskDir, step.file)
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, fill(step.text))
    } else if (step.do === 'commit') {
      for (const [file, text] of Object.entries(step.files ?? {}))
        fs.writeFileSync(path.join(process.cwd(), file), text)
      execFileSync('git', ['add', '-A'])
      execFileSync('git', [
        '-c',
        'user.name=Fake Codex',
        '-c',
        'user.email=fake@example.invalid',
        'commit',
        '-m',
        step.message ?? 'fake codex',
      ])
    } else if (step.do === 'stop') {
      let active = false
      for (let i = 0; i < 10; i++) {
        const reply = await hook('Stop', { stop_hook_active: active })
        if (reply?.decision !== 'block') break
        await steps(step.onBlock ?? [])
        active = true
      }
    } else if (step.do === 'clear') {
      await hook('SessionEnd', { reason: 'other' })
      sessionId = randomUUID()
      save()
      await hook('SessionStart', { source: 'startup' })
    } else if (step.do === 'hook') await hook(step.event, filled(step.body))
    else if (step.do === 'exit') {
      await hook('SessionEnd', { reason: 'other' })
      mcp.kill()
      process.exit(0)
    } else if (step.do === 'wait') await new Promise(() => {})
    else throw new Error(`지원하지 않는 시험 단계: ${step.do}`)
  }
}
await steps(
  resumeId
    ? (scenario.resume?.[context.skill] ?? [])
    : context.skill
      ? (scenario.tasks?.[context.skill] ?? [])
      : (scenario.cleanup ?? []),
)
