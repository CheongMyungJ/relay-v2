// 구조화 로그. 한 줄에 JSON 하나.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }

export function createLogger({ level = 'info', write = (line) => console.log(line), clock, base = {} } = {}) {
  const min = LEVELS[level] ?? LEVELS.info

  function log(lvl, msg, fields = {}) {
    if (LEVELS[lvl] < min) return
    const entry = { level: lvl, msg, ...base, ...fields }
    if (clock) entry.time = new Date(clock.now()).toISOString()
    write(JSON.stringify(entry, replacer))
  }

  return {
    debug: (msg, fields) => log('debug', msg, fields),
    info: (msg, fields) => log('info', msg, fields),
    warn: (msg, fields) => log('warn', msg, fields),
    error: (msg, fields) => log('error', msg, fields),
    child: (more) => createLogger({ level, write, clock, base: { ...base, ...more } }),
  }
}

/** 기록만 하고 출력하지 않는 로거. 시험에서 쓴다 */
export function createMemoryLogger({ clock } = {}) {
  const lines = []
  const logger = createLogger({ level: 'debug', clock, write: (line) => lines.push(JSON.parse(line)) })
  return Object.assign(logger, {
    lines,
    find: (msg) => lines.filter((l) => l.msg === msg),
  })
}

export const silentLogger = createLogger({ write: () => {} })

function replacer(_key, value) {
  if (value instanceof Error) return { name: value.name, message: value.message, code: value.code }
  return value
}
