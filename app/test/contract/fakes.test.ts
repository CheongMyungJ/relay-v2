// [계약] 가짜 쪽: 가짜 claude가 계약(claude.ts)을 지키고, 실제 claude의 녹화본(fixtures/claude.json)과 같은 모양의
// 훅 본문을 보내는지 본다. 모델을 부르지 않는다. [흐름]은 가짜 claude로 돌므로, 가짜가 실제와 어긋나면 [흐름]의
// 통과가 실제에서 뜻이 없어진다(docs/implementation.md 8.2).
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  HOOK_EVENTS,
  HOOK_TOKEN_ENV,
  hookSettings,
  launchArgs,
  type HookEvent,
} from '../../src/core/settings'
import type { Step } from '../support/scenarios'
import {
  appFlags,
  helpFlags,
  HOOK_CONTRACT,
  hookCollector,
  NOT_RECORDED,
  readFixture,
  shapeOf,
  violations,
  type Recorded,
} from './claude'

const FAKE = path.resolve(__dirname, '../support/fake-claude/fake-claude.mjs')

/**
 * 가짜 claude가 실제에 없는 필드를 보내도 되는 경우. 녹화본에 없는 상황의 필드라 견줄 수 없다
 */
const FAKE_ONLY: Record<string, string> = {
  agent_id: '서브에이전트 안의 도구 (녹화는 서브에이전트를 부르지 않는다)',
  agent_type: '서브에이전트 안의 도구',
}

/** 모든 훅 이벤트를 한 번 이상 보내는 가짜 claude의 시나리오 */
const STEPS: Step[] = [
  { do: 'prompt' },
  { do: 'tool', name: 'Bash', input: { command: 'echo contract-ok', description: 'echo' } },
  { do: 'tool', name: 'Bash', input: { command: 'exit 3', description: 'exit' }, fail: true },
  { do: 'ask', question: '어느 쪽?' },
  { do: 'ask', question: '거절하면?', fail: true },
  { do: 'notify', type: 'idle_prompt' },
  { do: 'stop' },
  { do: 'exit', reason: 'other' },
]

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-contract-fake-'))
let got: Recorded[] = []

beforeAll(async () => {
  const server = await hookCollector()
  try {
    const settings = path.join(root, 'settings.json')
    fs.writeFileSync(settings, JSON.stringify({ hooks: hookSettings(server.port, 'contract') }))
    const contextPath = path.join(root, 'context.md')
    fs.writeFileSync(contextPath, `- task 디렉터리: ${root}\n- task_id: t-01\n- node: intake\n`)
    const scenario = path.join(root, 'scenario.json')
    fs.writeFileSync(scenario, JSON.stringify({ tasks: { 'work-start': STEPS } }))
    const args = launchArgs({
      sessionId: randomUUID(),
      workDir: root,
      settingsPath: settings,
      skill: 'work-start',
      contextPath,
    })
    await new Promise<void>((resolve, reject) => {
      const p = spawn(process.execPath, [FAKE, ...args], {
        cwd: root,
        env: {
          PATH: process.env['PATH'],
          [HOOK_TOKEN_ENV]: 'contract-token',
          FAKE_CLAUDE_SCENARIO: scenario,
        },
      })
      // 질문 대기(ask)는 Enter를 기다린다. 먼저 보낸 Enter도 센다
      p.stdin.write('\n\n')
      let out = ''
      p.stdout.on('data', (c: Buffer) => (out += c.toString('utf8')))
      const timer = setTimeout(() => p.kill('SIGKILL'), 30_000)
      p.on('error', reject)
      p.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0) resolve()
        else reject(new Error(`가짜 claude 종료 코드 ${code}: ${out.slice(-2000)}`))
      })
    })
    got = [...server.got]
  } finally {
    await server.close()
  }
})

afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe('[계약] 녹화본', () => {
  const fixture = readFixture()

  it('실제 claude의 녹화본이 계약을 지킨다 (계약이 실제에 없는 필드를 요구하지 않는다)', () => {
    const broken = Object.entries(fixture.events).flatMap(([e, v]) =>
      Object.entries(HOOK_CONTRACT[e as HookEvent])
        .filter(([k, t]) => v.shape[k] !== t)
        .map(([k, t]) => `${e}.${k}: 녹화본 ${v.shape[k] ?? '없음'}, 계약 ${t}`),
    )
    expect(broken).toEqual([])
  })

  it('녹화하지 않는 이벤트 말고는 모두 녹화본이 있다', () => {
    const missing = HOOK_EVENTS.filter((e) => !fixture.events[e] && !NOT_RECORDED[e])
    expect(missing).toEqual([])
  })

  it('앱이 넘기는 옵션이 모두 녹화 때의 --help에 있었다 (새 옵션을 쓰면 녹화본을 다시 만든다)', () => {
    expect(appFlags().filter((f) => !fixture.flags.includes(f))).toEqual([])
  })

  it('--help의 `--x[-file]` 표기는 두 옵션으로 읽는다 (--append-system-prompt-file, D386)', () => {
    const help =
      '  --tools <t>  Tools\n  via: --system-prompt[-file],\n  --append-system-prompt[-file], -p'
    expect(helpFlags(help)).toEqual([
      '--append-system-prompt',
      '--append-system-prompt-file',
      '--system-prompt',
      '--system-prompt-file',
      '--tools',
      '-p',
    ])
  })
})

describe('[계약] 가짜 claude', () => {
  const fixture = readFixture()

  it('모든 훅 이벤트를 보내고 머리글의 토큰이 풀린다', () => {
    const seen = new Set(got.map((g) => g.event))
    expect(HOOK_EVENTS.filter((e) => !seen.has(e))).toEqual([])
    expect(got.every((g) => g.authorization === 'Bearer contract-token')).toBe(true)
  })

  it('보내는 본문이 계약을 지킨다', () => {
    const broken = got.flatMap((g) => violations(g.event, g.body).map((v) => `${g.event}: ${v}`))
    expect(broken).toEqual([])
  })

  it('녹화본과 필드와 타입이 같다', () => {
    const diffs: string[] = []
    for (const g of got) {
      const real = fixture.events[g.event]?.shape
      if (!real) continue
      const fake = shapeOf(g.body)
      for (const k of new Set([...Object.keys(real), ...Object.keys(fake)])) {
        if (real[k] === fake[k] || (real[k] === undefined && k in FAKE_ONLY)) continue
        diffs.push(`${g.event}.${k}: 실제 ${real[k] ?? '없음'}, 가짜 ${fake[k] ?? '없음'}`)
      }
    }
    expect([...new Set(diffs)]).toEqual([])
  })
})
