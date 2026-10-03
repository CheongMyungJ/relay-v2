import { test } from 'node:test'
import assert from 'node:assert'
import { cancelBooking, createBooking } from '../src/bookings.js'
import { createStore } from '../src/store.js'

test('예약을 만들고 취소한다', () => {
  const s = createStore()
  const r = createBooking(s, { date: '2026-10-10', time: '12:00', name: '김' })
  assert.strictEqual(r.ok, true)
  assert.strictEqual(cancelBooking(s, r.booking.id).ok, true)
})

test('꽉 찬 시간대와 영업시간 밖은 안 된다', () => {
  const s = createStore()
  createBooking(s, { date: '2026-10-10', time: '12:00', name: 'a' })
  createBooking(s, { date: '2026-10-10', time: '12:00', name: 'b' })
  assert.deepStrictEqual(createBooking(s, { date: '2026-10-10', time: '12:00', name: 'c' }), { ok: false, reason: 'unavailable' })
  assert.strictEqual(createBooking(s, { date: '2026-10-10', time: '09:30', name: 'd' }).ok, false)
})
