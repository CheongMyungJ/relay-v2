// 계약: 요구사항 추출 extract의 헤드리스 run(claude -p, 도구 켬)이 실제 claude에 기대는 것
// (docs/requirements-extraction-flow.md 15.3, 16.2, 16.11 녹화). 앱의 run 실행은 아직 없고, 평가 하네스
// (eval/extract)가 같은 실행 인자(skills/extract/run.mjs의 runArgs)로 먼저 쓴다.
// 녹화본은 fixtures/claude-run.json이고, live-run.test.ts가 RELAY_CONTRACT_LIVE=1에서 실제 claude로 다시 녹화한다.
// 가짜 run(test/support/fake-claude/print-run.mjs)은 이 녹화본에 있는 필드만 낸다(fakes-run.test.ts).
//
// - stream-json의 system/init: 도구·MCP·스킬·플러그인을 보고 run이 격리됐는지 확인한다(녹화 3, 4)
// - stream-json의 rate_limit_event: 사용량 한도의 종류와 재설정 시각(결정 29)
// - stream-json의 result: 끝 판정(결정 3, 15.3)과 비용·시간(결정 30 보정)
// - 훅: 구조화 출력은 PreToolUse의 StructuredOutput 도구 호출로 잡힌다(결정 13의 1번 길). 읽기 도구의 tool_input(16.8 5번).
//   Stop의 background_tasks 항목(15.3 3번)
import fs from 'node:fs'
import path from 'node:path'
import { RUN_TOOLS, runArgs } from '../../../skills/extract/run.mjs'
import { typeOf, type FieldType } from './claude'

/** stream-json의 result 메시지에서 run이 읽는 필드 */
export const RESULT_CONTRACT: Record<string, FieldType> = {
  type: 'string',
  subtype: 'string',
  is_error: 'boolean',
  num_turns: 'number',
  duration_ms: 'number',
  total_cost_usd: 'number',
  usage: 'object',
  modelUsage: 'object',
  session_id: 'string',
  terminal_reason: 'string',
  permission_denials: 'array',
}

/** 성공한 run의 result에만 있는 필드. 구조화 출력이 없이 끝나도 subtype은 success다(녹화) */
export const RESULT_SUCCESS_ONLY: Record<string, FieldType> = { structured_output: 'object' }

/** system/init에서 격리 확인에 읽는 필드 */
export const INIT_CONTRACT: Record<string, FieldType> = {
  type: 'string',
  subtype: 'string',
  session_id: 'string',
  tools: 'array',
  mcp_servers: 'array',
  skills: 'array',
  slash_commands: 'array',
  plugins: 'array',
  model: 'string',
  claude_code_version: 'string',
}

/** rate_limit_event에서 읽는 필드. rate_limit_info 안은 RATE_LIMIT_INFO_CONTRACT */
export const RATE_LIMIT_CONTRACT: Record<string, FieldType> = {
  type: 'string',
  rate_limit_info: 'object',
}

export const RATE_LIMIT_INFO_CONTRACT: Record<string, FieldType> = {
  status: 'string',
  resetsAt: 'number',
  rateLimitType: 'string',
}

/** 읽기 도구의 tool_input에서 읽는 필드(16.8 5번). Grep·Glob의 path는 모델이 줄 때만 있다 */
export const TOOL_INPUT_CONTRACT: Record<string, Record<string, FieldType>> = {
  Read: { file_path: 'string' },
  Grep: { pattern: 'string' },
  Glob: { pattern: 'string' },
}

/** 구조화 출력을 내는 도구의 이름. PreToolUse에서 막으면 모델이 이유를 받고 다시 낸다(녹화 2) */
export const STRUCTURED_OUTPUT_TOOL = 'StructuredOutput'

/** Stop 본문의 background_tasks 항목에서 읽는 필드 */
export const BACKGROUND_TASK_CONTRACT: Record<string, FieldType> = {
  id: 'string',
  status: 'string',
}

/** run의 init에 있어야 하는 도구: run 도구와 구조화 출력 도구뿐이다 */
export function expectedRunTools(): string[] {
  return [...RUN_TOOLS, STRUCTURED_OUTPUT_TOOL].sort()
}

/** 계약을 어긴 것. 비어 있으면 지킨다 */
export function fieldViolations(
  contract: Record<string, FieldType>,
  body: Record<string, unknown>,
  where: string,
): string[] {
  const out: string[] = []
  for (const [k, t] of Object.entries(contract)) {
    if (!(k in body)) out.push(`${where}.${k} 없음`)
    else if (typeOf(body[k]) !== t)
      out.push(`${where}.${k}의 타입이 ${typeOf(body[k])} (기대 ${t})`)
  }
  return out
}

/** run이 claude에 넘기는 옵션 이름 (값은 뺀다) */
export function runFlags(): string[] {
  const args = runArgs({
    model: 'm',
    effort: 'low',
    schema: '{}',
    instructionsPath: '/x',
    settingsPath: '/x',
    addDirs: ['/x'],
    sessionId: 'id',
  })
  return [...new Set(args.filter((a) => /^--?[a-z]/.test(a)))].sort()
}

export interface Shaped {
  shape: Record<string, FieldType>
  sample: object
}

/** 녹화본: 실제 claude의 run에서 받은 모양 */
export interface RunFixture {
  claudeVersion: string
  recordedAt: string
  /** run이 넘기는 옵션 가운데 --help에 있던 것 */
  flags: string[]
  init: Shaped
  rateLimit: Shaped & { info: Record<string, FieldType> }
  result: Shaped
  /** 읽기 도구와 구조화 출력 도구의 tool_input 모양 */
  toolInputs: Record<string, Record<string, FieldType>>
  /** 백그라운드 작업이 남은 Stop의 background_tasks 항목 모양 */
  backgroundTask: Record<string, FieldType>
  /** 녹화 때 본 동작 */
  behavior: {
    /** 첫 StructuredOutput을 PreToolUse에서 막으면 다시 냈는가 */
    structuredOutputResubmitted: boolean
    /** 백그라운드 작업이 남았던 Stop 뒤에도 프로세스가 기다렸다가 끝났는가 */
    waitedForBackground: boolean
  }
}

export const RUN_FIXTURE = path.join(__dirname, 'fixtures', 'claude-run.json')

export function readRunFixture(): RunFixture {
  return JSON.parse(fs.readFileSync(RUN_FIXTURE, 'utf8')) as RunFixture
}

/** 맨 위 필드마다 타입 (shapeOf와 같되 키 순서를 고정) */
export function shapeOfMessage(m: Record<string, unknown>): Record<string, FieldType> {
  return Object.fromEntries(
    Object.keys(m)
      .sort()
      .map((k) => [k, typeOf(m[k])]),
  )
}

/** 예시에서 실행마다 바뀌는 값(id, 경로, uuid, 시각)과 긴 값을 가린다 */
export function redactMessage(m: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(m)) {
    if (/(^|_)(id|path)$|^(cwd|uuid|session_id|messaging_socket_path|powershell_path)$/.test(k))
      out[k] = `<${k}>`
    else if (k === 'result' && typeof v === 'string') out[k] = '<string>'
    else out[k] = v
  }
  return out
}
