// 계약: relay가 실제 claude(Claude Code)에 기대는 것 (docs/implementation.md 8.1의 [계약]).
// 가짜 claude(test/support/fake-claude)는 이 계약을 지켜야 [흐름]의 통과가 실제에서도 뜻이 있다. 실제 claude가 이
// 계약을 지키는지는 녹화본(fixtures/claude.json)과 live.test.ts로 본다.
//
// - 훅 본문: 앱이 읽는 필드와 그 타입(src/main/work.ts, src/core/approval.ts). 앱이 읽지 않는 필드는 계약에 넣지 않는다.
// - 실행 인자: 앱이 claude에 넘기는 옵션(src/core/settings.ts의 launchArgs·resumeArgs·cleanupArgs,
//   src/adapters/claude.ts의 claudeJsonArgs). 실제 claude의 --help에 모두 있어야 한다.
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { claudeJsonArgs } from '../../src/adapters/claude'
import {
  cleanupArgs,
  HOOK_EVENTS,
  launchArgs,
  resumeArgs,
  type HookEvent,
} from '../../src/core/settings'

export type FieldType = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object'

/** 모든 훅 본문에 있는 필드 (Claude Code 문서 hooks, 스파이크 S2) */
const COMMON: Record<string, FieldType> = {
  session_id: 'string',
  transcript_path: 'string',
  cwd: 'string',
  hook_event_name: 'string',
}

const TOOL: Record<string, FieldType> = {
  tool_name: 'string',
  tool_input: 'object',
  tool_use_id: 'string',
}

/** 이벤트마다 앱이 읽는 필드 */
export const HOOK_CONTRACT: Record<HookEvent, Record<string, FieldType>> = {
  // turn.started의 권한 모드 (D17)
  UserPromptSubmit: { ...COMMON, prompt: 'string', permission_mode: 'string' },
  // 진행 표시(D216)는 tool_name·tool_input·tool_use_id·cwd를, 질문 대기(D24)는 tool_name을 읽는다
  PreToolUse: { ...COMMON, ...TOOL },
  PostToolUse: { ...COMMON, ...TOOL },
  PostToolUseFailure: { ...COMMON, ...TOOL },
  Notification: { ...COMMON, notification_type: 'string' },
  // 되돌림에 이어진 Stop(D107), 백그라운드 작업을 기다리는 세션(D129)
  Stop: {
    ...COMMON,
    stop_hook_active: 'boolean',
    background_tasks: 'array',
    session_crons: 'array',
  },
  SessionEnd: { ...COMMON, reason: 'string' },
}

/** 실제 claude에서 녹화하지 못하는 이벤트와 까닭. live.test.ts는 claude -p로 돌아 이 이벤트가 오지 않는다 */
export const NOT_RECORDED: Partial<Record<HookEvent, string>> = {
  Notification: '대화형 세션에서만 온다. [실제]가 본다',
}

export function typeOf(v: unknown): FieldType {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  const t = typeof v
  return t === 'string' || t === 'number' || t === 'boolean' ? t : 'object'
}

/** 본문의 맨 위 필드마다 타입 */
export function shapeOf(body: Record<string, unknown>): Record<string, FieldType> {
  return Object.fromEntries(
    Object.keys(body)
      .sort()
      .map((k) => [k, typeOf(body[k])]),
  )
}

/** 계약을 어긴 것. 비어 있으면 지킨다 */
export function violations(event: HookEvent, body: Record<string, unknown>): string[] {
  const out: string[] = []
  if (body['hook_event_name'] !== event)
    out.push(`hook_event_name이 ${JSON.stringify(body['hook_event_name'])}`)
  for (const [k, t] of Object.entries(HOOK_CONTRACT[event])) {
    if (!(k in body)) out.push(`${k} 없음`)
    else if (typeOf(body[k]) !== t) out.push(`${k}의 타입이 ${typeOf(body[k])} (기대 ${t})`)
  }
  return out
}

/** 앱이 claude에 넘기는 옵션 이름 (값은 뺀다) */
export function appFlags(): string[] {
  const p = '/x'
  const args = [
    ...launchArgs({
      sessionId: 'id',
      workDir: p,
      settingsPath: p,
      skill: 'work-start',
      contextPath: p,
    }),
    ...resumeArgs({ sessionId: 'id', workDir: p, settingsPath: p, prompt: '이어서' }),
    ...cleanupArgs(p),
    ...claudeJsonArgs({ model: 'm', effort: 'low', system: 's', schema: {} }),
  ]
  return [...new Set(args.filter((a) => /^--?[a-z]/.test(a)))].sort()
}

/** claude --help에 나온 옵션 이름 (-p처럼 짧은 이름과 --print처럼 긴 이름 모두) */
export function helpFlags(help: string): string[] {
  return [...new Set(help.match(/(?<![\w-])--?[a-z][\w-]*/g) ?? [])].sort()
}

export interface Recorded {
  event: HookEvent
  authorization: string | undefined
  body: Record<string, unknown>
}

/** 훅을 받아 모으는 서버. URL은 앱과 같이 /hook/<task-id>/<Event>다 (I13) */
export async function hookCollector(): Promise<{
  port: number
  got: Recorded[]
  close: () => Promise<void>
}> {
  const got: Recorded[] = []
  const server = http.createServer((req, res) => {
    let text = ''
    req.on('data', (c: Buffer) => (text += c.toString('utf8')))
    req.on('end', () => {
      const event = /^\/hook\/[^/]+\/([A-Za-z]+)$/.exec(req.url ?? '')?.[1] as HookEvent | undefined
      if (event && (HOOK_EVENTS as readonly string[]).includes(event)) {
        try {
          got.push({
            event,
            authorization: req.headers.authorization,
            body: JSON.parse(text) as Record<string, unknown>,
          })
        } catch {
          // 본문이 JSON이 아니면 계약 위반으로 남긴다
          got.push({ event, authorization: req.headers.authorization, body: { invalid: text } })
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('{}')
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  return {
    port: (server.address() as AddressInfo).port,
    got,
    close: () => new Promise((r) => server.close(() => r())),
  }
}

/** 녹화본: 실제 claude에서 받은 훅 본문의 모양과 가린 예시, --help의 옵션 */
export interface ClaudeFixture {
  claudeVersion: string
  recordedAt: string
  /** 앱이 넘기는 옵션 가운데 --help에 있던 것 */
  flags: string[]
  events: Partial<Record<HookEvent, { shape: Record<string, FieldType>; sample: object }>>
}

export const FIXTURE = path.join(__dirname, 'fixtures', 'claude.json')

export function readFixture(): ClaudeFixture {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as ClaudeFixture
}

/** 예시 본문에서 실행마다 바뀌는 값(id, 경로)을 가린다 */
export function redact(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (/(^|_)(id|path)$|^cwd$/.test(k) && typeof v === 'string') out[k] = `<${k}>`
    else if (k === 'tool_response' || k === 'last_assistant_message') out[k] = `<${typeOf(v)}>`
    else out[k] = v
  }
  return out
}
