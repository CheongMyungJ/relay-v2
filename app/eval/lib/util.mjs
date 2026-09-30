// 평가 도구의 작은 도움 함수
import { execFileSync, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

/** 명령을 돌리고 종료 코드와 출력을 돌려준다(실패해도 던지지 않는다) */
export function run(cmd, args, o = {}) {
  const r = spawnSync(cmd, args, {
    cwd: o.cwd,
    env: o.env ?? process.env,
    encoding: 'utf8',
    timeout: o.timeoutMs ?? 120_000,
    maxBuffer: 20 * 1024 * 1024,
  })
  return {
    code: r.status ?? (r.error ? -1 : -2),
    out: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `\n${r.error.message}` : ''}`,
  }
}

export const hash = (s) => crypto.createHash('sha1').update(s).digest('hex')

/** .git과 node_modules를 빼고 폴더를 복사한다 */
export function copyTree(from, to) {
  fs.rmSync(to, { recursive: true, force: true })
  fs.cpSync(from, to, {
    recursive: true,
    filter: (src) => {
      const b = path.basename(src)
      return b !== '.git' && b !== 'node_modules'
    },
  })
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
}

export function readJson(file, fallback = null) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback
}

export function appendJsonl(file, data) {
  fs.appendFileSync(file, `${JSON.stringify(data)}\n`)
}

export function readJsonl(file) {
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
}

export const seconds = (ms) => Math.round(ms / 1000)

export function clip(s, n) {
  const t = String(s ?? '')
  return t.length > n ? `${t.slice(0, n)}\n…(${t.length - n}자 생략)` : t
}

/** 평균과 표준편차 */
export function stats(xs) {
  const v = xs.filter((x) => typeof x === 'number' && Number.isFinite(x))
  if (!v.length) return { n: 0, mean: null, sd: null }
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  const sd =
    v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1)) : 0
  return { n: v.length, mean, sd }
}

/** 설정 폴더(CLAUDE_CONFIG_DIR)의 대화 기록에서 에이전트의 토큰 사용량을 더한다. 같은 메시지 id는 한 번만 센다 */
export function agentUsage(configDir) {
  const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, messages: 0, sessions: 0 }
  const dir = path.join(configDir, 'projects')
  if (!fs.existsSync(dir)) return total
  const seen = new Map()
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.jsonl')) {
        total.sessions++
        for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
          if (!line.includes('"usage"')) continue
          try {
            const j = JSON.parse(line)
            const m = j.message
            if (m?.usage && m.id) seen.set(m.id, m.usage)
          } catch {
            // 쓰는 중인 줄
          }
        }
      }
    }
  }
  walk(dir)
  for (const u of seen.values()) {
    total.input += u.input_tokens ?? 0
    total.output += u.output_tokens ?? 0
    total.cacheRead += u.cache_read_input_tokens ?? 0
    total.cacheWrite += u.cache_creation_input_tokens ?? 0
    total.messages++
  }
  return total
}
