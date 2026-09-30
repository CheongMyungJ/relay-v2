import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SendError } from '../src/adapters/errors.js'
import { loadConfig } from '../src/config/load.js'
import { backoffDelay, totalBackoff } from '../src/retry/backoff.js'
import { decide } from '../src/retry/policy.js'
import { createRetryQueue, QueueFullError } from '../src/retry/queue.js'

const config = loadConfig()
const options = { timeoutMs: config.send.timeoutMs, ...config.retry }

test('대기 시간은 두 배씩, 최대값에서 멈춘다', () => {
  const o = { baseDelayMs: 1000, factor: 2, maxDelayMs: 5000 }
  assert.deepEqual([1, 2, 3, 4].map((a) => backoffDelay(a, o)), [1000, 2000, 4000, 5000])
  assert.equal(totalBackoff(3, o), 3000)
  assert.throws(() => backoffDelay(0, o), RangeError)
})

test('빠르게 성공하면 끝', () => {
  assert.deepEqual(decide({ ok: true }, { attempt: 1, elapsedMs: 300 }, options), { action: 'done' })
})

test('일시적 오류는 다시 보낸다', () => {
  const error = new SendError('busy', { code: 'smtp-421', transient: true })
  const d = decide({ ok: false, error }, { attempt: 1, elapsedMs: 100 }, options)
  assert.equal(d.action, 'retry')
  assert.equal(d.reason, 'smtp-421')
  assert.equal(d.delayMs, config.retry.baseDelayMs)
})

test('영구 오류는 바로 포기', () => {
  const error = new SendError('no user', { code: 'smtp-550', transient: false })
  assert.equal(decide({ ok: false, error }, { attempt: 1, elapsedMs: 100 }, options).action, 'give-up')
})

test('시도 횟수를 다 쓰면 포기', () => {
  const error = new SendError('busy', { code: 'smtp-421', transient: true })
  const d = decide({ ok: false, error }, { attempt: options.maxAttempts, elapsedMs: 100 }, options)
  assert.equal(d.action, 'give-up')
})

test('대기열은 보낼 시각 순서로 꺼낸다', () => {
  const q = createRetryQueue()
  q.enqueue({ notBefore: 300, attempt: 2 })
  q.enqueue({ notBefore: 100, attempt: 2 })
  q.enqueue({ notBefore: 200, attempt: 3 })
  assert.equal(q.nextDueAt(), 100)
  assert.deepEqual(q.takeDue(200).map((j) => j.notBefore), [100, 200])
  assert.equal(q.size(), 1)
})

test('대기열이 가득 차면 거절', () => {
  const q = createRetryQueue({ maxSize: 1 })
  q.enqueue({ notBefore: 1 })
  assert.throws(() => q.enqueue({ notBefore: 2 }), QueueFullError)
  assert.equal(q.removeWhere(() => true), 1)
})
