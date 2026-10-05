import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, daysBetween, daysInMonth, isWeekend, monthOf, parseDate } from '../src/util/dates.js'

test('daysBetween은 날짜만 센다', () => {
  assert.equal(daysBetween('2026-09-04', '2026-09-04'), 0)
  assert.equal(daysBetween('2026-09-04', '2026-09-07'), 3)
  assert.equal(daysBetween('2026-09-07', '2026-09-04'), -3)
  assert.equal(daysBetween('2026-02-27', '2026-03-02'), 3)
})

test('addDays와 달 계산', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02')
  assert.equal(monthOf('2026-10-05'), '2026-10')
  assert.equal(daysInMonth('2026-02'), 28)
  assert.equal(daysInMonth('2028-02'), 29)
  assert.equal(isWeekend('2026-10-03'), true)
})

test('틀린 날짜 형식은 오류', () => {
  assert.throws(() => parseDate('2026/10/05'), /날짜 형식/)
})
