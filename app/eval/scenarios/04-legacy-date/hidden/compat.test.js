import { test } from 'node:test'
import assert from 'node:assert'
import { formatDate, formatDateTime, formatRange } from '../src/format.js'

test('다른 형식은 그대로', () => {
  assert.strictEqual(formatDate(null), 'N/A')
  assert.strictEqual(formatDate(undefined), 'N/A')
  assert.strictEqual(formatDateTime(null), 'N/A')
  assert.strictEqual(formatDateTime(new Date(2026, 0, 5, 0, 7)), '2026.01.05 (월) 오전 12:07')
  assert.strictEqual(formatDateTime(new Date(2026, 0, 5, 13, 30)), '2026.01.05 (월) 오후 1:30')
  assert.strictEqual(formatRange(new Date(2026, 0, 5, 9), new Date(2026, 0, 5, 18)), '2026.01.05 (월)')
  assert.strictEqual(formatRange(null, new Date(2026, 0, 5)), 'N/A')
})
