import { test } from 'node:test'
import assert from 'node:assert'
import { createWeekly, listBookings } from '../src/booking.js'
import { slot, store } from './helpers.js'

test('반복은 1~12주. 벗어나면 INVALID_WEEKS이고 아무것도 만들지 않는다', () => {
  const s = store()
  assert.throws(() => createWeekly(s, { ...slot('10:00', '11:00'), weeks: 13 }), { code: 'INVALID_WEEKS' })
  assert.throws(() => createWeekly(s, { ...slot('10:00', '11:00'), weeks: 0 }), { code: 'INVALID_WEEKS' })
  assert.equal(listBookings(s, 'A').length, 0)
  assert.equal(createWeekly(s, { ...slot('10:00', '11:00'), weeks: 12 }).length, 12)
})
