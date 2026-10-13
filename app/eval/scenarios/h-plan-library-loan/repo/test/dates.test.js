import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, diffDays, weekday } from '../src/util/dates.js'

test('날짜 더하기와 빼기', () => {
  assert.equal(addDays('2026-10-06', 14), '2026-10-20')
  assert.equal(addDays('2026-12-30', 3), '2027-01-02')
  assert.equal(diffDays('2026-10-20', '2026-10-06'), 14)
})

test('요일', () => {
  assert.equal(weekday('2026-10-12'), 1)
  assert.equal(weekday('2026-10-13'), 2)
})

test('형식이 틀리면 던진다', () => {
  assert.throws(() => addDays('2026/10/06', 1))
})
