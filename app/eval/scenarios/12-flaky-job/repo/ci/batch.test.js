// CI 전용: 밤 배치를 실제와 비슷한 조회 지연으로 끝까지 돌려 본다 (npm run test:ci)
import { test } from 'node:test'
import assert from 'node:assert'
import { createOutbox } from '../src/handlers/notify.js'
import { createHandlers, nightlyJobs, reportsById } from '../src/nightly.js'
import { createRunner } from '../src/runner/runner.js'
import { createMemorySource, sampleRows } from '../src/sources/memory-source.js'

const TENANTS = ['acme', 'globex', 'initech', 'umbrella', 'hooli', 'stark', 'wayne', 'wonka']
const LATENCY = { baseMs: 10, perRowMs: 0.25, jitterMs: 5 }

function setup() {
  const data = Object.fromEntries(TENANTS.map((t, i) => [t, sampleRows(40 + 12 * i)]))
  const source = createMemorySource({ data, latency: LATENCY })
  const outbox = createOutbox()
  const runner = createRunner({ handlers: createHandlers({ source, mailer: outbox }), env: {} })
  const jobs = nightlyJobs(TENANTS, { period: '2026-09', notify: ['ops@example.com'] })
  return { data, outbox, runner, jobs }
}

test('밤 배치: 모든 작업이 성공하고 알림이 한 번 나간다', async () => {
  const { outbox, runner, jobs } = setup()
  const summary = await runner.runBatch(jobs, { batch: 'ci-nightly' })
  assert.deepStrictEqual(summary.counts, { total: 9, done: 9, failed: 0 })
  assert.strictEqual(outbox.sent.length, 1)
})

test('밤 배치: 보고서마다 제 작업과 고객사가 붙는다', async () => {
  const { data, runner, jobs } = setup()
  const summary = await runner.runBatch(jobs, { batch: 'ci-nightly' })
  for (const record of summary.records.filter((r) => r.type === 'report')) {
    const owner = jobs.find((j) => j.payload.reportId === record.output?.reportId)
    assert.ok(owner, `${record.jobId}: 보고서가 아닌 결과가 붙었다 (${JSON.stringify(record.output)})`)
    assert.strictEqual(
      record.jobId,
      owner.id,
      `expected ${record.output.reportId} to belong to ${owner.id}, got ${record.jobId}`,
    )
  }
  const reports = reportsById(summary.records)
  for (const job of jobs.filter((j) => j.type === 'report')) {
    const expected = data[job.payload.tenant].reduce((s, r) => s + r.amount, 0)
    assert.strictEqual(reports[job.payload.reportId].total, expected, `${job.payload.reportId} 합계`)
  }
})
