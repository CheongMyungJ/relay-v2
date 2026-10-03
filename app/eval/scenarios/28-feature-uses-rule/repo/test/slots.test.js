import { test } from 'node:test'
import assert from 'node:assert'
import { availableSlots } from '../src/slots.js'
import { createStore } from '../src/store.js'

test('첫 시간대는 10:00, 30분 단위', () => {
  const slots = availableSlots(createStore(), '2026-10-10')
  assert.strictEqual(slots[0], '10:00')
  assert.strictEqual(slots[1], '10:30')
})
