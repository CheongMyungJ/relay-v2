import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, addMonths, daysBetween, weekday } from '../src/util/dates.js'

test('날짜 계산', () => {
  assert.equal(daysBetween('2026-10-01', '2026-10-10'), 9)
  assert.equal(addDays('2026-10-30', 3), '2026-11-02')
  assert.equal(weekday('2026-10-01'), 4)
})

test('addMonths는 그달에 없는 날을 마지막 날로', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2026-10-10', 1), '2026-11-10')
  assert.equal(addMonths('2026-03-02', 12), '2027-03-02')
})
