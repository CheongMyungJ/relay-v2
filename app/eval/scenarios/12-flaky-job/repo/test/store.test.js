import { afterEach, test } from 'node:test'
import assert from 'node:assert'
import { resetNow, setNow } from '../src/clock.js'
import { createMetrics } from '../src/metrics.js'
import { BatchHistory } from '../src/store/history.js'
import { KvStore } from '../src/store/kv.js'
import { batchId, idNumber, nextId, resetIds } from '../src/util/ids.js'

afterEach(() => resetNow())

const summary = (batch, failed = []) => ({
  batch,
  finishedAt: 0,
  durationMs: 1,
  counts: { total: 3, done: 3 - failed.length, failed: failed.length },
  failed: failed.map((jobId) => ({ jobId })),
})

test('기록은 최근 keep개만', () => {
  const h = new BatchHistory({ keep: 2 })
  h.add(summary('a'))
  h.add(summary('b'))
  h.add(summary('c'))
  assert.deepStrictEqual(
    h.items.map((i) => i.batch),
    ['b', 'c'],
  )
  assert.strictEqual(h.find('a'), undefined)
  assert.throws(() => new BatchHistory({ keep: 0 }), /keep/)
})

test('연속 실패와 작업별 실패 횟수', () => {
  const h = new BatchHistory()
  h.add(summary('a', ['job-1']))
  h.add(summary('b'))
  h.add(summary('c', ['job-2']))
  h.add(summary('d', ['job-2', 'job-3']))
  assert.strictEqual(h.failureStreak(), 2)
  assert.deepStrictEqual(h.failureCounts(), { 'job-1': 1, 'job-2': 2, 'job-3': 1 })
})

test('키-값 저장소 기한', () => {
  let t = 0
  setNow(() => t)
  const kv = new KvStore()
  kv.set('a', 1, { ttlMs: 10 }).set('b', 2)
  assert.strictEqual(kv.get('a'), 1)
  t = 10
  assert.strictEqual(kv.get('a'), undefined)
  assert.ok(kv.has('b'))
  assert.strictEqual(kv.size, 2)
})

test('지표', () => {
  const m = createMetrics()
  m.increment('jobs.done')
  m.increment('jobs.done', 2)
  m.observe('ms', 10)
  m.observe('ms', 30)
  m.observe('ms', Number.NaN)
  assert.strictEqual(m.count('jobs.done'), 3)
  assert.deepStrictEqual(m.stats('ms'), { count: 2, sum: 40, mean: 20, max: 30 })
  assert.deepStrictEqual(m.snapshot().counters, { 'jobs.done': 3 })
  m.reset()
  assert.strictEqual(m.count('jobs.done'), 0)
})

test('id', () => {
  resetIds()
  assert.strictEqual(nextId('t'), 't-1')
  assert.strictEqual(nextId('t'), 't-2')
  assert.strictEqual(idNumber('job-12'), 12)
  assert.strictEqual(idNumber('job'), null)
  assert.strictEqual(batchId(new Date(Date.UTC(2026, 8, 30, 2, 5))), 'batch-20260930-0205')
})
