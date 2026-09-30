// 작은 로거. 수준 이하 기록은 버린다.

import { consoleSink } from './sinks.js'

export const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 }

export function createLogger({ scope = 'app', level = 'info', sink = consoleSink, now = Date.now } = {}) {
  if (!(level in LEVELS)) throw new RangeError(`모르는 로그 수준: ${level}`)
  const threshold = LEVELS[level]

  function write(lvl, message, fields) {
    if (LEVELS[lvl] < threshold) return
    sink({ time: now(), level: lvl, scope, message, fields: fields ?? {} })
  }

  return {
    level,
    scope,
    debug: (msg, fields) => write('debug', msg, fields),
    info: (msg, fields) => write('info', msg, fields),
    warn: (msg, fields) => write('warn', msg, fields),
    error: (msg, fields) => write('error', msg, fields),
    // 같은 sink와 수준으로 범위만 바꾼 로거
    child: (childScope) => createLogger({ scope: `${scope}.${childScope}`, level, sink, now }),
    // fn을 실행하고 걸린 시간을 기록한다
    time(label, fn, fields) {
      const started = now()
      try {
        return fn()
      } finally {
        write('debug', label, { ...fields, ms: now() - started })
      }
    },
  }
}
