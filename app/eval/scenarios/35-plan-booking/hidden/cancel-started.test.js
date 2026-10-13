import { test } from 'node:test'
import assert from 'node:assert'
import { cancelBooking, createBooking, listBookings } from '../src/booking.js'
import { at, slot, store } from './helpers.js'

test('이미 시작한 예약(지금이 시작과 같거나 뒤)은 ALREADY_STARTED, 상태는 그대로', () => {
  const s = store()
  const b = createBooking(s, slot('10:00', '11:00'))
  assert.throws(() => cancelBooking(s, b.id, { now: at('10:00') }), { code: 'ALREADY_STARTED' })
  assert.throws(() => cancelBooking(s, b.id, { now: at('10:30') }), { code: 'ALREADY_STARTED' })
  assert.equal(listBookings(s, 'A')[0].status, 'active')
  assert.equal(cancelBooking(s, b.id, { now: at('09:59') }).status, 'cancelled')
})
