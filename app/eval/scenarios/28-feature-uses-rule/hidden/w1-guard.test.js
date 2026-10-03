import { test } from 'node:test'
import assert from 'node:assert'
import { cancelBooking, createBooking } from '../src/bookings.js'
import { createStore } from '../src/store.js'

// 지키기: 예약·취소, 꽉 찬 시간대
test('예약과 취소, 꽉 찬 시간대는 그대로', () => {
  const s = createStore()
  const a = createBooking(s, { date: '2026-10-10', time: '21:00', name: 'a' })
  createBooking(s, { date: '2026-10-10', time: '21:00', name: 'b' })
  assert.strictEqual(createBooking(s, { date: '2026-10-10', time: '21:00', name: 'c' }).ok, false)
  assert.strictEqual(cancelBooking(s, a.booking.id).ok, true)
})
