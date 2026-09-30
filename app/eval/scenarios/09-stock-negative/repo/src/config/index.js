// 기본 설정. loadConfig에서 환경 변수와 인자로 덮어쓴다.
export const defaults = {
  env: 'development',
  log: {
    level: 'info',
  },
  cache: {
    maxEntries: 500,
    ttlSeconds: 300,
  },
  stock: {
    // 가용 재고가 이 값 이하로 내려가면 운영팀에 알린다
    lowThreshold: 2,
  },
  pricing: {
    taxRate: 0.1,
    currency: 'KRW',
    roundTo: 10,
  },
  notify: {
    channels: ['email'],
    from: 'no-reply@stock.local',
    ops: 'ops@stock.local',
  },
  reports: {
    lowMark: '부족',
  },
}

const LEVELS = ['debug', 'info', 'warn', 'error', 'silent']
const CHANNELS = ['email', 'slack', 'sms']

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

export function deepMerge(base, extra) {
  if (!isObject(extra)) return base
  const out = { ...base }
  for (const [k, v] of Object.entries(extra)) {
    out[k] = isObject(v) && isObject(base[k]) ? deepMerge(base[k], v) : v
  }
  return out
}

function intFrom(env, name) {
  if (env[name] === undefined || env[name] === '') return undefined
  const n = Number(env[name])
  if (!Number.isInteger(n)) throw new Error(`${name}은 정수여야 한다: ${env[name]}`)
  return n
}

/** 환경 변수(STOCK_*)를 설정 모양으로 바꾼다 */
export function fromEnv(env) {
  const out = {}
  if (env.STOCK_ENV) out.env = env.STOCK_ENV
  if (env.STOCK_LOG_LEVEL) out.log = { level: env.STOCK_LOG_LEVEL }
  const maxEntries = intFrom(env, 'STOCK_CACHE_MAX')
  const ttlSeconds = intFrom(env, 'STOCK_CACHE_TTL')
  if (maxEntries !== undefined || ttlSeconds !== undefined) {
    out.cache = {}
    if (maxEntries !== undefined) out.cache.maxEntries = maxEntries
    if (ttlSeconds !== undefined) out.cache.ttlSeconds = ttlSeconds
  }
  const low = intFrom(env, 'STOCK_LOW_THRESHOLD')
  if (low !== undefined) out.stock = { lowThreshold: low }
  if (env.STOCK_NOTIFY_CHANNELS) {
    out.notify = { channels: env.STOCK_NOTIFY_CHANNELS.split(',').map((s) => s.trim()).filter(Boolean) }
  }
  return out
}

export function validateConfig(config) {
  const errors = []
  if (!LEVELS.includes(config.log.level)) errors.push(`log.level: ${config.log.level}`)
  if (!(config.cache.maxEntries > 0)) errors.push(`cache.maxEntries: ${config.cache.maxEntries}`)
  if (!(config.cache.ttlSeconds >= 0)) errors.push(`cache.ttlSeconds: ${config.cache.ttlSeconds}`)
  if (!(config.stock.lowThreshold >= 0)) errors.push(`stock.lowThreshold: ${config.stock.lowThreshold}`)
  if (!(config.pricing.taxRate >= 0 && config.pricing.taxRate < 1)) errors.push(`pricing.taxRate: ${config.pricing.taxRate}`)
  for (const ch of config.notify.channels) if (!CHANNELS.includes(ch)) errors.push(`notify.channels: ${ch}`)
  if (errors.length) throw new Error(`설정이 잘못됨: ${errors.join(', ')}`)
  return config
}

/**
 * 기본값 < 환경 변수 < overrides 순으로 합친다.
 * env를 주지 않으면 process.env를 본다.
 */
export function loadConfig({ overrides = {}, env = process.env } = {}) {
  const merged = deepMerge(deepMerge(defaults, fromEnv(env)), overrides)
  return Object.freeze(validateConfig(merged))
}
