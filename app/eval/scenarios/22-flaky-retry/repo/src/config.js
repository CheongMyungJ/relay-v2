// 실행기 설정. 기본값에 환경 변수(JOBS_*)와 넘긴 값을 차례로 덮어쓴다.

export const DEFAULTS = {
  concurrency: 4,
  timeoutMs: 5000,
  retry: {
    attempts: 3,
    backoffMs: 50,
    factor: 2,
    maxBackoffMs: 2000,
  },
  log: {
    level: 'warn',
  },
  history: {
    keep: 20,
  },
}

export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype
}

/** 깊은 병합. 배열은 덮어쓴다 */
export function deepMerge(base, extra) {
  if (!isPlainObject(extra)) return base
  const out = { ...base }
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) continue
    out[key] = isPlainObject(value) && isPlainObject(base?.[key]) ? deepMerge(base[key], value) : value
  }
  return out
}

/** 얼린 복사본 */
export function freezeDeep(obj) {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) freezeDeep(value)
  }
  return Object.freeze(obj)
}

const LEVELS = ['debug', 'info', 'warn', 'error', 'silent']

function intFromEnv(env, name) {
  const raw = env[name]
  if (raw === undefined || raw === '') return undefined
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name}는 0 이상의 정수여야 합니다: ${raw}`)
  return n
}

/** 환경 변수에서 읽은 설정 */
export function fromEnv(env = process.env) {
  const level = env.JOBS_LOG_LEVEL
  if (level !== undefined && !LEVELS.includes(level)) {
    throw new Error(`JOBS_LOG_LEVEL은 ${LEVELS.join(', ')} 가운데 하나여야 합니다: ${level}`)
  }
  return {
    concurrency: intFromEnv(env, 'JOBS_CONCURRENCY'),
    timeoutMs: intFromEnv(env, 'JOBS_TIMEOUT_MS'),
    retry: { attempts: intFromEnv(env, 'JOBS_RETRY_ATTEMPTS') },
    log: { level },
  }
}

/** 설정 검사. 틀린 곳을 모두 모아 던진다 */
export function validateConfig(config) {
  const errors = []
  if (!Number.isInteger(config.concurrency) || config.concurrency < 1) {
    errors.push('concurrency는 1 이상의 정수여야 합니다')
  }
  if (!(config.timeoutMs > 0)) errors.push('timeoutMs는 0보다 커야 합니다')
  if (!Number.isInteger(config.retry.attempts) || config.retry.attempts < 1) {
    errors.push('retry.attempts는 1 이상의 정수여야 합니다')
  }
  if (config.retry.backoffMs < 0) errors.push('retry.backoffMs는 0 이상이어야 합니다')
  if (config.retry.factor < 1) errors.push('retry.factor는 1 이상이어야 합니다')
  if (!LEVELS.includes(config.log.level)) errors.push(`log.level이 틀렸습니다: ${config.log.level}`)
  if (errors.length) throw new Error(`설정 오류: ${errors.join('; ')}`)
  return config
}

/** 기본값 ← 환경 변수 ← overrides 순서로 합친 설정 */
export function loadConfig(overrides = {}, env = process.env) {
  const merged = deepMerge(deepMerge(DEFAULTS, fromEnv(env)), overrides)
  return freezeDeep(validateConfig(merged))
}
