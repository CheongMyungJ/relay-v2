// 동시 저장: 보고서 여러 개를 한꺼번에 보관해도 저마다 제 이름에 제 내용으로 남아야 한다.
// 시각(now)을 한 값으로 고정하고 저장 지연을 똑같이 주어, 저장이 같은 순간에 겹치는 경우를 매번 만든다.
import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert'
import { resetNow, resetSleep, setNow } from '../src/clock.js'
import { createLogger } from '../src/log/logger.js'
import { createHandlers, nightlyJobs } from '../src/nightly.js'
import { createRunner } from '../src/runner/runner.js'
import { createMemorySource, sampleRows } from '../src/sources/memory-source.js'
import { createFileStore } from '../src/store/file-store.js'
import { listReports, loadReport, reportPath, saveReport, strayTemps } from '../src/store/report-archive.js'

const realRandom = Math.random
const quiet = createLogger({ level: 'silent' })
const PERIOD = '2026-09'

beforeEach(() => {
  resetSleep()
  setNow(() => Date.UTC(2026, 9, 1, 2, 0, 0, 120))
})
afterEach(() => {
  Math.random = realRandom
  resetNow()
  resetSleep()
})

test('같은 순간에 저장한 보고서들이 저마다 제 이름에 제 내용으로 남는다', async () => {
  const files = createFileStore({ latency: { baseMs: 5 } })
  const tenants = ['wonka', 'acme', 'globex', 'stark', 'hooli', 'initech']
  const reports = tenants.map((tenant, i) => ({ reportId: `report-${i + 1}`, tenant, period: PERIOD, total: 1000 + i }))

  const results = await Promise.allSettled(reports.map((r) => saveReport(files, r)))
  const failed = results.flatMap((r, i) => (r.status === 'rejected' ? [`${reports[i].reportId}: ${r.reason?.message}`] : []))
  assert.deepStrictEqual(failed, [], '저장이 실패했다')
  assert.deepStrictEqual(results.map((r) => r.value), reports.map((r) => reportPath(PERIOD, r.reportId)))

  for (const r of reports) {
    const saved = await loadReport(files, PERIOD, r.reportId)
    assert.deepStrictEqual(saved, r, `${r.reportId} 보관본에 ${saved.reportId}(${saved.tenant})의 내용이 들어 있다`)
  }
  assert.deepStrictEqual(strayTemps(files, PERIOD), [], '임시 파일이 남았다')
})

test('밤 배치(동시 4개): 보관본이 모두 남고 저마다 제 고객사와 합계', async () => {
  // 흔들림을 없애고 행 수를 같게 해, 한 묶음의 보고서들이 같은 순간에 저장을 시작하게 한다
  Math.random = () => 0.5
  const tenants = ['wonka', 'acme', 'globex', 'stark', 'hooli', 'initech', 'umbrella', 'wayne']
  const data = Object.fromEntries(tenants.map((t, i) => [t, sampleRows(12, { base: 1000 + 100 * i })]))
  const source = createMemorySource({ data, latency: { baseMs: 8, perRowMs: 0, jitterMs: 4 } })
  const archive = createFileStore({ latency: { baseMs: 4, perKbMs: 0, jitterMs: 2 } })
  const runner = createRunner({
    handlers: createHandlers({ source, archive }),
    concurrency: 4,
    retry: { attempts: 1 },
    logger: quiet,
    env: {},
  })
  const jobs = nightlyJobs(tenants, { period: PERIOD })
  const summary = await runner.runBatch(jobs, { batch: 'hidden-archive' })

  // 기록과 작업의 짝(완료 순서)은 여기서 보지 않는다. 개수와 보관소만 본다
  assert.strictEqual(summary.counts.failed, 0, summary.failed.map((f) => f.error?.message).join('; '))
  assert.deepStrictEqual(listReports(archive, PERIOD), jobs.map((j) => reportPath(PERIOD, j.payload.reportId)).sort())
  for (const job of jobs) {
    const { reportId, tenant } = job.payload
    const saved = await loadReport(archive, PERIOD, reportId)
    assert.strictEqual(saved.tenant, tenant, `${reportId} 보관본의 고객사가 ${saved.tenant}다 (${tenant}여야 함)`)
    assert.strictEqual(saved.total, data[tenant].reduce((s, r) => s + r.amount, 0), `${reportId} 합계`)
  }
  assert.deepStrictEqual(strayTemps(archive, PERIOD), [], '임시 파일이 남았다')
})
