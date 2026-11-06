import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addDays, daysBetween, fromKst, kstDate, kstDateTime, kstParts } from '../src/shared/time.js'

test('UTC 시각을 한국 날짜로 읽는다', () => {
  assert.equal(kstDate('2026-02-28T15:30:00Z'), '2026-03-01')
  assert.equal(kstDateTime('2026-03-02T01:05:00Z'), '2026-03-02 10:05')
  assert.equal(kstParts('2026-03-01T15:00:00Z').weekday, 1)
})

test('한국 시각을 UTC로', () => {
  assert.equal(fromKst(2026, 3, 2, 8).toISOString(), '2026-03-01T23:00:00.000Z')
})

test('날 수 세기', () => {
  assert.equal(daysBetween('2026-03-01T00:00:00Z', '2026-03-11T00:00:00Z'), 10)
  assert.equal(daysBetween('2026-03-11T00:00:00Z', '2026-03-01T00:00:00Z'), 0)
  assert.equal(addDays('2026-03-01T00:00:00Z', 14).toISOString(), '2026-03-15T00:00:00.000Z')
})
