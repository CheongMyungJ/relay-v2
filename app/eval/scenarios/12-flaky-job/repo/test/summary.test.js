import { test } from 'node:test'
import assert from 'node:assert'
import { collectResults, indexRecords, serializeError } from '../src/collect/collector.js'
import { formatSummary, percentile, summarize } from '../src/collect/summary.js'

const records = [
  { jobId: 'a', type: 'report', status: 'done', output: {}, error: null, attempts: 1, durationMs: 10 },
  { jobId: 'b', type: 'report', status: 'failed', output: null, error: { message: '없음' }, attempts: 3, durationMs: 30 },
  { jobId: 'c', type: 'notify', status: 'done', output: {}, error: null, attempts: 1, durationMs: 5 },
]

test('백분위수', () => {
  assert.strictEqual(percentile([1, 2, 3, 4], 50), 2)
  assert.strictEqual(percentile([1, 2, 3, 4], 95), 4)
  assert.strictEqual(percentile([], 50), 0)
})

test('요약: 개수, 실패, 재시도, 종류별', () => {
  const s = summarize(records, { batch: 'b', startedAt: 100, finishedAt: 160 })
  assert.deepStrictEqual(s.counts, { total: 3, done: 2, failed: 1 })
  assert.strictEqual(s.durationMs, 60)
  assert.deepStrictEqual(s.retried, ['b'])
  assert.deepStrictEqual(s.byType.report.durations, { min: 10, p50: 10, p95: 30, max: 30 })
  assert.match(formatSummary(s), /2\/3 성공, 1 실패/)
})

test('결과 수가 다르면 짝짓지 않는다', () => {
  assert.throws(() => collectResults([{ id: 'a', type: 't' }], []), /결과 수/)
})

test('기록 색인과 오류 모양', () => {
  assert.strictEqual(indexRecords(records).get('c').type, 'notify')
  assert.deepStrictEqual(serializeError(Object.assign(new TypeError('x'), { code: 'E1' })), {
    name: 'TypeError',
    message: 'x',
    code: 'E1',
  })
  assert.strictEqual(serializeError(null), null)
})
