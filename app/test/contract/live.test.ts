// [계약] 실제 쪽: 실제 claude가 아직 계약(claude.ts)과 녹화본(fixtures/claude.json)대로인지 본다. 사용량이 조금 든다.
// RELAY_CONTRACT_LIVE=1일 때만 돈다(app-claude 워크플로의 정기 실행, Claude Code를 올릴 때). 없으면 건너뛴다.
// RELAY_CONTRACT_UPDATE=1이면 녹화본을 새로 쓴다. 녹화본이 바뀌면 fakes.test.ts가 가짜 claude를 따라오게 한다.
//
// 1. claude --help에 앱이 넘기는 옵션이 모두 있다
// 2. claude -p를 앱과 같은 훅 설정(--settings, hookSettings)으로 돌려 오는 훅 본문이 계약을 지킨다. 훅 머리글의
//    $RELAY_HOOK_TOKEN이 풀려 온다(I13). 도구 성공과 실패(PostToolUseFailure)를 하나씩 부르게 한다. 첫 Stop을 되돌리면
//    일을 잇고 다음 Stop에 stop_hook_active: true를 보낸다(S2, D21)
// 3. 지식 검토 호출(claudeJson, D300)이 구조화된 출력과 사용량을 읽는다
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { cleanEnv, makeClaudeConfig } from '../../eval/lib/env.mjs'
import { claudeJson } from '../../src/adapters/claude'
import { HOOK_TOKEN_ENV, hookSettings, type HookEvent } from '../../src/core/settings'
import {
  appFlags,
  FIXTURE,
  helpFlags,
  hookCollector,
  NOT_RECORDED,
  readFixture,
  redact,
  shapeOf,
  violations,
  type ClaudeFixture,
  type Recorded,
} from './claude'

const LIVE = process.env['RELAY_CONTRACT_LIVE'] === '1'
const UPDATE = process.env['RELAY_CONTRACT_UPDATE'] === '1'
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

  it('녹화본과 견준다 (RELAY_CONTRACT_UPDATE=1이면 새로 쓴다)', () => {
    expect(got.length).toBeGreaterThan(0)
    const events: ClaudeFixture['events'] = {}
    for (const g of got) {
      // 이벤트마다 처음 받은 것을 남긴다. PreToolUse와 PostToolUse는 성공한 도구의 것이다
      if (!events[g.event]) events[g.event] = { shape: shapeOf(g.body), sample: redact(g.body) }
    }
    const now: ClaudeFixture = {
      claudeVersion: version,
      recordedAt: new Date().toISOString().slice(0, 10),
      flags,
      events,
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
