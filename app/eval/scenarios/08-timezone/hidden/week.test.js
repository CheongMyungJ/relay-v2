import { test } from 'node:test'
import assert from 'node:assert'
import { isWeekend } from '../src/week.js'

test('주말 판정', () => {
  assert.strictEqual(isWeekend('2026-10-03'), true)
  assert.strictEqual(isWeekend('2026-10-04'), true)
  assert.strictEqual(isWeekend('2026-10-02'), false)
  assert.strictEqual(isWeekend('2026-10-05'), false)
})
