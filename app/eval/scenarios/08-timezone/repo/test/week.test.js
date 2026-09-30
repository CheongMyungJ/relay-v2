import { test } from 'node:test'
import assert from 'node:assert'
import { isWeekend } from '../src/week.js'

test('토요일', () => {
  assert.strictEqual(isWeekend('2026-10-03'), true)
})
