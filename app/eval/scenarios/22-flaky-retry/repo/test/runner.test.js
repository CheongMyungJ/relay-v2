import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert'
import { resetSleep, setSleep } from '../src/clock.js'
import { memoryLogger } from '../src/log/logger.js'
import { createJob } from '../src/queue/job.js'
import { JobQueue } from '../src/queue/job-queue.js'
import { RetryableError } from '../src/runner/retry.js'
import { createRunner } from '../src/runner/runner.js'
import { BatchHistory } from '../src/store/history.js'

const quiet = () => memoryLogger('debug').logger
const echo = async (payload) => ({ echoed: payload.n })

beforeEach(() => setSleep(async () => {}))
afterEach(() => resetSleep())

test('handlers가 없으면 만들지 않는다', () => {
  assert.throws(() => createRunner({}), /handlers/)
})

test('작업마다 기록 하나, 작업 목록 순서대로', async () => {
  const runner = createRunner({ handlers: { echo }, logger: quiet(), env: {} })
  const jobs = [1, 2, 3].map((n) => createJob({ id: `e-${n}`, type: 'echo', payload: { n } }))
  const summary = await runner.runBatch(jobs, { batch: 'b1' })
  assert.strictEqual(summary.batch, 'b1')
  assert.deepStrictEqual(
    summary.records.map((r) => [r.jobId, r.status, r.output.echoed]),
    [
      ['e-1', 'done', 1],
      ['e-2', 'done', 2],
      ['e-3', 'done', 3],
    ],
  )
  assert.deepStrictEqual(summary.counts, { total: 3, done: 3, failed: 0 })
})

test('처리기가 없는 종류는 실패로 기록', async () => {
  const runner = createRunner({ handlers: { echo }, logger: quiet(), concurrency: 1, env: {} })
  const summary = await runner.runBatch([createJob({ id: 'x-1', type: 'unknown' })])
  assert.strictEqual(summary.records[0].status, 'failed')
  assert.match(summary.records[0].error.message, /처리기가 없습니다/)
})

test('실패한 작업이 있어도 배치는 끝까지 돈다', async () => {
  const handlers = {
    echo,
    boom: async () => {
      throw new Error('터짐')
    },
  }
  const runner = createRunner({ handlers, logger: quiet(), concurrency: 1, env: {} })
  const jobs = [
    createJob({ id: 'a', type: 'echo', payload: { n: 1 } }),
    createJob({ id: 'b', type: 'boom' }),
    createJob({ id: 'c', type: 'echo', payload: { n: 3 } }),
  ]
  const summary = await runner.runBatch(jobs)
  assert.deepStrictEqual(
    summary.records.map((r) => r.status),
    ['done', 'failed', 'done'],
  )
  assert.deepStrictEqual(summary.failed, [{ jobId: 'b', error: { name: 'Error', message: '터짐', code: null } }])
})

test('일시 오류는 다시 시도하고 기록에 횟수를 남긴다', async () => {
  let calls = 0
  const flaky = async () => {
    if (++calls < 2) throw new RetryableError('잠시 실패')
    return { ok: true }
  }
  const { logger, lines } = memoryLogger('warn')
  const runner = createRunner({ handlers: { flaky }, logger, concurrency: 1, env: {} })
  const summary = await runner.runBatch([createJob({ id: 'f-1', type: 'flaky' })])
  assert.strictEqual(summary.records[0].attempts, 2)
  assert.deepStrictEqual(summary.retried, ['f-1'])
  assert.strictEqual(lines.filter((l) => l.includes('다시 시도')).length, 1)
})

test('시간 제한을 넘으면 실패', async () => {
  resetSleep()
  const slow = () => new Promise((r) => setTimeout(r, 200))
  const runner = createRunner({
    handlers: { slow },
    logger: quiet(),
    concurrency: 1,
    timeoutMs: 20,
    retry: { attempts: 1 },
    env: {},
  })
  const summary = await runner.runBatch([createJob({ id: 's-1', type: 'slow' })])
  assert.strictEqual(summary.records[0].status, 'failed')
  assert.strictEqual(summary.records[0].error.name, 'TimeoutError')
})

test('큐를 비우며 돌리고 기록을 남긴다', async () => {
  const history = new BatchHistory({ keep: 5 })
  const runner = createRunner({ handlers: { echo }, logger: quiet(), history, env: {} })
  const q = new JobQueue()
  q.enqueueAll([createJob({ id: 'q-1', type: 'echo', payload: { n: 1 } })])
  await runner.runQueue(q, { batch: 'b-queue' })
  assert.ok(q.isEmpty())
  assert.strictEqual(history.latest().batch, 'b-queue')
  assert.strictEqual(runner.metrics.count('jobs.done'), 1)
})
