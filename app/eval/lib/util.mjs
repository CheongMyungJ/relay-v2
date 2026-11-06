// 평가 도구의 작은 도움 함수
import { execFileSync, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

/**
 * 화면이 멈췄는지 가를 때 Claude Code 터미널에서 시계만 따라 바뀌는 것을 가린다(docs/eval.md의 같은 깨우기, 앱의
 * [data-tick]과 같은 원칙). 스피너 줄과 도구의 경과 시간("12s", "1m 5s", "thought for 3s"), 스피너 그림(· ✢ * ✶ ✻ ✽),
 * 도는 도구의 깜빡이는 점(●)이다. 토큰 수처럼 모델이 내는 것은 그대로 둔다. 그래서 MCP 도구가 사람의 답을 기다리거나
 * 명령이 오래 돌 때처럼 시계만 도는 화면은 멈춘 화면이다. 사람 역할이 보는 글자에는 그대로 있다. 세 쪽(relay, relay-v3,
 * 맨 CLI)에 똑같이 쓴다
 */
export function withoutClock(terminal) {
  return String(terminal ?? '')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) =>
      line
        .replace(/^(\s*)[·✢✳✶✻✽*●⏺](?=\s|$)/u, '$1 ')
        // "59s"에서 "1m 0s"로 넘어가도 같게: 붙은 단위들을 한 덩어리로 가린다
        .replace(/\b\d+(?:\.\d+)?(?:ms|[smhd])(?:\s\d+(?:\.\d+)?(?:ms|[smhd]))*\b/g, '#'),
    )
    .join('\n')
}

/** .git과 node_modules를 빼고 폴더를 복사한다 */
/**
 * 시스템 임시 폴더에 새 폴더를 만들어 fn(폴더)을 부르고, 끝나면(던져도) 지운다. fn이 Promise를 돌려주면 그것이 끝난 뒤 지운다.
 * 장기 평가의 판정과 봉인 과제가 숨긴 시험을 줄의 작업 폴더(에이전트가 닿는 곳) 밖에 두고 남기지 않으려고 쓴다
 */
export function withTempDir(prefix, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  const done = () => fs.rmSync(dir, { recursive: true, force: true })
  let out
  try {
    out = fn(dir)
  } catch (e) {
    done()
    throw e
  }
  if (out && typeof out.then === 'function') return out.finally(done)
  done()
  return out
}

export function copyTree(from, to) {
  fs.rmSync(to, { recursive: true, force: true })
  fs.cpSync(from, to, {
    recursive: true,
    filter: (src) => {
      const b = path.basename(src)
      // .relay-out: relay-v3 품질 기준의 명령이 쓰는 JUnit 출력(세션이 그 명령을 직접 돌리면 생김). 모든 쪽에 같게 뺀다
      return b !== '.git' && b !== 'node_modules' && b !== '.relay-out'
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

/**
 * 설정 폴더(CLAUDE_CONFIG_DIR)의 대화 기록에서 메시지 id마다 마지막 줄의 토큰 사용량을 모은다. Claude Code는 메시지
 * 하나를 여러 줄에 나눠 쓰고, 앞 줄의 output_tokens는 아직 다 세지 않은 값이다. 세션은 대화 기록 파일 이름
 * (<세션 id>.jsonl)이고, 세션 폴더 아래의 서브에이전트 기록(<세션 id>/…)은 그 세션에 넣는다. agentUsage와
 * agentUsageBySession이 함께 써서 두 합계가 어긋나지 않는다
 */
function scanUsage(configDir) {
  const messages = new Map()
  const sessions = new Set()
  let files = 0
  const dir = path.join(configDir, 'projects')
  if (!fs.existsSync(dir)) return { messages, sessions, files }
  for (const project of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!project.isDirectory()) continue
    const root = path.join(dir, project.name)
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) {
          walk(p)
          continue
        }
        if (!e.name.endsWith('.jsonl')) continue
        files++
        const first = path.relative(root, p).split(path.sep)[0] ?? ''
        const session = first.endsWith('.jsonl') ? first.slice(0, -'.jsonl'.length) : first
        sessions.add(session)
        for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
          if (!line.includes('"usage"')) continue
          try {
            const m = JSON.parse(line).message
            // 같은 id의 뒤 줄이 앞 줄을 덮는다
            if (m?.usage && m.id) messages.set(m.id, { session, usage: m.usage })
          } catch {
            // 쓰는 중인 줄
          }
        }
      }
    }
    walk(root)
  }
  return { messages, sessions, files }
}

const noUsage = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, messages: 0 })

function addUsage(total, u) {
  total.input += u.input_tokens ?? 0
  total.output += u.output_tokens ?? 0
  total.cacheRead += u.cache_read_input_tokens ?? 0
  total.cacheWrite += u.cache_creation_input_tokens ?? 0
  total.messages++
}

/** 에이전트의 토큰 사용량을 세션마다 더한다 (relay의 단계별 토큰, eval-findings R9). 메시지가 없는 세션은 0이다 */
export function agentUsageBySession(configDir) {
  const { messages, sessions } = scanUsage(configDir)
  const out = new Map([...sessions].map((s) => [s, noUsage()]))
  for (const { session, usage } of messages.values()) addUsage(out.get(session), usage)
  return out
}

/** 에이전트의 토큰 사용량을 모두 더한다. sessions는 대화 기록 파일 수다(서브에이전트 기록 포함) */
export function agentUsage(configDir) {
  const { messages, files } = scanUsage(configDir)
  const total = { ...noUsage(), sessions: files }
  for (const { usage } of messages.values()) addUsage(total, usage)
  return total
}

/**
 * 세션마다 에이전트가 사람에게 물은 수 (대화 기록의 AskUserQuestion 도구 호출). 같은 호출 id는 한 번 센다.
 * 서브에이전트 기록은 그 세션에 넣는다
 */
export function questionsBySession(configDir) {
  const out = new Map()
  const seen = new Set()
  const dir = path.join(configDir, 'projects')
  if (!fs.existsSync(dir)) return out
  for (const project of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!project.isDirectory()) continue
    const root = path.join(dir, project.name)
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) {
          walk(p)
          continue
        }
        if (!e.name.endsWith('.jsonl')) continue
        const first = path.relative(root, p).split(path.sep)[0] ?? ''
        const session = first.endsWith('.jsonl') ? first.slice(0, -'.jsonl'.length) : first
        if (!out.has(session)) out.set(session, 0)
        for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
          if (!line.includes('"AskUserQuestion"')) continue
          try {
            const content = JSON.parse(line).message?.content
            for (const c of Array.isArray(content) ? content : []) {
              if (c?.type !== 'tool_use' || c.name !== 'AskUserQuestion' || seen.has(c.id)) continue
              seen.add(c.id)
              out.set(session, (out.get(session) ?? 0) + 1)
            }
          } catch {
            // 쓰는 중인 줄
          }
        }
      }
    }
    walk(root)
  }
  return out
}

/**
 * 이 모듈을 node로 바로 돌렸는가(가져다 쓴 것이 아니라). import.meta.url은 실제 경로이고 argv[1]은 넘긴 경로 그대로라
 * symlink, junction, 드라이브 문자 대소문자에서 어긋나므로 둘 다 실제 경로로 맞춰 견준다 (PR #36 리뷰)
 */
export function isMain(metaUrl) {
  const arg = process.argv[1]
  if (!arg) return false
  try {
    return fs.realpathSync(fileURLToPath(metaUrl)) === fs.realpathSync(arg)
  } catch {
    return false
  }
}
