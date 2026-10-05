// 아주 작은 로그. 시험에서는 records로 확인한다
export const records = []
let quiet = true

function write(level, msg, data) {
  const rec = { level, msg, ...(data ? { data } : {}) }
  records.push(rec)
  if (!quiet) console.log(`[${level}] ${msg}`, data ?? '')
}

export const log = {
  info: (msg, data) => write('info', msg, data),
  warn: (msg, data) => write('warn', msg, data),
  error: (msg, data) => write('error', msg, data),
}

export function setQuiet(q) {
  quiet = q
}

export function clearLog() {
  records.length = 0
}
