// 설정 값 확인. 문제를 모두 모아 한 번에 알린다.

export class ConfigError extends Error {
  constructor(problems) {
    super(`설정이 잘못됨:\n- ${problems.join('\n- ')}`)
    this.name = 'ConfigError'
    this.problems = problems
  }
}

const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0
const positiveInt = (v) => Number.isInteger(v) && v > 0

export function validateConfig(config) {
  const problems = []
  const need = (ok, msg) => {
    if (!ok) problems.push(msg)
  }

  need(Array.isArray(config.intake?.allowedSources) && config.intake.allowedSources.length > 0, 'intake.allowedSources가 비었다')
  need(positive(config.intake?.maxDataBytes), 'intake.maxDataBytes는 양수여야 한다')
  need(positive(config.intake?.maxClockSkewMs), 'intake.maxClockSkewMs는 양수여야 한다')
  need(positive(config.dedupe?.windowMs), 'dedupe.windowMs는 양수여야 한다')
  need(positiveInt(config.dedupe?.maxEntries), 'dedupe.maxEntries는 양의 정수여야 한다')
  need(positive(config.send?.timeoutMs), 'send.timeoutMs는 양수여야 한다')
  need(positiveInt(config.retry?.maxAttempts), 'retry.maxAttempts는 양의 정수여야 한다')
  need(positive(config.retry?.baseDelayMs), 'retry.baseDelayMs는 양수여야 한다')
  need(config.retry?.factor >= 1, 'retry.factor는 1 이상이어야 한다')
  need(config.retry?.maxDelayMs >= config.retry?.baseDelayMs, 'retry.maxDelayMs는 baseDelayMs 이상이어야 한다')
  need(positiveInt(config.retry?.maxQueueSize), 'retry.maxQueueSize는 양의 정수여야 한다')
  need(/@/.test(config.channels?.mail?.from ?? ''), 'channels.mail.from이 메일 주소가 아니다')
  need(positiveInt(config.channels?.push?.ttlSeconds), 'channels.push.ttlSeconds는 양의 정수여야 한다')
  need(['ko', 'en'].includes(config.templates?.defaultLocale), 'templates.defaultLocale은 ko나 en이어야 한다')

  if (problems.length) throw new ConfigError(problems)
  return config
}
