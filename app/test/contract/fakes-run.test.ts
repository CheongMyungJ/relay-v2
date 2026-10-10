// [계약] 가짜 쪽: 가짜 extract run(test/support/fake-claude/print-run.mjs)이 계약(claude-run.ts)을 지키고, 실제 녹화본
// (fixtures/claude-run.json, fixtures/claude.json)과 같은 모양을 내는지 본다. 모델을 부르지 않는다. 평가 하네스의 dry와
// 앱의 run 시험이 이 가짜로 돌므로, 가짜가 실제와 어긋나면 그 통과가 실제에서 뜻이 없다.
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runArgs } from '../../../skills/extract/run.mjs'
import { HOOK_TOKEN_ENV, hookSettings } from '../../src/core/settings'
import { hookCollector, readFixture, shapeOf, type Recorded } from './claude'
import {
  expectedRunTools,
  fieldViolations,
  INIT_CONTRACT,
  RATE_LIMIT_CONTRACT,
  RATE_LIMIT_INFO_CONTRACT,
  readRunFixture,
  RESULT_CONTRACT,
  RESULT_SUCCESS_ONLY,
  runFlags,
  shapeOfMessage,
  STRUCTURED_OUTPUT_TOOL,
  TOOL_INPUT_CONTRACT,
} from './claude-run'

const FAKE = path.resolve(__dirname, '../support/fake-claude/print-run.mjs')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-contract-fake-run-'))
let got: Recorded[] = []
let messages: Record<string, unknown>[] = []
let code: number | null = null

beforeAll(async () => {
  let n = 0
  const server = await hookCollector((event, body) =>
    event === 'PreToolUse' && body['tool_name'] === STRUCTURED_OUTPUT_TOOL && n++ === 0
      ? { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny' } }
      : null,
  )
  try {
    const settings = path.join(root, 'settings.json')
    fs.writeFileSync(settings, JSON.stringify({ hooks: hookSettings(server.port, 'r-0001') }))
    const plan = path.join(root, 'plan.json')
    fs.writeFileSync(
      plan,
      JSON.stringify({
        tools: [
          { name: 'Read', input: { file_path: '{wt}/src/a.c' } },
          { name: 'Grep', input: { pattern: 'LIMIT', path: '{wt}' } },
          { name: 'Glob', input: { pattern: '*.c', path: '{wt}' } },
        ],
        outputs: [{ note: 'first' }, { note: 'second' }],
        background: true,
      }),
    )
    const args = runArgs({
      model: 'haiku',
      schema: '{}',
      instructionsPath: path.join(root, 'instructions.md'),
      settingsPath: settings,
      addDirs: [path.join(root, 'wt')],
      sessionId: randomUUID(),
    })
    const out = await new Promise<string>((resolve, reject) => {
      const p = spawn(process.execPath, [FAKE, ...args], {
        cwd: root,
        env: {
          PATH: process.env['PATH'],
          [HOOK_TOKEN_ENV]: 'contract-token',
          FAKE_CLAUDE_RUN: plan,
        },
      })
      let s = ''
      p.stdout.on('data', (c: Buffer) => (s += c.toString('utf8')))
      p.stdin.end('packet')
      p.on('error', reject)
      p.on('close', (c) => {
        code = c
        resolve(s)
      })
    })
    messages = out
      .split('\n')
      .filter((l) => l.startsWith('{'))
      .map((l) => JSON.parse(l) as Record<string, unknown>)
    got = [...server.got]
  } finally {
    await server.close()
  }
})

afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe('[계약] run 녹화본', () => {
  const fixture = readRunFixture()

  it('run이 넘기는 옵션이 모두 녹화 때의 --help에 있었다 (새 옵션을 쓰면 다시 녹화한다)', () => {
    expect(runFlags().filter((f) => !fixture.flags.includes(f))).toEqual([])
  })

  it('녹화본이 계약을 지킨다 (계약이 실제에 없는 필드를 요구하지 않는다)', () => {
    const broken = [
      ...fieldViolations(INIT_CONTRACT, fixture.init.sample as Record<string, unknown>, 'init'),
      ...fieldViolations(
        RESULT_CONTRACT,
        fixture.result.sample as Record<string, unknown>,
        'result',
      ),
      ...fieldViolations(
        RESULT_SUCCESS_ONLY,
        fixture.result.sample as Record<string, unknown>,
        'result',
      ),
      ...fieldViolations(
        RATE_LIMIT_CONTRACT,
        fixture.rateLimit.sample as Record<string, unknown>,
        'rate',
      ),
      ...Object.entries(RATE_LIMIT_INFO_CONTRACT)
        .filter(([k, t]) => fixture.rateLimit.info[k] !== t)
        .map(([k]) => `rate_limit_info.${k}`),
      ...Object.entries(TOOL_INPUT_CONTRACT).flatMap(([tool, c]) =>
        Object.entries(c)
          .filter(([k, t]) => fixture.toolInputs[tool]?.[k] !== t)
          .map(([k]) => `${tool}.${k}`),
      ),
    ]
    expect(broken).toEqual([])
    expect(fixture.behavior).toEqual({
      structuredOutputResubmitted: true,
      waitedForBackground: true,
    })
  })
})

describe('[계약] 가짜 run', () => {
  const fixture = readRunFixture()
  const hookFixture = readFixture()
  const find = (type: string) => messages.find((m) => m['type'] === type) ?? {}

  it('stream-json 메시지가 녹화본과 필드와 타입이 같다', () => {
    expect(code).toBe(0)
    expect(shapeOfMessage(find('system'))).toEqual(fixture.init.shape)
    expect(shapeOfMessage(find('rate_limit_event'))).toEqual(fixture.rateLimit.shape)
    expect(shapeOfMessage(find('result'))).toEqual(fixture.result.shape)
    expect([...(find('system')['tools'] as string[])].sort()).toEqual(expectedRunTools())
  })

  it('막힌 첫 구조화 출력 뒤 다음 것을 내고, 결과의 structured_output이 그것이다', () => {
    expect(find('result')['structured_output']).toEqual({ note: 'second' })
    const so = got.filter(
      (g) => g.event === 'PreToolUse' && g.body['tool_name'] === STRUCTURED_OUTPUT_TOOL,
    )
    expect(so.length).toBe(2)
  })

  it('훅 본문이 녹화본과 필드와 타입이 같다', () => {
    const diffs: string[] = []
    for (const g of got) {
      const real = hookFixture.events[g.event]?.shape
      if (!real) continue
      const fake = shapeOf(g.body)
      for (const k of new Set([...Object.keys(real), ...Object.keys(fake)]))
        if (real[k] !== fake[k])
          diffs.push(`${g.event}.${k}: 실제 ${real[k] ?? '없음'}, 가짜 ${fake[k] ?? '없음'}`)
    }
    expect([...new Set(diffs)]).toEqual([])
    const stops = got.filter((g) => g.event === 'Stop')
    expect(stops.map((s) => (s.body['background_tasks'] as unknown[]).length)).toEqual([1, 0])
    const task = (stops[0]?.body['background_tasks'] as Record<string, unknown>[])[0] ?? {}
    expect(shapeOfMessage(task)).toEqual(fixture.backgroundTask)
  })
})
