// 단계(level)가 있는 로거. 기본 출력은 stderr이고, 시험에서는 sink를 바꿔 모은다.
import { now } from '../clock.js'

function pad(n, width = 2) {
  return String(n).padStart(width, '0')
}

/** 2026-09-30 02:15:04.120 형식(UTC) */
export function timestamp(ms) {
  const d = new Date(ms)
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`
  )
}

function value(v) {
  if (v === null || v === undefined) return String(v)
  if (typeof v === 'string') return /[\s"=]/.test(v) ? JSON.stringify(v) : v
  if (v instanceof Error) return JSON.stringify(v.message)
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** key=value 꼴의 필드 */
export function fields(obj = {}) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${value(v)}`)
    .join(' ')
}

/** 로그 한 줄: "2026-09-30 02:15:04.120 WARN  [runner] 메시지 jobId=job-3" */
export function formatLine({ time, level, scope, message, data }) {
  const head = `${timestamp(time)} ${level.toUpperCase().padEnd(5)}`
  const where = scope ? ` [${scope}]` : ''
  const rest = data && Object.keys(data).length ? ` ${fields(data)}` : ''
  return `${head}${where} ${message}${rest}`
}

const ORDER = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 }

const stderrSink = (line) => process.stderr.write(`${line}\n`)

/**
 * @param {object} [o]
 * @param {string} [o.level] debug | info | warn | error | silent
 * @param {string} [o.scope] 로그 앞에 붙는 이름
 * @param {(line: string, entry: object) => void} [o.sink]
 */
export function createLogger(o = {}) {
  const level = o.level ?? 'warn'
  if (!(level in ORDER)) throw new Error(`알 수 없는 로그 단계: ${level}`)
  const sink = o.sink ?? stderrSink
  const threshold = ORDER[level]

  function write(lvl, message, data) {
    if (ORDER[lvl] < threshold) return
    const entry = { time: now(), level: lvl, scope: o.scope, message, data }
    sink(formatLine(entry), entry)
  }

  return {
    level,
    debug: (m, d) => write('debug', m, d),
    info: (m, d) => write('info', m, d),
    warn: (m, d) => write('warn', m, d),
    error: (m, d) => write('error', m, d),
    /** 같은 설정에 scope만 바꾼 로거 */
    child: (scope) => createLogger({ level, sink, scope: o.scope ? `${o.scope}:${scope}` : scope }),
  }
}

/** 로그를 배열에 모으는 로거(시험용) */
export function memoryLogger(level = 'debug') {
  const lines = []
  const entries = []
  const logger = createLogger({
    level,
    sink: (line, entry) => {
      lines.push(line)
      entries.push(entry)
    },
  })
  return { logger, lines, entries }
}

/** 아무것도 쓰지 않는 로거 */
export const silentLogger = createLogger({ level: 'silent' })
