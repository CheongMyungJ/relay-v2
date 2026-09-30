import { test } from 'node:test'
import assert from 'node:assert'
import { formatDate, formatRange } from '../src/format.js'

test('월이 맞다', () => {
  assert.strictEqual(formatDate(new Date(2026, 8, 30)), '2026.09.30 (수)')
  assert.strictEqual(formatDate(new Date(2026, 0, 5)), '2026.01.05 (월)')
  assert.strictEqual(formatDate(new Date(2026, 11, 31)), '2026.12.31 (목)')
  assert.strictEqual(formatRange(new Date(2026, 0, 5), new Date(2026, 1, 2)), '2026.01.05 (월) ~ 2026.02.02 (월)')
})
