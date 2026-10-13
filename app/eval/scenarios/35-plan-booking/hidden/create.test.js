import { test } from 'node:test'
import assert from 'node:assert'
import { createBooking, listBookings } from '../src/booking.js'
import { slot, store } from './helpers.js'

test('B1: 정각이나 30분이 아니면 INVALID_SLOT', () => {
  const s = store()
  assert.throws(() => createBooking(s, slot('10:15', '11:00')), { code: 'INVALID_SLOT' })
  assert.throws(() => createBooking(s, slot('10:00', '10:45')), { code: 'INVALID_SLOT' })
})

test('B1: 끝이 시작과 같거나 앞이면 INVALID_SLOT', () => {
  const s = store()
  assert.throws(() => createBooking(s, slot('10:00', '10:00')), { code: 'INVALID_SLOT' })
  assert.throws(() => createBooking(s, slot('11:00', '10:00')), { code: 'INVALID_SLOT' })
})

test('만든 예약의 모양', () => {
  const s = store()
  const b = createBooking(s, slot('10:00', '11:00'))
  assert.equal(typeof b.id, 'number')
  assert.equal(b.status, 'active')
  assert.equal(b.room, 'A')
  assert.equal(b.by, 'kim')
})

test('B2: 겹치면 OVERLAP, 끝과 시작이 같으면 겹치지 않음, 다른 회의실은 따로', () => {
  const s = store()
  createBooking(s, slot('10:00', '11:00'))
  assert.throws(() => createBooking(s, slot('10:30', '11:30')), { code: 'OVERLAP' })
  assert.throws(() => createBooking(s, slot('09:00', '12:00')), { code: 'OVERLAP' })
  createBooking(s, slot('11:00', '12:00'))
  createBooking(s, slot('09:00', '10:00'))
  createBooking(s, slot('10:00', '11:00', { room: 'B' }))
  assert.deepEqual(
    listBookings(s, 'A').map((b) => b.start.slice(11)),
    ['09:00', '10:00', '11:00'],
  )
  assert.equal(listBookings(s, 'B').length, 1)
})
