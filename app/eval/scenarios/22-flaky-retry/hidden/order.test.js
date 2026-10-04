// 완료 순서와 무관: 작업이 입력과 다른 순서로 끝나도 결과가 제 작업에 붙어야 한다.
// Math.random과 지연을 고정해 역순 완료를 강제하므로 매번 같은 결과가 나온다.
import { afterEach, test } from 'node:test'
import assert from 'node:assert'
import { resetSleep } from '../src/clock.js'
import { createLogger } from '../src/log/logger.js'
import { createOutbox } from '../src/handlers/notify.js'
import { createJob } from '../src/queue/job.js'
import { createHandlers, nightlyJobs } from '../src/nightly.js'
import { createRunner } from '../src/runner/runner.js'
import { createMemorySource, sampleRows } from '../src/sources/memory-source.js'

const realRandom = Math.random
const quiet = createLogger({ level: 'silent' })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

afterEach(() => {
  Math.random = realRandom
  resetSleep()
})

test('역순으로 끝나도 결과가 제 작업에 붙는다 (id가 정렬 순서가 아님)', async () => {
  const ids = ['job-7', 'job-2', 'job-9', 'job-4', 'job-11', 'job-3']
  // 앞의 작업일수록 늦게 끝난다
  const delays = { 'job-7': 60, 'job-2': 45, 'job-9': 30, 'job-4': 15, 'job-11': 40, 'job-3': 10 }
  const work = async (payload, ctx) => {
    await wait(delays[ctx.job.id])
    return { from: payload.owner }
  }
  const runner = createRunner({ handlers: { work }, concurrency: 4, logger: quiet, env: {} })
  const jobs = ids.map((id) => createJob({ id, type: 'work', payload: { owner: id } }))
  const summary = await runner.runBatch(jobs, { batch: 'hidden-order' })

  assert.deepStrictEqual(
    summary.records.map((r) => r.jobId),
    ids,
    '기록은 작업 목록 순서여야 한다',
  )
  for (const r of summary.records) {
    assert.strictEqual(r.status, 'done')
    assert.strictEqual(r.output.from, r.jobId, `${r.jobId}에 ${r.output.from}의 결과가 붙었다`)
  }
})

test('밤 배치: 흔들림이 역순이어도 보고서와 실패가 제 작업에 붙는다', async () => {
  // 조회 지연 = 흔들림만. Math.random을 1, 0.75, 0.5, 0.25 ... 순서로 주면 먼저 시작한 작업이 늦게 끝난다
  const seq = [1, 0.75, 0.5, 0.25, 1, 0.6, 0.2]
  let i = 0
  Math.random = () => seq[i++ % seq.length]
  const tenants = ['wonka', 'acme', 'nobody', 'globex', 'stark', 'hooli']
  const data = Object.fromEntries(
    tenants.filter((t) => t !== 'nobody').map((t, k) => [t, sampleRows(3 + k)]),
  )
  const source = createMemorySource({ data, latency: { baseMs: 0, perRowMs: 0, jitterMs: 40 } })
  const runner = createRunner({
    handlers: createHandlers({ source, mailer: createOutbox() }),
    concurrency: 4,
    logger: quiet,
    env: {},
  })
  const jobs = nightlyJobs(tenants, { period: '2026-09', notify: ['ops@example.com'] })
  const summary = await runner.runBatch(jobs, { batch: 'hidden-nightly' })

  assert.deepStrictEqual(
    summary.records.map((r) => r.jobId),
    jobs.map((j) => j.id),
  )
  for (const [k, job] of jobs.entries()) {
    const r = summary.records[k]
    if (job.type === 'notify') {
      assert.strictEqual(r.status, 'done')
      assert.ok(r.output?.messageId, `${job.id}: 알림 결과가 아니다 ${JSON.stringify(r.output)}`)
    } else if (job.payload.tenant === 'nobody') {
      assert.strictEqual(r.status, 'failed', `${job.id}(고객사 없음)는 실패여야 한다`)
      assert.match(r.error.message, /nobody/)
    } else {
      assert.strictEqual(r.status, 'done', `${job.id} 상태`)
      assert.strictEqual(r.output.reportId, job.payload.reportId, `${job.id}에 ${r.output.reportId}가 붙었다`)
      assert.strictEqual(r.output.tenant, job.payload.tenant)
    }
  }
  assert.deepStrictEqual(summary.failed.map((f) => f.jobId), ['job-3'])
})
