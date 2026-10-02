// CI 전용: 밤 배치를 실제와 비슷한 조회와 저장 지연으로 돌리고, 보고서가 보관소에 제대로 남는지 본다 (npm run test:ci)
import { before, test } from 'node:test'
import assert from 'node:assert'
import { createHandlers, nightlyJobs } from '../src/nightly.js'
import { createRunner } from '../src/runner/runner.js'
import { createMemorySource, sampleRows } from '../src/sources/memory-source.js'
import { createFileStore } from '../src/store/file-store.js'
import { listReports, loadReport, reportPath, strayTemps } from '../src/store/report-archive.js'

const TENANTS = ['acme', 'globex', 'initech', 'umbrella', 'hooli', 'stark', 'wayne', 'wonka']
const PERIOD = '2026-09'

const data = Object.fromEntries(TENANTS.map((t, i) => [t, sampleRows(40 + 16 * i)]))
const jobs = nightlyJobs(TENANTS, { period: PERIOD })
const archive = createFileStore({ latency: { baseMs: 2, perKbMs: 1, jitterMs: 2 } })
let summary

before(async () => {
  const source = createMemorySource({ data, latency: { baseMs: 10, perRowMs: 0.25, jitterMs: 5 } })
  const runner = createRunner({ handlers: createHandlers({ source, archive }), env: {} })
  summary = await runner.runBatch(jobs, { batch: 'ci-archive' })
})

test('밤 배치: 보고서가 모두 보관소에 저장된다', () => {
  assert.strictEqual(summary.counts.failed, 0, summary.failed.map((f) => f.error?.message).join('; '))
  assert.deepStrictEqual(
    listReports(archive, PERIOD),
    jobs.map((j) => reportPath(PERIOD, j.payload.reportId)).sort(),
  )
  assert.deepStrictEqual(strayTemps(archive, PERIOD), [], '임시 파일이 남았다')
})

test('밤 배치: 보관본마다 제 고객사와 합계', async () => {
  for (const job of jobs) {
    const { reportId, tenant } = job.payload
    if (!archive.exists(reportPath(PERIOD, reportId))) continue // 저장되지 않은 것은 앞 시험이 잡는다
    const saved = await loadReport(archive, PERIOD, reportId)
    assert.strictEqual(saved.tenant, tenant, `${reportId} 보관본의 고객사가 다르다: ${saved.tenant} (${tenant}여야 함)`)
    const expected = data[tenant].reduce((s, r) => s + r.amount, 0)
    assert.strictEqual(saved.total, expected, `${reportId} 보관본 합계`)
  }
})
