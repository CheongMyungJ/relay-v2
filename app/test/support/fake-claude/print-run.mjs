// 가짜 claude의 extract run(claude -p, 도구 켬, stream-json). 평가 하네스(eval/extract)의 dry와 [계약] 가짜 쪽이 쓴다.
// 모델을 부르지 않는다. 내는 모양은 실제 녹화본에서 가져와 녹화본에 없는 필드를 지어내지 않는다(CLAUDE.md):
// stream-json 메시지는 test/contract/fixtures/claude-run.json의 예시를, 훅 본문은 fixtures/claude.json의 예시를 틀로 쓴다.
//
// 인자는 실제 run과 같다(skills/extract/run.mjs의 runArgs). 할 일은 FAKE_CLAUDE_RUN이 가리키는 JSON 파일이다:
//   { "tools": [{ "name": "Read", "input": { "file_path": "..." } }],
//     "outputs": [<구조화 출력>, ...],   // 차례로 StructuredOutput을 낸다. PreToolUse가 막으면 다음 것을 낸다
//     "background": false,              // true면 첫 Stop에 백그라운드 작업을 실은 뒤 끝난 것으로 다시 Stop
//     "write": { "path": "...", "text": "..." },  // 있으면 그 파일을 쓴다(worktree 변경 흉내)
//     "exitCode": 0 }
// 출력 값의 {wt}는 첫 --add-dir로 바꾼다.
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const fixtures = path.resolve(here, '../../contract/fixtures')
const runFixture = JSON.parse(fs.readFileSync(path.join(fixtures, 'claude-run.json'), 'utf8'))
const hookFixture = JSON.parse(fs.readFileSync(path.join(fixtures, 'claude.json'), 'utf8'))

const argv = process.argv.slice(2)
const opt = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}
if (argv.includes('--version')) {
  console.log(`${runFixture.claudeVersion.replace(/ \(.*$/, '')} (fake)`)
  process.exit(0)
}
const sessionId = opt('--session-id') ?? randomUUID()
const wt = opt('--add-dir') ?? process.cwd()
const tools = (opt('--tools') ?? '').split(',').filter(Boolean)
const settings = JSON.parse(fs.readFileSync(opt('--settings'), 'utf8'))
const plan = JSON.parse(fs.readFileSync(process.env.FAKE_CLAUDE_RUN, 'utf8'))
const fill = (v) => JSON.parse(JSON.stringify(v).replaceAll('{wt}', wt.replaceAll('\\', '\\\\')))

let packet = ''
for await (const c of process.stdin) packet += c

const emit = (m) => process.stdout.write(JSON.stringify(m) + '\n')
const transcript = path.join(process.cwd(), `${sessionId}.jsonl`)

/** 녹화본의 예시를 틀로 쓴 훅 본문. 가린 값(<...>)만 이 실행의 값으로 바꾼다 */
function hookBody(event, extra) {
  const sample = hookFixture.events[event].sample
  const body = {}
  for (const k of Object.keys(sample)) {
    if (k === 'session_id') body[k] = sessionId
    else if (k === 'transcript_path') body[k] = transcript
    else if (k === 'cwd') body[k] = process.cwd()
    else if (k === 'prompt_id') body[k] = 'fake-prompt'
    else if (k === 'tool_use_id') body[k] = `toolu_fake_${randomUUID().slice(0, 8)}`
    else if (k in extra) body[k] = extra[k]
    else body[k] = sample[k]
  }
  return body
}

async function hook(event, extra = {}) {
  const group = settings.hooks?.[event]?.[0]?.hooks?.[0]
  if (!group) return {}
  const headers = { 'Content-Type': 'application/json' }
  for (const [k, v] of Object.entries(group.headers ?? {}))
    headers[k] = v.replace(/\$([A-Z_]+)/g, (_, n) => process.env[n] ?? '')
  const res = await fetch(group.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(hookBody(event, extra)),
  })
  try {
    return await res.json()
  } catch {
    return {}
  }
}

const denied = (r) => r?.hookSpecificOutput?.permissionDecision === 'deny'

emit({
  ...runFixture.init.sample,
  cwd: process.cwd(),
  session_id: sessionId,
  uuid: randomUUID(),
  tools: [...tools, 'StructuredOutput'],
  mcp_servers: [],
  skills: [],
  slash_commands: [],
})
emit({ ...runFixture.rateLimit.sample, uuid: randomUUID(), session_id: sessionId })
await hook('UserPromptSubmit', { prompt: packet })

const denials = []
for (const t of plan.tools ?? []) {
  const input = fill(t.input)
  const r = await hook('PreToolUse', { tool_name: t.name, tool_input: input })
  if (denied(r)) {
    denials.push({ tool_name: t.name, tool_use_id: 'toolu_fake', tool_input: input })
    continue
  }
  await hook('PostToolUse', { tool_name: t.name, tool_input: input, tool_response: {} })
}
if (plan.write) fs.writeFileSync(fill(plan.write.path), plan.write.text)

let output
for (const o of plan.outputs ?? []) {
  const input = fill(o)
  const r = await hook('PreToolUse', { tool_name: 'StructuredOutput', tool_input: input })
  if (denied(r)) {
    denials.push({ tool_name: 'StructuredOutput', tool_use_id: 'toolu_fake', tool_input: input })
    continue
  }
  await hook('PostToolUse', { tool_name: 'StructuredOutput', tool_input: input, tool_response: {} })
  output = input
  break
}
if (plan.background) {
  const task = Object.fromEntries(
    Object.keys(runFixture.backgroundTask).map((k) => [
      k,
      { id: 'bfake01', type: 'shell', status: 'running', description: 'fake', command: 'sleep 1' }[
        k
      ],
    ]),
  )
  await hook('Stop', { background_tasks: [task], stop_hook_active: false })
}
await hook('Stop', { background_tasks: [], stop_hook_active: false })
await hook('SessionEnd', { reason: 'other' })

const result = { ...runFixture.result.sample, uuid: randomUUID(), session_id: sessionId }
result.subtype = 'success'
result.is_error = false
result.num_turns = (plan.tools?.length ?? 0) + 1
result.permission_denials = denials
result.result = output ? JSON.stringify(output) : 'no structured output'
if (output) result.structured_output = output
else delete result.structured_output
emit(result)
process.exit(plan.exitCode ?? 0)
