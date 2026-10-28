// [계약] 실제 쪽: 실제 claude가 아직 계약(claude.ts)과 녹화본(fixtures/claude.json)대로인지 본다. 사용량이 조금 든다.
// RELAY_CONTRACT_LIVE=1일 때만 돈다(app-claude 워크플로의 정기 실행, Claude Code를 올릴 때). 없으면 건너뛴다.
// RELAY_CONTRACT_UPDATE=1이면 녹화본을 새로 쓴다. stream이면 옵션과 출력 이벤트(4)만 새로 쓰고 훅 본문은 둔다.
// 녹화본이 바뀌면 fakes.test.ts가 가짜 claude를 따라오게 한다. RELAY_CONTRACT_PASS_ENV에 쉼표로 적은 변수는 고른 환경에
// 더 넘긴다(로그인을 프록시와 토큰 파일로 하는 환경).
//
// 1. claude --help에 앱이 넘기는 옵션이 모두 있다
// 2. claude -p를 앱과 같은 훅 설정(--settings, hookSettings)으로 돌려 오는 훅 본문이 계약을 지킨다. 훅 머리글의
//    $RELAY_HOOK_TOKEN이 풀려 온다(I13). 도구 성공과 실패(PostToolUseFailure)를 하나씩 부르게 한다. 첫 Stop을 되돌리면
//    일을 잇고 다음 Stop에 stop_hook_active: true를 보낸다(S2, D21)
// 3. 지식 검토 호출(claudeJson, D300)이 구조화된 출력과 사용량을 읽는다
// 4. 독립 리뷰 호출의 출력 이벤트(stream-json, D502)가 계약을 지키고 진행 표시와 결과를 읽는다
// 5. relay MCP로 묻는 task의 옵션(--mcp-config, --disallowedTools, D521)이 relay 서버를 붙이고 AskUserQuestion을 뺀다
//    (시작 이벤트의 도구와 MCP 서버 목록. 앱은 이 이벤트를 읽지 않아 계약에 넣지 않는다)
import { execFileSync, spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { cleanEnv, makeClaudeConfig } from '../../eval/lib/env.mjs'
import { claudeJson } from '../../src/adapters/claude'
import { reviewSteps } from '../../src/core/independent-review'
import { codexBridgePath } from '../../src/adapters/codex'
import {
  CLI_ASK_TOOL,
  HOOK_TOKEN_ENV,
  RELAY_ASK_TOOL,
  hookSettings,
  launchArgs,
  relayMcpConfig,
  type HookEvent,
} from '../../src/core/settings'
import {
  appFlags,
  FIXTURE,
  helpFlags,
  hookCollector,
  NOT_RECORDED,
  readFixture,
  redact,
  shapeOf,
  streamParts,
  streamViolations,
  violations,
  type ClaudeFixture,
  type Recorded,
} from './claude'

const LIVE = process.env['RELAY_CONTRACT_LIVE'] === '1'
const UPDATE = process.env['RELAY_CONTRACT_UPDATE'] === '1'
const UPDATE_STREAM = process.env['RELAY_CONTRACT_UPDATE'] === 'stream'
const PASS = (process.env['RELAY_CONTRACT_PASS_ENV'] ?? '').split(',').filter(Boolean)
const MODEL = process.env['RELAY_CONTRACT_MODEL'] ?? 'haiku'
const OUT = path.resolve(__dirname, '../../test-results/contract')
const TOKEN = 'contract-token'

const BIN = process.env['CLAUDE_BIN'] ?? 'claude'
// 건너뛸 때는 임시 폴더도 결과 파일도 만들지 않는다
const root = LIVE ? fs.mkdtempSync(path.join(os.tmpdir(), 'relay-contract-')) : ''
/** 고른 환경만 넘긴다 (8.4, 평가와 같은 eval/lib/env.mjs). 설정 폴더는 따로 두고 대화형 온보딩을 건너뛴다 */
const env: NodeJS.ProcessEnv = LIVE
  ? cleanEnv({
      CLAUDE_CODE_OAUTH_TOKEN: process.env['CLAUDE_CODE_OAUTH_TOKEN'],
      ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'],
      ...Object.fromEntries(PASS.map((k) => [k, process.env[k]])),
      CLAUDE_CONFIG_DIR: makeClaudeConfig(path.join(root, 'config')),
    })
  : {}
const lines: string[] = []

afterAll(() => {
  if (!LIVE) return
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'live.md'), ['# [계약] 실제 claude', '', ...lines, ''].join('\n'))
  fs.rmSync(root, { recursive: true, force: true })
})

function runClaude(args: string[], cwd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(BIN, args, { cwd, env: { ...env, [HOOK_TOKEN_ENV]: TOKEN } })
    let out = ''
    p.stdout.on('data', (c: Buffer) => (out += c.toString('utf8')))
    p.stderr.on('data', (c: Buffer) => (out += c.toString('utf8')))
    p.stdin.end()
    const timer = setTimeout(() => p.kill('SIGKILL'), timeoutMs)
    p.on('error', reject)
    p.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error(`claude 종료 코드 ${code}: ${out.slice(-2000)}`))
    })
  })
}

describe.runIf(LIVE)('[계약] 실제 claude', () => {
  const version = LIVE ? execFileSync(BIN, ['--version'], { env, encoding: 'utf8' }).trim() : ''
  let flags: string[] = []
  let got: Recorded[] = []
  let stream: Record<string, unknown>[] = []

  it('--help에 앱이 넘기는 옵션이 모두 있다', () => {
    const help = execFileSync(BIN, ['--help'], { env, encoding: 'utf8' })
    const known = new Set(helpFlags(help))
    const missing = appFlags().filter((f) => !known.has(f))
    flags = appFlags().filter((f) => known.has(f))
    lines.push(`- Claude Code: ${version}, 모델 ${MODEL}`)
    lines.push(`- 옵션: ${missing.length ? `없음 ${missing.join(', ')}` : '모두 있음'}`)
    expect(missing).toEqual([])
  })

  it('앱과 같은 훅 설정으로 오는 본문이 계약을 지킨다', async () => {
    const cwd = path.join(root, 'repo')
    fs.mkdirSync(cwd, { recursive: true })
    execFileSync('git', ['init', '-q'], { cwd })
    // 첫 Stop은 되돌린다: 실제 claude가 이유를 받아 일을 잇고, 다음 Stop에 stop_hook_active: true를 보내야 한다 (S2, D21)
    const server = await hookCollector((event, _body, nth) =>
      event === 'Stop' && nth === 0
        ? { decision: 'block', reason: 'Before stopping, reply with the single word: again' }
        : null,
    )
    try {
      const settings = path.join(root, 'settings.json')
      fs.writeFileSync(
        settings,
        JSON.stringify({ hooks: hookSettings(server.port, 'contract'), autoMemoryEnabled: false }),
      )
      const prompt = [
        'Use the Bash tool to run exactly this command: echo contract-ok',
        'Then use the Bash tool to run exactly this command: exit 3',
        'Then reply with the single word: done',
      ].join('\n')
      await runClaude(
        [
          '-p',
          '--model',
          MODEL,
          '--dangerously-skip-permissions',
          '--settings',
          settings,
          '--no-session-persistence',
          prompt,
        ],
        cwd,
        5 * 60 * 1000,
      )
      // SessionEnd는 프로세스가 끝날 때 보낸다. 받기를 잠깐 기다린다
      await new Promise((r) => setTimeout(r, 1000))
      got = [...server.got]
    } finally {
      await server.close()
    }

    const seen = [...new Set(got.map((g) => g.event))]
    lines.push(`- 받은 훅: ${seen.join(', ')}`)
    const expected: HookEvent[] = [
      'UserPromptSubmit',
      'PreToolUse',
      'PostToolUse',
      'PostToolUseFailure',
      'Stop',
      'SessionEnd',
    ]
    expect(expected.filter((e) => !seen.includes(e))).toEqual([])
    const stops = got.filter((g) => g.event === 'Stop').map((g) => g.body['stop_hook_active'])
    lines.push(`- Stop 되돌림: Stop ${stops.length}번, stop_hook_active ${JSON.stringify(stops)}`)
    expect(stops.slice(0, 2)).toEqual([false, true])
    expect(got.filter((g) => g.authorization !== `Bearer ${TOKEN}`).map((g) => g.event)).toEqual([])
    const broken = got.flatMap((g) => violations(g.event, g.body).map((v) => `${g.event}: ${v}`))
    lines.push(`- 계약 위반: ${broken.length ? broken.join('; ') : '없음'}`)
    expect(broken).toEqual([])
  })

  it('지식 검토 호출이 구조화된 출력과 사용량을 읽는다', async () => {
    const r = await claudeJson({
      bin: BIN,
      env,
      cwd: root,
      model: MODEL,
      system: 'Answer only with the structured output.',
      prompt: 'Return ok set to true.',
      schema: {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
        required: ['ok'],
        additionalProperties: false,
      },
      timeoutMs: 3 * 60 * 1000,
    })
    lines.push(`- 지식 검토 호출: ${r.error ?? '통과'} (${r.ms}ms)`)
    expect(r.error).toBeNull()
    expect(r.data).toEqual({ ok: true })
    expect(r.usage).not.toBeNull()
    expect(r.costUsd).not.toBeNull()
  })

  it('독립 리뷰 호출의 출력 이벤트가 계약을 지키고 진행과 결과를 읽는다 (D502)', async () => {
    const cwd = path.join(root, 'stream')
    fs.mkdirSync(cwd, { recursive: true })
    fs.writeFileSync(path.join(cwd, 'a.js'), 'export const add = (a, b) => a + b\n')
    const events: Record<string, unknown>[] = []
    const r = await claudeJson({
      bin: BIN,
      env,
      cwd,
      model: MODEL,
      system: 'You review code. Say briefly what you do before each step.',
      // 진행 표시가 읽는 셋(도구 호출, 도구 결과, 모델의 글)이 모두 오게 한다
      prompt:
        'First write one short sentence saying you will read a.js. Then use the Read tool to read a.js. Then return name set to the exported function name.',
      schema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
        additionalProperties: false,
      },
      tools: ['Read', 'Grep', 'Glob'],
      timeoutMs: 3 * 60 * 1000,
      onEvent: (e) => events.push(e),
    })
    stream = events
    const steps = events.flatMap((e) => reviewSteps(e, cwd))
    const broken = streamViolations(streamParts(events))
    lines.push(`- 독립 리뷰 호출: ${r.error ?? '통과'} (${r.ms}ms), 진행 ${steps.length}걸음`)
    lines.push(`- 출력 이벤트 계약 위반: ${broken.length ? broken.join('; ') : '없음'}`)
    expect(r.error).toBeNull()
    expect(r.data).toEqual({ name: 'add' })
    expect(r.costUsd).not.toBeNull()
    expect(broken).toEqual([])
    expect(steps.some((x) => x.kind === 'tool' && x.label === 'Read(a.js)')).toBe(true)
  })

  it('relay MCP로 묻는 task의 옵션이 relay 서버를 붙이고 AskUserQuestion을 뺀다 (D521)', async () => {
    const cwd = path.join(root, 'ask')
    fs.mkdirSync(cwd, { recursive: true })
    fs.writeFileSync(path.join(cwd, 'settings.json'), '{}')
    const config = path.join(cwd, 'task.mcp.json')
    fs.writeFileSync(
      config,
      JSON.stringify(
        relayMcpConfig({
          command: process.execPath,
          bridge: codexBridgePath(),
          port: 1,
          taskId: 't-01',
        }),
      ),
    )
    const out = await new Promise<string>((resolve, reject) => {
      const p = spawn(
        BIN,
        [
          '-p',
          '--model',
          MODEL,
          '--output-format',
          'stream-json',
          '--verbose',
          ...launchArgs({
            sessionId: crypto.randomUUID(),
            workDir: cwd,
            settingsPath: path.join(cwd, 'settings.json'),
            instructionsPath: '',
            skill: 'work-start',
            contextPath: path.join(cwd, 'context.md'),
            mcpConfigPath: config,
          }).filter((a) => a !== '--dangerously-skip-permissions' && !a.startsWith('relay ')),
          'Reply with the single word: ok',
        ],
        { cwd, env },
      )
      let text = ''
      p.stdout.on('data', (c: Buffer) => (text += c.toString('utf8')))
      p.stdin.end()
      const timer = setTimeout(() => p.kill('SIGKILL'), 3 * 60 * 1000)
      p.on('error', reject)
      p.on('close', () => {
        clearTimeout(timer)
        resolve(text)
      })
    })
    const init = out
      .split('\n')
      .flatMap((l) => {
        try {
          return [JSON.parse(l) as Record<string, unknown>]
        } catch {
          return []
        }
      })
      .find((e) => e['type'] === 'system' && e['subtype'] === 'init')
    const tools = (init?.['tools'] as string[] | undefined) ?? []
    const servers = (init?.['mcp_servers'] as { name: string; status: string }[] | undefined) ?? []
    lines.push(
      `- relay MCP로 묻는 task: relay 서버 ${servers.find((x) => x.name === 'relay')?.status ?? '없음'}, ask_human ${tools.includes(RELAY_ASK_TOOL) ? '있음' : '없음'}, AskUserQuestion ${tools.includes(CLI_ASK_TOOL) ? '남음' : '빠짐'}`,
    )
    expect(servers).toContainEqual(expect.objectContaining({ name: 'relay', status: 'connected' }))
    expect(tools).toContain(RELAY_ASK_TOOL)
    expect(tools).not.toContain(CLI_ASK_TOOL)
  })

  it('녹화본과 견준다 (RELAY_CONTRACT_UPDATE=1이면 새로 쓴다)', () => {
    expect(got.length).toBeGreaterThan(0)
    const recordedAt = new Date().toISOString().slice(0, 10)
    const shapes = Object.fromEntries(
      Object.entries(streamParts(stream)).map(([k, v]) => [k, shapeOf(v)]),
    )
    const streamNow = { claudeVersion: version, recordedAt, shapes }
    const events: ClaudeFixture['events'] = {}
    for (const g of got) {
      // 이벤트마다 처음 받은 것을 남긴다. PreToolUse와 PostToolUse는 성공한 도구의 것이다
      if (!events[g.event]) events[g.event] = { shape: shapeOf(g.body), sample: redact(g.body) }
    }
    const now: ClaudeFixture = {
      claudeVersion: version,
      recordedAt,
      flags,
      events,
      stream: streamNow,
    }
    if (UPDATE_STREAM) {
      fs.writeFileSync(
        FIXTURE,
        JSON.stringify({ ...readFixture(), flags, stream: streamNow }, null, 2) + '\n',
      )
      lines.push(
        `- 녹화본의 옵션과 출력 이벤트를 새로 썼다: ${path.relative(process.cwd(), FIXTURE)}`,
      )
      return
    }
    if (UPDATE) {
      fs.writeFileSync(FIXTURE, JSON.stringify(now, null, 2) + '\n')
      lines.push(`- 녹화본을 새로 썼다: ${path.relative(process.cwd(), FIXTURE)}`)
      return
    }
    // 앱이 읽는 필드는 위에서 봤다. 여기서는 그 밖의 차이를 적는다: 녹화본을 다시 쓰고 가짜를 따라오게 할 신호다
    const old = readFixture()
    const diffs: string[] = []
    for (const [e, v] of Object.entries(events)) {
      const before = old.events[e as HookEvent]?.shape ?? {}
      for (const k of new Set([...Object.keys(before), ...Object.keys(v.shape)])) {
        if (before[k] !== v.shape[k])
          diffs.push(`${e}.${k}: ${before[k] ?? '없음'} → ${v.shape[k] ?? '없음'}`)
      }
    }
    lines.push(
      `- 녹화본(${old.claudeVersion})과 다른 필드: ${diffs.length ? diffs.join('; ') : '없음'}`,
    )
    lines.push(
      `- 녹화하지 않는 이벤트: ${Object.entries(NOT_RECORDED)
        .map(([e, why]) => `${e}(${why})`)
        .join(', ')}`,
    )
    // 앱이 읽지 않는 필드의 변화는 앱을 깨지 않는다. 실패로 치지 않고 결과 요약에 남긴다
  })
})
