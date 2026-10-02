import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert'
import { resetNow, resetSleep, setNow, setSleep } from '../src/clock.js'
import { createCleanupHandler } from '../src/handlers/cleanup.js'
import { createNotifyHandler, createOutbox } from '../src/handlers/notify.js'
import { createReportHandler, topCategories } from '../src/handlers/report.js'
import { createHandlers, nightlyJobs, reportsById } from '../src/nightly.js'
import { createMemorySource, sampleRows } from '../src/sources/memory-source.js'
import { KvStore } from '../src/store/kv.js'

let slept
beforeEach(() => {
  slept = []
  setSleep(async (ms) => {
    slept.push(ms)
  })
})
afterEach(() => {
  resetSleep()
  resetNow()
})

test('보고서: 합계와 상위 분류', async () => {
  const source = createMemorySource({ data: { acme: sampleRows(10) }, latency: { baseMs: 3, perRowMs: 0.5 } })
  const report = createReportHandler({ source })
  const out = await report({ reportId: 'r-1', tenant: 'acme', period: '2026-09' })
  assert.strictEqual(out.rows, 10)
  assert.strictEqual(out.total, sampleRows(10).reduce((s, r) => s + r.amount, 0))
  assert.strictEqual(out.top.length, 3)
  assert.deepStrictEqual(slept, [8])
})

test('보고서: 기간이 다른 행은 빼고, 모르는 고객사는 오류', async () => {
  const data = { acme: [...sampleRows(3, { period: '2026-08' }), ...sampleRows(2)] }
  const report = createReportHandler({ source: createMemorySource({ data }) })
  assert.strictEqual((await report({ reportId: 'r', tenant: 'acme', period: '2026-09' })).rows, 2)
  await assert.rejects(report({ reportId: 'r', tenant: 'nobody' }), /알 수 없는 고객사/)
  await assert.rejects(report({ tenant: 'acme' }), /reportId/)
})

test('상위 분류: 금액이 같으면 이름 순', () => {
  const rows = [
    { category: 'b', amount: 5 },
    { category: 'a', amount: 5 },
    { category: 'c', amount: 9 },
  ]
  assert.deepStrictEqual(
    topCategories(rows, 2).map((t) => t.category),
    ['c', 'a'],
  )
})

test('정리: 기한이 지난 항목만', async () => {
  setNow(() => 1000)
  const store = new KvStore()
  store.set('cache:a', 1, { ttlMs: 10 })
  store.set('cache:b', 2, { ttlMs: 5000 })
  store.set('lock:c', 3, { ttlMs: 10 })
  store.set('cache:d', 4)
  const cleanup = createCleanupHandler({ store })
  const out = await cleanup({ prefix: 'cache:', at: 2000 })
  assert.deepStrictEqual(out, { prefix: 'cache:', removed: 1 })
  assert.deepStrictEqual([...store.entries()].map(([k]) => k), ['cache:b', 'lock:c', 'cache:d'])
})

test('알림: 주소 검사와 발송', async () => {
  const outbox = createOutbox()
  const notify = createNotifyHandler({ mailer: outbox })
  await assert.rejects(notify({ to: [] }), /받는 사람/)
  await assert.rejects(notify({ to: ['nope'] }), /메일 주소/)
  assert.deepStrictEqual(await notify({ to: 'ops@example.com', subject: 's' }), { messageId: 'msg-1', to: 1 })
  assert.strictEqual(outbox.sent[0].subject, 's')
})

test('밤 배치 작업 목록과 처리기 묶음', () => {
  const jobs = nightlyJobs(['acme', 'globex'], { period: '2026-09', notify: ['ops@example.com'] })
  assert.deepStrictEqual(
    jobs.map((j) => [j.id, j.type, j.payload.reportId]),
    [
      ['job-1', 'report', 'report-1'],
      ['job-2', 'report', 'report-2'],
      ['job-3', 'notify', undefined],
    ],
  )
  assert.throws(() => nightlyJobs(['a'], { period: '2026-9' }), /YYYY-MM/)
  assert.deepStrictEqual(Object.keys(createHandlers({ source: {}, mailer: {} })), ['report', 'notify'])
})

test('reportsById는 성공한 보고서만', () => {
  const out = reportsById([
    { jobId: 'job-1', type: 'report', status: 'done', output: { reportId: 'report-1', total: 5 } },
    { jobId: 'job-2', type: 'report', status: 'failed', output: null },
    { jobId: 'job-3', type: 'notify', status: 'done', output: { messageId: 'm' } },
  ])
  assert.deepStrictEqual(out, { 'report-1': { jobId: 'job-1', reportId: 'report-1', total: 5 } })
})
