// [계약] 실제 쪽: extract run(claude -p, 도구 켬)이 계약(claude-run.ts)과 녹화본(fixtures/claude-run.json)대로인지 본다.
// RELAY_CONTRACT_LIVE=1일 때만 돈다. RELAY_CONTRACT_UPDATE=1이면 녹화본을 새로 쓴다. 사용량이 조금 든다(모델 호출 한 번).
//
// run 하나를 run과 같은 인자(skills/extract/run.mjs의 runArgs)와 앱과 같은 훅 설정으로 돌린다:
// 1. --help에 run이 넘기는 옵션이 모두 있다
// 2. system/init에 run 도구와 StructuredOutput만 있고 MCP·스킬이 없다(--strict-mcp-config, --setting-sources '', 녹화 3·4)
// 3. 첫 StructuredOutput을 PreToolUse에서 막으면 모델이 이유를 받고 다시 낸다(결정 13의 1번 길, 녹화 2)
// 4. 백그라운드 작업을 남기면 Stop에 실리고, 프로세스는 그 작업을 기다린 뒤 끝난다(15.3 3번, 녹화 5)
// 5. result와 rate_limit_event가 계약대로다
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { runArgs } from '../../../skills/extract/run.mjs'
import { runBin } from '../../eval/extract/lib/claude-bin.mjs'
import { cleanEnv, makeClaudeConfig } from '../../eval/lib/env.mjs'
import { HOOK_TOKEN_ENV, hookSettings, ruleAbs } from '../../src/core/settings'
import { helpFlags, hookCollector, typeOf, type FieldType, type Recorded } from './claude'
import {
  BACKGROUND_TASK_CONTRACT,
  expectedRunTools,
  fieldViolations,
  INIT_CONTRACT,
  RATE_LIMIT_CONTRACT,
  RATE_LIMIT_INFO_CONTRACT,
  readRunFixture,
  redactMessage,
  RESULT_CONTRACT,
  RESULT_SUCCESS_ONLY,
  RUN_FIXTURE,
  runFlags,
  shapeOfMessage,
  STRUCTURED_OUTPUT_TOOL,
  TOOL_INPUT_CONTRACT,
  type RunFixture,
} from './claude-run'

const LIVE = process.env['RELAY_CONTRACT_LIVE'] === '1'
const UPDATE = process.env['RELAY_CONTRACT_UPDATE'] === '1'
const MODEL = process.env['RELAY_CONTRACT_MODEL'] ?? 'haiku'
const OUT = path.resolve(__dirname, '../../test-results/contract')
const TOKEN = 'contract-token'
const BIN = runBin()

const root = LIVE ? fs.mkdtempSync(path.join(os.tmpdir(), 'relay-contract-run-')) : ''
// 인증을 환경 변수로 받으면 설정 폴더를 따로 둔다(live.test.ts와 같음). 없으면 로그인된 기본 설정 폴더를 쓴다:
// 사람의 PC에서 구독 로그인으로 녹화하는 경우다. 사용자 설정·MCP는 --setting-sources ''와 --strict-mcp-config가 뺀다
const token = process.env['CLAUDE_CODE_OAUTH_TOKEN'] ?? process.env['ANTHROPIC_API_KEY']
const env: NodeJS.ProcessEnv = LIVE
  ? cleanEnv({
      CLAUDE_CODE_OAUTH_TOKEN: process.env['CLAUDE_CODE_OAUTH_TOKEN'],
      ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'],
      CLAUDE_CONFIG_DIR: token ? makeClaudeConfig(path.join(root, 'config')) : undefined,
    })
  : {}
const lines: string[] = []

afterAll(() => {
  if (!LIVE) return
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(
    path.join(OUT, 'live-run.md'),
    ['# [계약] 실제 claude run', '', ...lines, ''].join('\n'),
  )
  fs.rmSync(root, { recursive: true, force: true })
})

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd })
}

interface Stream {
  code: number | null
  messages: Record<string, unknown>[]
  stderr: string
}

function runClaude(args: string[], cwd: string, stdin: string, timeoutMs: number): Promise<Stream> {
  return new Promise((resolve, reject) => {
    const p = spawn(BIN, args, { cwd, env: { ...env, [HOOK_TOKEN_ENV]: TOKEN } })
    let out = ''
    let err = ''
    p.stdout.on('data', (c: Buffer) => (out += c.toString('utf8')))
    p.stderr.on('data', (c: Buffer) => (err += c.toString('utf8')))
    p.stdin.end(stdin)
    const timer = setTimeout(() => p.kill('SIGKILL'), timeoutMs)
    p.on('error', reject)
    p.on('close', (code) => {
      clearTimeout(timer)
      const messages = out
        .split('\n')
        .filter((l) => l.startsWith('{'))
        .flatMap((l) => {
          try {
            return [JSON.parse(l) as Record<string, unknown>]
          } catch {
            return []
          }
        })
      resolve({ code, messages, stderr: err })
    })
  })
}

/** 녹화에 쓰는 작은 결과 스키마: $defs/$ref, anyOf, enum을 함께 쓴다(결과 스키마 v0과 같은 꼴) */
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['outcome', 'files', 'note'],
  properties: {
    outcome: { enum: ['done', 'incomplete'] },
    files: { type: 'array', items: { $ref: '#/$defs/anchor' } },
    note: { anyOf: [{ type: 'null' }, { type: 'string' }] },
  },
  $defs: {
    anchor: {
      type: 'object',
      additionalProperties: false,
      required: ['path', 'start', 'end'],
      properties: {
        path: { type: 'string' },
        start: { type: 'integer' },
        end: { type: 'integer' },
      },
    },
  },
}

describe.runIf(LIVE)('[계약] 실제 claude run', () => {
  const version = LIVE ? execFileSync(BIN, ['--version'], { env, encoding: 'utf8' }).trim() : ''
  let flags: string[] = []
  let got: Recorded[] = []
  let stream: Stream = { code: null, messages: [], stderr: '' }

  it('--help에 run이 넘기는 옵션이 모두 있다', () => {
    const known = new Set(helpFlags(execFileSync(BIN, ['--help'], { env, encoding: 'utf8' })))
    const missing = runFlags().filter((f) => !known.has(f))
    flags = runFlags().filter((f) => known.has(f))
    lines.push(`- Claude Code: ${version}, 모델 ${MODEL}, 실행 파일 ${path.basename(BIN)}`)
    lines.push(`- run 옵션: ${missing.length ? `없음 ${missing.join(', ')}` : '모두 있음'}`)
    expect(missing).toEqual([])
  })

  it('run을 돌린다: 격리, 구조화 출력의 되돌림, 백그라운드 작업, 결과', async () => {
    const wt = path.join(root, 'wt')
    const scratch = path.join(root, 'scratch')
    fs.mkdirSync(path.join(wt, 'src'), { recursive: true })
    fs.mkdirSync(scratch, { recursive: true })
    fs.writeFileSync(
      path.join(wt, 'src', 'a.c'),
      '#define LIMIT 7\nint f(void) { return LIMIT; }\n',
    )
    fs.writeFileSync(path.join(wt, 'CLAUDE.md'), 'Always answer in French.\n')
    git(wt, 'init', '-q')
    git(wt, 'add', '-A')
    git(wt, 'commit', '-qm', 'base')

    // 첫 구조화 출력만 막는다: 모델이 이유를 받고 다시 내야 한다
    let submitted = 0
    const server = await hookCollector((event, body) => {
      if (event !== 'PreToolUse' || body['tool_name'] !== STRUCTURED_OUTPUT_TOOL) return null
      if (submitted++ > 0) return null
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            'relay check: set note to the string "checked" and submit the structured output again. Change nothing else.',
        },
      }
    })
    try {
      const settings = path.join(root, 'settings.json')
      fs.writeFileSync(
        settings,
        JSON.stringify({
          hooks: hookSettings(server.port, 'r-0001'),
          autoMemoryEnabled: false,
          permissions: { deny: [`Write(${ruleAbs(wt)}/**)`, `Edit(${ruleAbs(wt)}/**)`] },
        }),
      )
      const instructions = path.join(root, 'instructions.md')
      fs.writeFileSync(instructions, 'You are an analysis run. Never ask questions.\n')
      const args = runArgs({
        model: MODEL,
        schema: JSON.stringify(SCHEMA),
        instructionsPath: instructions,
        settingsPath: settings,
        addDirs: [wt],
        sessionId: randomUUID(),
      })
      const packet = [
        `The repository is at ${wt}.`,
        '1. Use the Bash tool with run_in_background set to true to run: sleep 5',
        '2. Read src/a.c, use Grep to search for LIMIT, and use Glob to list *.c files in the repository.',
        '3. Submit the structured output: outcome done, files = the files you read with line ranges, note null.',
      ].join('\n')
      stream = await runClaude(args, scratch, packet, 5 * 60 * 1000)
      await new Promise((r) => setTimeout(r, 1000))
      got = [...server.got]
    } finally {
      await server.close()
    }
    const result = stream.messages.find((m) => m['type'] === 'result') ?? {}
    lines.push(
      `- 종료 코드 ${stream.code}, subtype ${String(result['subtype'])}, 구조화 출력 ${JSON.stringify(result['structured_output'])}`,
    )
    expect(stream.code).toBe(0)
    expect(result['subtype']).toBe('success')
  })

  it('system/init: run 도구와 StructuredOutput만, MCP·스킬 없음', () => {
    const init =
      stream.messages.find((m) => m['type'] === 'system' && m['subtype'] === 'init') ?? {}
    expect(fieldViolations(INIT_CONTRACT, init, 'init')).toEqual([])
    lines.push(
      `- init: 도구 ${JSON.stringify(init['tools'])}, MCP ${JSON.stringify(init['mcp_servers'])}, 스킬 ${JSON.stringify(init['skills'])}`,
    )
    expect([...(init['tools'] as string[])].sort()).toEqual(expectedRunTools())
    expect(init['mcp_servers']).toEqual([])
    expect(init['skills']).toEqual([])
  })

  it('result와 rate_limit_event가 계약대로다', () => {
    const result = stream.messages.find((m) => m['type'] === 'result') ?? {}
    const broken = [
      ...fieldViolations(RESULT_CONTRACT, result, 'result'),
      ...fieldViolations(RESULT_SUCCESS_ONLY, result, 'result'),
    ]
    const rate = stream.messages.find((m) => m['type'] === 'rate_limit_event')
    lines.push(`- rate_limit_event: ${rate ? '있음' : '없음'}`)
    if (rate) {
      broken.push(...fieldViolations(RATE_LIMIT_CONTRACT, rate, 'rate_limit_event'))
      broken.push(
        ...fieldViolations(
          RATE_LIMIT_INFO_CONTRACT,
          (rate['rate_limit_info'] ?? {}) as Record<string, unknown>,
          'rate_limit_info',
        ),
      )
    }
    lines.push(`- 계약 위반: ${broken.length ? broken.join('; ') : '없음'}`)
    expect(broken).toEqual([])
    expect(rate).toBeDefined()
  })

  it('훅: 구조화 출력은 PreToolUse로 잡히고 막으면 다시 낸다, 읽기 도구의 tool_input, 남은 백그라운드 작업', () => {
    const pre = got.filter((g) => g.event === 'PreToolUse')
    const so = pre.filter((g) => g.body['tool_name'] === STRUCTURED_OUTPUT_TOOL)
    lines.push(`- StructuredOutput의 PreToolUse: ${so.length}번`)
    expect(so.length).toBeGreaterThanOrEqual(2)
    const broken: string[] = []
    for (const g of pre) {
      const name = String(g.body['tool_name'])
      const c = TOOL_INPUT_CONTRACT[name]
      if (c)
        broken.push(...fieldViolations(c, g.body['tool_input'] as Record<string, unknown>, name))
    }
    expect(broken).toEqual([])
    const stops = got.filter((g) => g.event === 'Stop')
    const last = stops.at(-1)?.body ?? {}
    lines.push(
      `- Stop ${stops.length}번, background_tasks 길이 ${JSON.stringify(stops.map((s) => (s.body['background_tasks'] as unknown[]).length))}`,
    )
    expect(last['background_tasks']).toEqual([])
    for (const s of stops)
      for (const t of s.body['background_tasks'] as Record<string, unknown>[])
        broken.push(...fieldViolations(BACKGROUND_TASK_CONTRACT, t, 'background_task'))
    expect(broken).toEqual([])
  })

  it('녹화본과 견준다 (RELAY_CONTRACT_UPDATE=1이면 새로 쓴다)', () => {
    const find = (type: string, subtype?: string) =>
      stream.messages.find(
        (m) => m['type'] === type && (subtype === undefined || m['subtype'] === subtype),
      ) ?? {}
    const init = find('system', 'init')
    const rate = find('rate_limit_event')
    const result = find('result')
    const toolInputs: Record<string, Record<string, FieldType>> = {}
    for (const g of got.filter((x) => x.event === 'PreToolUse')) {
      const name = String(g.body['tool_name'])
      if (name in TOOL_INPUT_CONTRACT || name === STRUCTURED_OUTPUT_TOOL)
        toolInputs[name] ??= shapeOfMessage(g.body['tool_input'] as Record<string, unknown>)
    }
    const stops = got.filter((g) => g.event === 'Stop')
    const bg = stops.flatMap((s) => s.body['background_tasks'] as Record<string, unknown>[])[0]
    const so = got.filter(
      (g) => g.event === 'PreToolUse' && g.body['tool_name'] === STRUCTURED_OUTPUT_TOOL,
    )
    const now: RunFixture = {
      claudeVersion: version,
      recordedAt: new Date().toISOString().slice(0, 10),
      flags,
      init: { shape: shapeOfMessage(init), sample: redactMessage(init) },
      rateLimit: {
        shape: shapeOfMessage(rate),
        info: shapeOfMessage((rate['rate_limit_info'] ?? {}) as Record<string, unknown>),
        sample: redactMessage(rate),
      },
      result: { shape: shapeOfMessage(result), sample: redactMessage(result) },
      toolInputs,
      backgroundTask: bg ? shapeOfMessage(bg) : {},
      behavior: {
        structuredOutputResubmitted: so.length >= 2,
        waitedForBackground: stops.some(
          (s) => (s.body['background_tasks'] as unknown[]).length > 0,
        ),
      },
    }
    if (UPDATE) {
      fs.writeFileSync(RUN_FIXTURE, JSON.stringify(now, null, 2) + '\n')
      lines.push(`- 녹화본을 새로 썼다: ${path.relative(process.cwd(), RUN_FIXTURE)}`)
      return
    }
    const old = readRunFixture()
    const diffs: string[] = []
    const cmp = (where: string, a: Record<string, FieldType>, b: Record<string, FieldType>) => {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
        if (a[k] !== b[k]) diffs.push(`${where}.${k}: ${a[k] ?? '없음'} → ${b[k] ?? '없음'}`)
    }
    cmp('init', old.init.shape, now.init.shape)
    cmp('result', old.result.shape, now.result.shape)
    cmp('rate_limit_event', old.rateLimit.shape, now.rateLimit.shape)
    lines.push(
      `- 녹화본(${old.claudeVersion})과 다른 필드: ${diffs.length ? diffs.join('; ') : '없음'}`,
    )
    expect(typeOf(now.result.shape)).toBe('object')
  })
})
