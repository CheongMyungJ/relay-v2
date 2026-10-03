import { test } from 'node:test'
import assert from 'node:assert'
import { createBooking, rescheduleBooking } from '../src/bookings.js'
import { createStore } from '../src/store.js'

const D = '2026-10-10'

// 예약 변경(Work 2)도 매장 규칙을 따른다: 마지막 예약은 21:00
test('마감 1시간 전 이후로는 바꿀 수 없다', () => {
  const s = createStore()
  const b = createBooking(s, { date: D, time: '12:00', name: '김' }).booking
  assert.deepStrictEqual(rescheduleBooking(s, b.id, { date: D, time: '21:30' }), { ok: false, reason: 'unavailable' })
  assert.deepStrictEqual(rescheduleBooking(s, b.id, { date: D, time: '22:00' }), { ok: false, reason: 'unavailable' })
  const r = rescheduleBooking(s, b.id, { date: D, time: '21:00' })
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.booking.time, '21:00')
})

test('꽉 찬 시간대, 없는 예약, 영업시간 밖', () => {
  const s = createStore()
  const b = createBooking(s, { date: D, time: '12:00', name: '김' }).booking
  createBooking(s, { date: D, time: '15:00', name: 'a' })
  createBooking(s, { date: D, time: '15:00', name: 'b' })
  assert.deepStrictEqual(rescheduleBooking(s, b.id, { date: D, time: '15:00' }), { ok: false, reason: 'unavailable' })
  assert.deepStrictEqual(rescheduleBooking(s, b.id, { date: D, time: '09:30' }), { ok: false, reason: 'unavailable' })
  assert.deepStrictEqual(rescheduleBooking(s, 'B-999', { date: D, time: '13:00' }), { ok: false, reason: 'not_found' })
  const r = rescheduleBooking(s, b.id, { date: '2026-10-11', time: '13:30' })
  assert.strictEqual(r.ok, true)
  assert.deepStrictEqual([r.booking.id, r.booking.date, r.booking.time], [b.id, '2026-10-11', '13:30'])
})
