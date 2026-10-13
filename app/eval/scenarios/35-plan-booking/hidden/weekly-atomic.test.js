import { test } from 'node:test'
import assert from 'node:assert'
import { cancelBooking, createBooking, createWeekly, listBookings } from '../src/booking.js'
import { at, slot, store } from './helpers.js'

test('B4: 한 회차라도 겹치면 OVERLAP이고 아무 회차도 만들지 않는다', () => {
  const s = store()
  createBooking(s, slot('10:30', '11:30', { start: at('10:30', '2026-11-16'), end: at('11:30', '2026-11-16'), by: 'lee' }))
  assert.throws(() => createWeekly(s, { ...slot('10:00', '11:00'), weeks: 4 }), { code: 'OVERLAP' })
  assert.equal(listBookings(s, 'A').length, 1)
  // 실패한 뒤에도 그 시간은 비어 있다
  createBooking(s, slot('10:00', '11:00'))
})

test('B3·B2를 반복에서도 지킨다: 취소한 예약과는 겹치지 않고, 끝과 시작이 같으면 겹치지 않는다', () => {
  const s = store()
  const old = createBooking(s, slot('10:00', '11:00', { start: at('10:00', '2026-11-09'), end: at('11:00', '2026-11-09'), by: 'lee' }))
  cancelBooking(s, old.id, { now: at('08:00', '2026-11-01') })
  createBooking(s, slot('11:00', '12:00', { start: at('11:00', '2026-11-16'), end: at('12:00', '2026-11-16'), by: 'park' }))
  const list = createWeekly(s, { ...slot('10:00', '11:00'), weeks: 3 })
  assert.equal(list.length, 3)
})

test('B1을 반복에서도 지킨다', () => {
  const s = store()
  assert.throws(() => createWeekly(s, { ...slot('10:15', '11:00'), weeks: 2 }), { code: 'INVALID_SLOT' })
  assert.equal(listBookings(s, 'A').length, 0)
})
