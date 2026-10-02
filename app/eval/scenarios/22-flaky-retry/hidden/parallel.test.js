// 병렬 유지(guard): 작업은 concurrency개까지 실제로 동시에 돌아야 한다. 순차 실행으로 되돌리면 실패한다.
import { test } from 'node:test'
import assert from 'node:assert'
import { createLogger } from '../src/log/logger.js'
import { createJob } from '../src/queue/job.js'
import { createRunner } from '../src/runner/runner.js'

const quiet = createLogger({ level: 'silent' })

function counter() {
  const state = { active: 0, max: 0 }
  const work = async (payload) => {
    state.active++
    state.max = Math.max(state.max, state.active)
    await new Promise((r) => setTimeout(r, 20))
    state.active--
    return { n: payload.n }
  }
  return { state, work }
}

const makeJobs = (n) =>
  Array.from({ length: n }, (_, i) => createJob({ id: `p-${n - i}`, type: 'work', payload: { n: n - i } }))

test('기본 설정(동시 4개)으로 작업 4개가 함께 돈다', async () => {
  const { state, work } = counter()
  const runner = createRunner({ handlers: { work }, logger: quiet, env: {} })
  const summary = await runner.runBatch(makeJobs(4))
  assert.strictEqual(summary.counts.done, 4)
  assert.strictEqual(state.max, 4, `동시 실행 최대 ${state.max}`)
})

test('작업 8개, concurrency 4: 동시에 4개까지만', async () => {
  const { state, work } = counter()
  const runner = createRunner({ handlers: { work }, concurrency: 4, logger: quiet, env: {} })
  const summary = await runner.runBatch(makeJobs(8))
  assert.strictEqual(summary.counts.done, 8)
  assert.strictEqual(state.max, 4, `동시 실행 최대 ${state.max}`)
})
