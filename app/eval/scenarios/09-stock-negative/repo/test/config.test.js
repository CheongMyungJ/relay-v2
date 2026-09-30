import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deepMerge, fromEnv, loadConfig } from '../src/config/index.js'

test('기본값', () => {
  const c = loadConfig({ env: {} })
  assert.equal(c.cache.maxEntries, 500)
  assert.equal(c.pricing.taxRate, 0.1)
  assert.deepEqual(c.notify.channels, ['email'])
})

test('환경 변수가 기본값을 덮는다', () => {
  const c = loadConfig({ env: { STOCK_CACHE_MAX: '50', STOCK_LOG_LEVEL: 'warn', STOCK_NOTIFY_CHANNELS: 'email, slack' } })
  assert.equal(c.cache.maxEntries, 50)
  assert.equal(c.cache.ttlSeconds, 300)
  assert.equal(c.log.level, 'warn')
  assert.deepEqual(c.notify.channels, ['email', 'slack'])
})

test('인자가 환경 변수를 덮는다', () => {
  const c = loadConfig({ env: { STOCK_LOW_THRESHOLD: '7' }, overrides: { stock: { lowThreshold: 1 } } })
  assert.equal(c.stock.lowThreshold, 1)
})

test('잘못된 값은 거부한다', () => {
  assert.throws(() => loadConfig({ env: { STOCK_CACHE_MAX: 'abc' } }), /정수/)
  assert.throws(() => loadConfig({ env: {}, overrides: { log: { level: 'loud' } } }), /log.level/)
  assert.throws(() => loadConfig({ env: {}, overrides: { notify: { channels: ['fax'] } } }), /notify.channels/)
})

test('deepMerge는 배열을 통째로 바꾸고 객체는 합친다', () => {
  assert.deepEqual(deepMerge({ a: { b: 1, c: 2 }, l: [1, 2] }, { a: { c: 3 }, l: [9] }), { a: { b: 1, c: 3 }, l: [9] })
  assert.deepEqual(fromEnv({}), {})
})
