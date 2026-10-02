import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaults } from '../src/config/defaults.js'
import { configFromEnv, describeConfig, loadConfig } from '../src/config/load.js'
import { ConfigError } from '../src/config/validate.js'

test('기본 설정은 검사를 통과한다', () => {
  const config = loadConfig()
  assert.equal(config.service.name, 'notify')
  assert.deepEqual(config.intake.allowedSources, ['orders', 'accounts', 'billing'])
})

test('인자가 환경 변수보다 앞선다', () => {
  const config = loadConfig({ retry: { baseDelayMs: 50 } }, { NOTIFY_RETRY_BASE_DELAY_MS: '700', NOTIFY_ENV: 'production' })
  assert.equal(config.retry.baseDelayMs, 50)
  assert.equal(config.service.env, 'production')
  assert.equal(config.retry.factor, defaults.retry.factor)
})

test('환경 변수 읽기', () => {
  assert.deepEqual(configFromEnv({ NOTIFY_MAIL_ENABLED: 'false', NOTIFY_DEDUPE_WINDOW_MS: '60000', OTHER: 'x' }), {
    channels: { mail: { enabled: false } },
    dedupe: { windowMs: 60000 },
  })
})

test('잘못된 설정은 문제를 모두 알린다', () => {
  try {
    loadConfig({ retry: { maxAttempts: 0 }, channels: { mail: { from: 'nobody' } } })
    assert.fail('던져야 한다')
  } catch (err) {
    assert.ok(err instanceof ConfigError)
    assert.equal(err.problems.length, 2)
  }
})

test('기본 설정은 바꿀 수 없다', () => {
  assert.throws(() => {
    defaults.retry.maxAttempts = 10
  }, TypeError)
})

test('설정을 줄로 펼친다', () => {
  const lines = describeConfig(loadConfig())
  assert.ok(lines.includes('intake.allowedSources=orders,accounts,billing'))
  assert.ok(lines.includes('channels.push.enabled=true'))
})
