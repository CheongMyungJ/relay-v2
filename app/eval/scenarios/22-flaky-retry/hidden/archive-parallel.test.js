// 보관 배치도 병렬(guard): 보관소를 쓰는 밤 배치에서도 보고서 작업은 동시 4개까지 실제로 함께 돌아야 한다.
// 보고서 작업이나 배치를 하나씩 돌리게 바꾸는 수정을 잡는다.
import { afterEach, test } from 'node:test'
import assert from 'node:assert'
import { resetSleep } from '../src/clock.js'
import { createLogger } from '../src/log/logger.js'
import { createHandlers, nightlyJobs } from '../src/nightly.js'
import { createRunner } from '../src/runner/runner.js'
import { createMemorySource, sampleRows } from '../src/sources/memory-source.js'
import { createFileStore } from '../src/store/file-store.js'
import { listReports } from '../src/store/report-archive.js'

afterEach(() => resetSleep())

test('보관소를 쓰는 밤 배치: 조회가 동시에 4개까지 돈다', async () => {
  const tenants = ['acme', 'globex', 'initech', 'umbrella', 'hooli', 'stark', 'wayne', 'wonka']
  const inner = createMemorySource({
    data: Object.fromEntries(tenants.map((t) => [t, sampleRows(10)])),
    latency: { baseMs: 15 },
  })
  const state = { active: 0, max: 0 }
  const source = {
    async query(...args) {
      state.active++
      state.max = Math.max(state.max, state.active)
      try {
        return await inner.query(...args)
      } finally {
        state.active--
      }
    },
  }
  const archive = createFileStore({ latency: { baseMs: 1 } })
  const runner = createRunner({
    handlers: createHandlers({ source, archive }),
    logger: createLogger({ level: 'silent' }),
    env: {},
  })
  const summary = await runner.runBatch(nightlyJobs(tenants, { period: '2026-09' }))
  assert.strictEqual(state.max, 4, `동시 조회 최대 ${state.max}`)
  assert.strictEqual(summary.counts.total, 8)
  assert.ok(listReports(archive, '2026-09').length >= 1)
})
