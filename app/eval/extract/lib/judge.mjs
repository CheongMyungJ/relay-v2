// 판정 모델 호출 하나: 도구 없음, 세션 저장 없음, 사용자 설정·MCP 없음(run과 같은 격리, 녹화 3·4), 구조화 출력.
// eval/lib/ai.mjs의 ask와 같은 꼴이되 --strict-mcp-config와 --setting-sources ''를 더한다(사람의 PC에서는 claude.ai
// 커넥터의 MCP 도구가 실린다, 녹화 1).
import { spawn } from 'node:child_process'
import { cleanEnv } from '../../lib/env.mjs'

export function judgeArgs({ model, system, schema }) {
  return [
    '-p',
    '--model',
    model,
    '--output-format',
    'json',
    '--system-prompt',
    system,
    '--json-schema',
    JSON.stringify(schema),
    '--tools',
    '',
    '--strict-mcp-config',
    '--setting-sources',
    '',
    '--no-session-persistence',
  ]
}

/** @returns {Promise<{ data: object, costUsd: number | null, ms: number }>} */
export function callJudge({ bin, model, system, schema, prompt, cwd, timeoutMs = 300_000 }) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const p = spawn(bin, judgeArgs({ model, system, schema }), {
      cwd,
      env: cleanEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      p.kill()
      reject(new Error(`판정 시간 초과 (${timeoutMs}ms)`))
    }, timeoutMs)
    p.stdout.on('data', (c) => (out += c))
    p.stderr.on('data', (c) => (err += c))
    p.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    p.on('close', (code) => {
      clearTimeout(timer)
      let j
      try {
        j = JSON.parse(out)
      } catch {
        return reject(
          new Error(`판정 출력이 JSON이 아님 (code ${code}): ${(err || out).slice(0, 300)}`),
        )
      }
      if (j.is_error || !j.structured_output)
        return reject(new Error(`판정 실패: ${j.subtype} ${String(j.result).slice(0, 300)}`))
      resolve({
        data: j.structured_output,
        costUsd: j.total_cost_usd ?? null,
        ms: Date.now() - started,
      })
    })
    p.stdin.end(prompt)
  })
}
