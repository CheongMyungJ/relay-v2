import { test } from 'node:test'
import assert from 'node:assert'
import { createWeekly, listBookings } from '../src/booking.js'
import { slot, store } from './helpers.js'

test('회차 k는 7k일 뒤, 모두 같은 series(첫 회차의 id), active', () => {
  const s = store()
  const list = createWeekly(s, { ...slot('10:00', '11:00'), weeks: 3 })
  assert.deepEqual(
    list.map((b) => [b.start, b.end]),
    [
      ['2026-11-02T10:00', '2026-11-02T11:00'],
      ['2026-11-09T10:00', '2026-11-09T11:00'],
      ['2026-11-16T10:00', '2026-11-16T11:00'],
    ],
  )
  assert.ok(list.every((b) => b.series === list[0].id && b.status === 'active'))
  assert.equal(listBookings(s, 'A').length, 3)
})

test('달을 넘는 반복', () => {
  const s = store()
  const list = createWeekly(s, { ...slot('10:00', '11:00', { start: '2026-12-28T10:00', end: '2026-12-28T11:00' }), weeks: 2 })
  assert.equal(list[1].start, '2027-01-04T10:00')
})
