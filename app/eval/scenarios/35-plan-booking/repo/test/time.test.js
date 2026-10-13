import { test } from 'node:test'
import assert from 'node:assert'
import { addDays, isTime, onHalfHour, toMinutes } from '../src/time.js'

test('형식', () => {
  assert.equal(isTime('2026-11-02T09:30'), true)
  assert.equal(isTime('2026-11-02 09:30'), false)
  assert.equal(isTime('2026-13-02T09:30'), false)
})

test('정각과 30분', () => {
  assert.equal(onHalfHour('2026-11-02T09:30'), true)
  assert.equal(onHalfHour('2026-11-02T09:15'), false)
})

test('분과 날짜 더하기', () => {
  assert.equal(toMinutes('2026-11-02T10:00') - toMinutes('2026-11-02T09:30'), 30)
  assert.equal(addDays('2026-12-29T09:00', 7), '2027-01-05T09:00')
})
