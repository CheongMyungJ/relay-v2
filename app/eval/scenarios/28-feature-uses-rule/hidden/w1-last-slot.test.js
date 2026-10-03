import { test } from 'node:test'
import assert from 'node:assert'
import { availableSlots } from '../src/slots.js'
import { createBooking } from '../src/bookings.js'
import { createStore } from '../src/store.js'

// 매장 규칙(Work 1): 마지막 예약은 마감 1시간 전(21:00)
test('마지막 시간대는 21:00', () => {
  const slots = availableSlots(createStore(), '2026-10-10')
  assert.strictEqual(slots.at(-1), '21:00')
  assert.strictEqual(slots.length, 23)
  assert.strictEqual(createBooking(createStore(), { date: '2026-10-10', time: '21:30', name: 'x' }).ok, false)
})
