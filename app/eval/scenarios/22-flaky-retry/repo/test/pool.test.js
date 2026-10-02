import { test } from 'node:test'
import assert from 'node:assert'
import { chunks, runPool } from '../src/runner/pool.js'

test('chunks', () => {
  assert.deepStrictEqual(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
  assert.deepStrictEqual(chunks([], 3), [])
})

test('동시에 concurrency개를 넘지 않는다', async () => {
  let active = 0
  let max = 0
  const results = await runPool(
    [1, 2, 3, 4, 5, 6, 7],
    async (n) => {
      active++
      max = Math.max(max, active)
      await new Promise((r) => setTimeout(r, 5))
      active--
      return n * 10
    },
    { concurrency: 3 },
  )
  assert.ok(max <= 3, `동시 실행 최대 ${max}`)
  assert.strictEqual(results.length, 7)
})

test('묶음마다 진행 알림', async () => {
  const seen = []
  await runPool([1, 2, 3, 4, 5], async (n) => n, { concurrency: 2, onChunk: (p) => seen.push(p.done) })
  assert.deepStrictEqual(seen, [2, 4, 5])
})

test('빈 목록', async () => {
  assert.deepStrictEqual(await runPool([], async () => 1, { concurrency: 4 }), [])
})
