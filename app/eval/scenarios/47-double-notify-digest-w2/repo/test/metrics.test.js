import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createVirtualClock } from '../src/clock.js'
import { formatMetrics } from '../src/metrics/format.js'
import { createMetrics, percentile } from '../src/metrics/metrics.js'

test('카운터와 분포', () => {
  const m = createMetrics()
  m.increment('send.mail.sent')
  m.increment('send.mail.sent', 2)
  for (const v of [10, 20, 30, 40]) m.observe('send.mail.ms', v)
  assert.equal(m.counter('send.mail.sent'), 3)
  assert.deepEqual(m.histogram('send.mail.ms'), { count: 4, sum: 100, min: 10, max: 40, mean: 25, p95: 40 })
  assert.equal(m.histogram('nothing'), null)
})

test('백분위', () => {
  assert.equal(percentile([5, 1, 3, 2, 4], 50), 3)
  assert.ok(Number.isNaN(percentile([], 50)))
})

test('텍스트로 내보내기', () => {
  const m = createMetrics()
  m.increment('intake.received')
  m.observe('intake.lag.ms', 5)
  const text = formatMetrics(m.snapshot())
  assert.match(text, /^notify_intake_received 1$/m)
  assert.match(text, /^notify_intake_lag_ms_count 1$/m)
})

test('걸린 시간 재기', () => {
  const clock = createVirtualClock(0)
  const m = createMetrics()
  const stop = m.startTimer('job.ms', clock)
  clock.advance(120)
  assert.equal(stop(), 120)
  assert.equal(m.histogram('job.ms').count, 1)
})
