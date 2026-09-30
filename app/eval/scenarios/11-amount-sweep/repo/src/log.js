// 간단한 로거. 기본은 stderr로 쓰고, 시험에서는 sink를 바꿔 끼운다
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 }

let current = 'info'
let sink = (line) => process.stderr.write(line + '\n')

export function setLevel(level) {
  if (!(level in LEVELS)) throw new Error(`알 수 없는 로그 수준: ${level}`)
  current = level
}

export function getLevel() {
  return current
}

export function setSink(fn) {
  const prev = sink
  sink = fn
  return prev
}

function write(level, message, fields) {
  if (LEVELS[level] < LEVELS[current]) return
  const time = new Date().toISOString()
  const extra = fields && Object.keys(fields).length
    ? ' ' + Object.entries(fields).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')
    : ''
  sink(`${time} ${level.toUpperCase().padEnd(5)} ${message}${extra}`)
}

export const log = {
  debug: (msg, fields) => write('debug', msg, fields),
  info: (msg, fields) => write('info', msg, fields),
  warn: (msg, fields) => write('warn', msg, fields),
  error: (msg, fields) => write('error', msg, fields),
}

// 시험용: 함수 f를 도는 동안 남긴 로그 줄을 모은다
export function captureLogs(f) {
  const lines = []
  const prevSink = setSink((line) => lines.push(line))
  const prevLevel = current
  current = 'debug'
  try {
    f()
  } finally {
    setSink(prevSink)
    current = prevLevel
  }
  return lines
}
