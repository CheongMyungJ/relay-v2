// 사람 역할과 판정이 쓰는 claude -p 호출. 구조화된 출력(--json-schema)과 세션 잇기(--session-id, --resume)를 쓴다.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { cleanEnv, findClaude } from './env.mjs'

/**
 * claude -p를 한 번 부른다. 프롬프트는 표준 입력으로 넘긴다.
 * @param {object} o
 * @param {string} o.prompt
 * @param {string} [o.system] 기본 시스템 프롬프트를 바꾼다 (--system-prompt)
 * @param {string} o.model
 * @param {string} [o.effort]
 * @param {object} [o.schema] JSON Schema. 있으면 structured_output을 돌려준다
 * @param {string[]} [o.tools] 쓸 수 있는 도구. 비우면 도구 없음
 * @param {string[]} [o.images] 메시지에 붙일 PNG 파일
 * @param {string} [o.sessionId] 새 세션의 id
 * @param {string} [o.resume] 이어 갈 세션의 id
 * @param {string} o.cwd
 * @param {string} o.configDir CLAUDE_CONFIG_DIR
 * @param {number} [o.timeoutMs]
 * @param {number} [o.retries]
 */
export async function ask(o) {
  const retries = o.retries ?? 2
  let last
  let cur = o
  for (let i = 0; i <= retries; i++) {
    try {
      return await askOnce(cur)
    } catch (e) {
      last = e
      // 앞 시도가 세션을 만들고 실패했으면 그 세션을 잇는다
      if (cur.sessionId && /already in use|already exists/i.test(String(e))) {
        cur = { ...cur, sessionId: undefined, resume: cur.sessionId }
      }
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)))
    }
  }
  throw last
}

function askOnce(o) {
  // 이미지는 stream-json 입력의 image 블록으로 붙인다(도구로 읽게 하면 건너뛰는 일이 잦다)
  const stream = !!o.images?.length
  const args = ['-p', '--model', o.model]
  if (stream)
    args.push('--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose')
  else args.push('--output-format', 'json')
  if (o.system) args.push('--system-prompt', o.system)
  if (o.schema) args.push('--json-schema', JSON.stringify(o.schema))
  args.push('--tools', (o.tools ?? []).join(','))
  if (o.tools?.length) args.push('--allowedTools', o.tools.join(','))
  if (o.sessionId) args.push('--session-id', o.sessionId)
  else if (o.resume) args.push('--resume', o.resume)
  const env = cleanEnv({
    CLAUDE_CONFIG_DIR: o.configDir,
    CLAUDE_CODE_EFFORT_LEVEL: o.effort,
  })
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const child = spawn(findClaude(), args, { cwd: o.cwd, env, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`claude -p 시간 초과 (${o.timeoutMs ?? 300_000}ms)`))
    }, o.timeoutMs ?? 300_000)
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      let j
      try {
        j = stream
          ? out
              .split('\n')
              .filter((l) => l.startsWith('{'))
              .map((l) => JSON.parse(l))
              .find((m) => m.type === 'result')
          : JSON.parse(out)
        if (!j) throw new Error('결과 없음')
      } catch {
        return reject(
          new Error(`claude -p 출력이 JSON이 아님 (code ${code}): ${(err || out).slice(0, 500)}`),
        )
      }
      if (j.is_error) return reject(new Error(`claude -p 오류: ${String(j.result).slice(0, 500)}`))
      if (o.schema && (j.structured_output === undefined || j.structured_output === null)) {
        return reject(new Error(`구조화된 출력 없음: ${String(j.result).slice(0, 300)}`))
      }
      resolve({
        data: j.structured_output ?? null,
        text: j.result ?? '',
        costUsd: j.total_cost_usd ?? 0,
        usage: j.usage ?? null,
        sessionId: j.session_id,
        ms: Date.now() - started,
      })
    })
    if (stream) {
      const content = [
        ...o.images.map((file) => ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: fs.readFileSync(file).toString('base64'),
          },
        })),
        { type: 'text', text: o.prompt },
      ]
      child.stdin.end(`${JSON.stringify({ type: 'user', message: { role: 'user', content } })}\n`)
    } else child.stdin.end(o.prompt)
  })
}
