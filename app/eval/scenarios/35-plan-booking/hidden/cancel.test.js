import { test } from 'node:test'
import assert from 'node:assert'
import { cancelBooking, createBooking, listBookings } from '../src/booking.js'
import { at, slot, store } from './helpers.js'

const before = at('08:00', '2026-11-01')

test('B3: 취소한 예약은 목록에 cancelled로 남는다', () => {
  const s = store()
  const b = createBooking(s, slot('10:00', '11:00'))
  const c = cancelBooking(s, b.id, { now: before })
  assert.equal(c.status, 'cancelled')
  const list = listBookings(s, 'A')
  assert.equal(list.length, 1)
  assert.equal(list[0].status, 'cancelled')
})

test('B3: 취소한 예약은 겹침 판정에서 빠진다', () => {
  const s = store()
  const b = createBooking(s, slot('10:00', '11:00'))
  cancelBooking(s, b.id, { now: before })
  const again = createBooking(s, slot('10:30', '11:30', { by: 'lee' }))
  assert.equal(again.status, 'active')
})

test('없는 id는 NOT_FOUND', () => {
  const s = store()
  assert.throws(() => cancelBooking(s, 999, { now: before }), { code: 'NOT_FOUND' })
})
