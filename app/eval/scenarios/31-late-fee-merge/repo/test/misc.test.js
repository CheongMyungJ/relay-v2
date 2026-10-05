import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { dueForCheck, recordCheck, resetChecks } from '../src/maintenance/schedule.js'
import { cancelReservation, clearReservations, reserve } from '../src/reservations/reservations.js'
import { maybePromote } from '../src/members/grade.js'
import { getMember, setGrade } from '../src/members/members.js'

beforeEach(() => {
  resetChecks()
  clearReservations()
})

test('점검 일정', () => {
  for (const id of ['T-100', 'T-101', 'T-200', 'T-201', 'T-300', 'T-301', 'T-400', 'T-401']) recordCheck(id, '2026-09-01')
  assert.deepEqual(
    dueForCheck('2026-10-05').map((x) => [x.toolId, x.overdueDays]),
    [
      ['T-100', 4],
      ['T-101', 4],
    ],
  )
})

test('예약은 겹치면 안 된다', () => {
  const b = reserve({ memberId: 'M-1', toolId: 'T-100', from: '2026-10-10', days: 3 })
  assert.throws(() => reserve({ memberId: 'M-2', toolId: 'T-100', from: '2026-10-12', days: 2 }), /이미 예약/)
  reserve({ memberId: 'M-2', toolId: 'T-100', from: '2026-10-13', days: 2 })
  assert.equal(cancelReservation(b.id), true)
})

test('등급 올리기', () => {
  assert.equal(maybePromote('M-3', 9), false)
  assert.equal(maybePromote('M-3', 10), true)
  assert.equal(getMember('M-3').grade, 'plus')
  setGrade('M-3', 'basic')
})
