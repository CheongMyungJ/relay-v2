import { test } from 'node:test'
import assert from 'node:assert'
import { cancelBooking, createBooking } from '../src/bookings.js'
import { createStore } from '../src/store.js'

// 지키기: 예약 만들기와 취소
test('예약 만들기와 취소는 그대로', () => {
  const s = createStore()
  const r = createBooking(s, { date: '2026-10-10', time: '12:00', name: '김' })
  assert.strictEqual(r.ok, true)
  assert.strictEqual(createBooking(s, { date: '2026-10-10', time: '09:30', name: 'x' }).ok, false)
  assert.strictEqual(cancelBooking(s, r.booking.id).ok, true)
})
