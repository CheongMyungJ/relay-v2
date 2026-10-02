import { test } from 'node:test'
import assert from 'node:assert'
import { DEFAULTS, deepMerge, fromEnv, loadConfig } from '../src/config.js'

test('기본 설정', () => {
  const c = loadConfig({}, {})
  assert.strictEqual(c.concurrency, DEFAULTS.concurrency)
  assert.strictEqual(c.retry.attempts, 3)
  assert.ok(Object.isFrozen(c))
})

test('넘긴 값이 환경 변수보다 우선', () => {
  const c = loadConfig({ concurrency: 2 }, { JOBS_CONCURRENCY: '8', JOBS_RETRY_ATTEMPTS: '5' })
  assert.strictEqual(c.concurrency, 2)
  assert.strictEqual(c.retry.attempts, 5)
  assert.strictEqual(c.retry.backoffMs, DEFAULTS.retry.backoffMs)
})

test('환경 변수 검사', () => {
  assert.throws(() => fromEnv({ JOBS_CONCURRENCY: 'many' }), /JOBS_CONCURRENCY/)
  assert.throws(() => fromEnv({ JOBS_LOG_LEVEL: 'loud' }), /JOBS_LOG_LEVEL/)
})

test('틀린 설정은 모두 모아 알린다', () => {
  assert.throws(
    () => loadConfig({ concurrency: 0, timeoutMs: 0 }, {}),
    (e) => /concurrency/.test(e.message) && /timeoutMs/.test(e.message),
  )
})

test('deepMerge는 undefined를 건너뛰고 배열은 덮어쓴다', () => {
  const out = deepMerge({ a: 1, b: { c: 2, d: 3 }, e: [1] }, { a: undefined, b: { c: 9 }, e: [2, 3] })
  assert.deepStrictEqual(out, { a: 1, b: { c: 9, d: 3 }, e: [2, 3] })
})
