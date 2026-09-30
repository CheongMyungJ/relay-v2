import { test } from 'node:test'
import assert from 'node:assert'
import { median } from '../src/stats.js'

test('median', () => {
  assert.strictEqual(median([3, 1, 2]), 2)
  assert.strictEqual(median([10, 9, 100]), 10)
  assert.strictEqual(median([4, 1, 3, 2]), 2.5)
  assert.strictEqual(median([5]), 5)
})
