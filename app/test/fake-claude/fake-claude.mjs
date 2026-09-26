#!/usr/bin/env node
// 가짜 claude (I25, docs/implementation.md 8.2). 실제와 같은 인자를 받아 PTY 안에서 돈다.
// - `--version`은 버전을 찍고(D105), `auth status`는 FAKE_CLAUDE_AUTH가 fail이면 종료 코드 1이다(D67).
// - FAKE_CLAUDE_SCENARIO가 있으면 첫 프롬프트(/relay-<스킬> 이 task의 컨텍스트: <경로>)의 스킬이나
//   context.md의 task id에 맞는 단계를 차례로 한다: 훅 신호 보내기, 산출물과 handoff 쓰기, worktree에
//   커밋하기, 질문 대기 흉내, Stop 보내고 되돌림을 받으면 고쳐 쓰기, 종료.
// - 훅은 --settings 파일의 URL과 머리글로 보낸다. 머리글의 $VAR는 allowedEnvVars에 있는 것만 푼다
//   (Claude Code 문서 hooks). 본문 필드는 S2에서 관찰한 모양이다.
// - FAKE_CLAUDE_RECORD 폴더가 있으면 실행 인자와 훅 응답을 fake-claude.jsonl에 남긴다.
// - --session-id로 시작한 세션은 FAKE_CLAUDE_RECORD/sessions/<id>.json에 task를 적어 두고,
//   --resume <id>로 다시 열면 그 task의 resume 시나리오를 한다. 적어 둔 것이 없으면 실제 claude처럼
//   "No conversation found with session ID"를 내고 종료 코드 1로 끝난다 (스파이크 S6).
// - clear 단계는 /clear를 흉내 낸다: SessionEnd(reason: clear)를 보내고 새 세션 id로 계속 돈다(D110).
//   새 세션은 다음 요청으로 대화가 생겨야 --resume으로 열 수 있다.
// - 시나리오가 없으면 M0처럼 출력만 내고 끝날 때까지 살아 있는다.
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const argv = process.argv.slice(2)
const env = process.env

if (argv[0] === '--version') {
  process.stdout.write(`${env.FAKE_CLAUDE_VERSION || '0.0.0 (가짜 Claude Code)'}\n`)
  process.exit(0)
}
if (argv[0] === 'auth' && argv[1] === 'status') {
  const ok = env.FAKE_CLAUDE_AUTH !== 'fail'
  process.stdout.write(`${JSON.stringify({ loggedIn: ok })}\n`)
  process.exit(ok ? 0 : 1)
}

const size = () => `${process.stdout.columns}x${process.stdout.rows}`
const out = (s) => process.stdout.write(`${s}\r\n`)

out('FAKE-CLAUDE READY')
out(`ARGS ${JSON.stringify(argv)}`)
out(`PID ${process.pid}`)
out(`SIZE ${size()}`)
out('한글 출력 확인')

// Windows에서 libuv는 stdin을 raw 모드로 읽고 있을 때만 콘솔 크기 변경을 알아챈다
// (libuv docs/src/signal.rst). 실제 claude도 stdin을 raw 모드로 읽는다.
// 질문 대기 흉내는 Enter를 기다린다. 기다리기 전에 온 Enter도 센다.
let enters = 0
const enterWaiters = []
if (process.stdin.isTTY) process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.on('data', (d) => {
  enters += (d.toString('utf8').match(/[\r\n]/g) ?? []).length
  while (enters > 0 && enterWaiters.length > 0) {
    enters--
    enterWaiters.shift()()
  }
})
process.stdout.on('resize', () => out(`SIZE ${size()}`))

// ---------- 인자 ----------

const opts = {
  skip: false,
  sessionId: randomUUID(),
  resume: false,
  addDirs: [],
  settings: null,
  prompt: null,
}
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--dangerously-skip-permissions') opts.skip = true
  else if (a === '--session-id') opts.sessionId = argv[++i]
  else if (a === '--resume') {
    opts.sessionId = argv[++i]
    opts.resume = true
  } else if (a === '--add-dir') opts.addDirs.push(argv[++i])
  else if (a === '--settings') opts.settings = argv[++i]
  else if (a === '--model' || a === '--effort') i++
  else if (!a.startsWith('--') && opts.prompt === null) opts.prompt = a
}

const recordDir = env.FAKE_CLAUDE_RECORD
function record(entry) {
  if (!recordDir) return
  fs.mkdirSync(recordDir, { recursive: true })
  fs.appendFileSync(
    path.join(recordDir, 'fake-claude.jsonl'),
    `${JSON.stringify({ pid: process.pid, ...entry })}\n`,
  )
}

const scenarioFile = env.FAKE_CLAUDE_SCENARIO

// ---------- 훅 ----------

function loadSettings() {
  if (!opts.settings) return { hooks: {} }
  const text = opts.settings.trim().startsWith('{')
    ? opts.settings
    : fs.readFileSync(opts.settings, 'utf8')
  return JSON.parse(text)
}

/** 머리글 값의 $VAR, ${VAR}를 푼다. allowedEnvVars에 없는 변수는 빈 문자열이다 */
function interpolate(value, allowed) {
  return value.replace(/\$\{(\w+)\}|\$(\w+)/g, (_m, a, b) => {
    const name = a ?? b
    return allowed.includes(name) ? (env[name] ?? '') : ''
  })
}

let promptId
/** /clear 뒤 아직 대화가 없는 새 세션. 다음 요청 때 기록한다 */
let unsaved = false

function permissionMode() {
  return env.FAKE_CLAUDE_PERMISSION_MODE || (opts.skip ? 'bypassPermissions' : 'default')
}

async function hook(event, fields = {}, toolName) {
  const settings = loadSettings()
  const groups = settings.hooks?.[event] ?? []
  const body = {
    session_id: opts.sessionId,
    ...(promptId ? { prompt_id: promptId } : {}),
    transcript_path: path.join(os.tmpdir(), 'fake-claude', `${opts.sessionId}.jsonl`),
    cwd: process.cwd(),
    permission_mode: permissionMode(),
    hook_event_name: event,
    ...fields,
  }
  let decision = null
  for (const group of groups) {
    if (
      group.matcher &&
      toolName !== undefined &&
      !new RegExp(`^(?:${group.matcher})$`).test(toolName)
    ) {
      continue
    }
    for (const h of group.hooks ?? []) {
      if (h.type !== 'http') continue
      const headers = { 'Content-Type': 'application/json' }
      for (const [k, v] of Object.entries(h.headers ?? {})) {
        headers[k] = interpolate(String(v), h.allowedEnvVars ?? [])
      }
      let status = 0
      let text
      try {
        const res = await fetch(h.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout((h.timeout ?? 600) * 1000),
        })
        status = res.status
        text = await res.text()
      } catch (e) {
        // 연결 실패는 비차단 오류다 (S2)
        text = `연결 실패: ${e?.message ?? e}`
      }
      const trimmed = text.trim()
      const json =
        status >= 200 && status < 300 && trimmed.startsWith('{') ? JSON.parse(trimmed) : null
      record({ type: 'hook', event, body, status, response: json })
      if (json) decision = json
    }
  }
  return decision
}

// ---------- 시나리오 ----------

function readContext() {
  const m = /^\/relay-([\w-]+)\s+이 task의 컨텍스트:\s*(.+)$/.exec(opts.prompt ?? '')
  if (!m) return { skill: null, taskDir: process.cwd(), taskId: null, node: null }
  const [, skill, contextPath] = m
  const text = fs.readFileSync(contextPath.trim(), 'utf8')
  const field = (name) => new RegExp(`^- ${name}: (.+)$`, 'm').exec(text)?.[1]?.trim() ?? null
  return {
    skill,
    taskDir: field('task 디렉터리') ?? path.dirname(contextPath),
    taskId: field('task_id'),
    node: field('node')?.split(' ')[0] ?? null,
  }
}

function fill(text, vars) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

/** 세션 기록 (실제 claude의 transcript 대신). --resume이 이것으로 task를 찾는다 */
function sessionFile(id) {
  return recordDir ? path.join(recordDir, 'sessions', `${id}.json`) : null
}

function saveSession(ctx) {
  const file = sessionFile(opts.sessionId)
  if (!file) return
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(ctx))
}

function loadSession() {
  const file = sessionFile(opts.sessionId)
  return file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function waitEnter() {
  if (enters > 0) {
    enters--
    return Promise.resolve()
  }
  return new Promise((r) => enterWaiters.push(r))
}

async function steps(list, ctx, vars) {
  for (const step of list) {
    const s = step.do
    out(`[가짜 claude] ${s}${step.file ? ` ${step.file}` : ''}`)
    if (s === 'prompt') {
      promptId = randomUUID()
      if (unsaved) {
        saveSession(ctx)
        unsaved = false
      }
      await hook('UserPromptSubmit', { prompt: step.text ?? opts.prompt })
    } else if (s === 'clear') {
      await hook('SessionEnd', { reason: 'clear' })
      opts.sessionId = randomUUID()
      unsaved = true
    } else if (s === 'write') {
      const file = path.join(ctx.taskDir, step.file)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, fill(step.text, vars))
    } else if (s === 'remove') {
      fs.rmSync(path.join(ctx.taskDir, step.file), { force: true })
    } else if (s === 'commit') {
      for (const [name, text] of Object.entries(step.files ?? {})) {
        const file = path.join(process.cwd(), name)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, fill(text, vars))
      }
      execFileSync('git', ['add', '-A'], { stdio: 'ignore' })
      execFileSync('git', ['commit', '-q', '-m', step.message ?? 'fake commit'], {
        stdio: 'ignore',
      })
    } else if (s === 'waitEnter') {
      // 사람이 터미널에서 새 요청을 보낼 때까지 기다린다 (다시 연 세션은 입력을 기다린다, S6)
      out('입력 대기: Enter를 누르세요')
      await waitEnter()
    } else if (s === 'ask') {
      const question = { questions: [{ question: step.question ?? '질문', options: [] }] }
      await hook(
        'PreToolUse',
        { tool_name: 'AskUserQuestion', tool_input: question },
        'AskUserQuestion',
      )
      out('질문 대기: Enter를 누르세요')
      await waitEnter()
      await hook(
        'PostToolUse',
        { tool_name: 'AskUserQuestion', tool_input: question, tool_response: '답함' },
        'AskUserQuestion',
      )
    } else if (s === 'tool') {
      await hook('PreToolUse', { tool_name: step.name, tool_input: {} }, step.name)
      await hook(
        'PostToolUse',
        { tool_name: step.name, tool_input: {}, tool_response: '' },
        step.name,
      )
    } else if (s === 'notify') {
      await hook('Notification', { message: '알림', notification_type: step.type })
    } else if (s === 'stop') {
      // Stop을 보내고 되돌림을 받으면 고쳐 쓴 뒤 stop_hook_active: true로 다시 보낸다 (S2)
      let active = false
      for (let attempt = 1; attempt <= 10; attempt++) {
        const r = await hook('Stop', { stop_hook_active: active, last_assistant_message: '끝' })
        if (r?.decision !== 'block') break
        out(`[가짜 claude] 되돌림 ${attempt}: ${String(r.reason).split('\n')[0]}`)
        await steps(step.onBlock ?? [], ctx, { ...vars, attempt })
        active = true
      }
    } else if (s === 'exit') {
      await hook('SessionEnd', { reason: step.reason ?? 'prompt_input_exit' })
      // SessionEnd를 보낸 뒤 프로세스가 곧바로 끝나지 않는 때를 흉내 낸다
      if (step.linger) await sleep(step.linger)
      process.exit(0)
    } else if (s === 'sleep') {
      await sleep(step.ms ?? 100)
    } else if (s === 'print') {
      out(fill(step.text, vars))
    } else if (s === 'wait') {
      await new Promise(() => {})
    } else {
      throw new Error(`모르는 단계: ${s}`)
    }
  }
}

async function run() {
  const scenario = JSON.parse(fs.readFileSync(scenarioFile, 'utf8'))
  const ctx = opts.resume ? loadSession() : readContext()
  if (!ctx) {
    // 실제 claude와 같다: 저장된 대화가 없는 id로 --resume하면 끝난다 (스파이크 S6)
    record({ type: 'start', args: argv, resume: true, found: false })
    out(`No conversation found with session ID: ${opts.sessionId}`)
    process.exit(1)
  }
  if (!opts.resume) saveSession(ctx)
  record({
    type: 'start',
    args: argv,
    resume: opts.resume,
    cwd: process.cwd(),
    token: Boolean(env.RELAY_HOOK_TOKEN),
    skill: ctx.skill,
    taskId: ctx.taskId,
    taskDir: ctx.taskDir,
  })
  // 다시 연 세션은 사람의 입력을 기다린다. resume 시나리오가 없으면 아무것도 하지 않는다
  const list = opts.resume
    ? (scenario.resume?.[ctx.taskId] ?? scenario.resume?.[ctx.skill] ?? [])
    : (scenario.tasks?.[ctx.taskId] ?? scenario.tasks?.[ctx.skill] ?? [{ do: 'prompt' }])
  await steps(list, ctx, { taskDir: ctx.taskDir, taskId: ctx.taskId, node: ctx.node, attempt: 0 })
  out('[가짜 claude] 대기')
}

// 시나리오가 없으면 M0처럼 출력만 내고 살아 있는다
if (scenarioFile) {
  run().catch((e) => {
    out(`[가짜 claude] 오류: ${e?.stack ?? e}`)
    record({ type: 'error', error: String(e?.stack ?? e) })
  })
}
