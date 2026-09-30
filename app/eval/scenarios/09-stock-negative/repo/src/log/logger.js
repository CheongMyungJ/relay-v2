const ORDER = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 }

function consoleSink(entry) {
  const line = `${entry.time} ${entry.level.toUpperCase()} [${entry.scope}] ${entry.message}`
  if (entry.level === 'error' || entry.level === 'warn') console.error(line)
  else console.log(line)
}

/**
 * 간단한 로거. sink를 주면 콘솔 대신 그리로 보낸다(시험에서는 배열에 모은다).
 */
export function createLogger({ level = 'info', sink = consoleSink, clock, scope = 'stock' } = {}) {
  const min = ORDER[level] ?? ORDER.info
  const time = () => (clock ? clock.iso() : new Date().toISOString())

  function write(lv, message, fields) {
    if (ORDER[lv] < min) return
    sink({ time: time(), level: lv, scope, message, ...(fields ? { fields } : {}) })
  }

  return {
    debug: (m, f) => write('debug', m, f),
    info: (m, f) => write('info', m, f),
    warn: (m, f) => write('warn', m, f),
    error: (m, f) => write('error', m, f),
    child(name) {
      return createLogger({ level, sink, clock, scope: `${scope}.${name}` })
    },
  }
}

/** 메모리에 모으는 sink. entries로 꺼내 본다 */
export function memorySink() {
  const entries = []
  const sink = (e) => entries.push(e)
  sink.entries = entries
  return sink
}
