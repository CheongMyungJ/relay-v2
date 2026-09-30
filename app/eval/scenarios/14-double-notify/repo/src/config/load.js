// 설정 읽기: 기본값 < 환경 변수 < 인자 순서로 덮어쓴다.
import { deepMerge } from '../util/deep-merge.js'
import { defaults } from './defaults.js'
import { validateConfig } from './validate.js'

const ENV = {
  NOTIFY_ENV: ['service.env', String],
  NOTIFY_SEND_TIMEOUT_MS: ['send.timeoutMs', Number],
  NOTIFY_RETRY_MAX_ATTEMPTS: ['retry.maxAttempts', Number],
  NOTIFY_RETRY_BASE_DELAY_MS: ['retry.baseDelayMs', Number],
  NOTIFY_DEDUPE_WINDOW_MS: ['dedupe.windowMs', Number],
  NOTIFY_MAIL_FROM: ['channels.mail.from', String],
  NOTIFY_MAIL_ENABLED: ['channels.mail.enabled', parseBool],
  NOTIFY_PUSH_ENABLED: ['channels.push.enabled', parseBool],
}

function parseBool(text) {
  return ['1', 'true', 'yes', 'on'].includes(String(text).toLowerCase())
}

function setPath(obj, dotted, value) {
  const keys = dotted.split('.')
  let cur = obj
  for (const k of keys.slice(0, -1)) cur = cur[k] ??= {}
  cur[keys.at(-1)] = value
}

/** 환경 변수에서 설정 조각을 만든다. 모르는 변수는 무시한다 */
export function configFromEnv(env = {}) {
  const out = {}
  for (const [name, [dotted, parse]] of Object.entries(ENV)) {
    if (env[name] === undefined || env[name] === '') continue
    setPath(out, dotted, parse(env[name]))
  }
  return out
}

/** 설정을 "a.b=값" 줄로 펼친다. 배포 뒤 실제로 쓰는 값을 확인할 때 쓴다 */
export function describeConfig(config, prefix = '') {
  const lines = []
  for (const [key, value] of Object.entries(config)) {
    const name = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) lines.push(...describeConfig(value, name))
    else lines.push(`${name}=${Array.isArray(value) ? value.join(',') : value}`)
  }
  return lines
}

export function loadConfig(overrides = {}, env = {}) {
  const merged = deepMerge(deepMerge(defaults, configFromEnv(env)), overrides)
  return validateConfig(merged)
}
