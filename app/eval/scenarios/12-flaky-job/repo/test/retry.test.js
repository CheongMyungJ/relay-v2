import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert'
import { resetSleep, setSleep } from '../src/clock.js'
import { RetryableError, backoffFor, isRetryable, withRetry } from '../src/runner/retry.js'

const policy = { attempts: 3, backoffMs: 100, factor: 2, maxBackoffMs: 1000 }
let waits

beforeEach(() => {
  waits = []
  setSleep(async (ms) => {
    waits.push(ms)
  })
})
afterEach(() => resetSleep())

test('다시 해 볼 만한 오류', () => {
  assert.ok(isRetryable(new RetryableError('x')))
  assert.ok(isRetryable(Object.assign(new Error('x'), { code: 'ECONNRESET' })))
  assert.ok(!isRetryable(new Error('x')))
  assert.ok(!isRetryable(Object.assign(new Error('x'), { code: 'ECONNRESET', retryable: false })))
})

test('간격은 늘어나고 최대를 넘지 않는다', () => {
  const b1 = backoffFor(1, policy)
  const b3 = backoffFor(3, policy)
  assert.ok(b1 >= 80 && b1 <= 120, `b1=${b1}`)
  assert.ok(b3 >= 320 && b3 <= 480, `b3=${b3}`)
  assert.ok(backoffFor(10, policy) <= 1000)
})

test('일시 오류는 다시 해서 성공', async () => {
  let n = 0
  const r = await withRetry(async () => {
    if (++n < 3) throw new RetryableError('잠시 실패')
    return 'ok'
  }, policy)
  assert.deepStrictEqual(r, { value: 'ok', attempts: 3 })
  assert.strictEqual(waits.length, 2)
})

test('일시 오류가 아니면 바로 실패', async () => {
  let n = 0
  await assert.rejects(
    withRetry(async () => {
      n++
      throw new Error('틀린 입력')
    }, policy),
    (e) => e.attempts === 1,
  )
  assert.strictEqual(n, 1)
})

test('횟수를 다 쓰면 마지막 오류', async () => {
  const seen = []
  await assert.rejects(
    withRetry(
      async (attempt) => {
        throw new RetryableError(`실패 ${attempt}`)
      },
      policy,
      { onRetry: (i) => seen.push(i.attempt) },
    ),
    /실패 3/,
  )
  assert.deepStrictEqual(seen, [1, 2])
})
