import { test } from 'node:test'
import assert from 'node:assert'
import { median } from '../src/stats.js'

test('홀수 개', () => {
  assert.strictEqual(median([3, 1, 2]), 2)
})
