import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isOpenDay, nextOpenDay } from '../src/calendar.js'

test('월요일과 공휴일은 휴관', () => {
  assert.equal(isOpenDay('2026-10-12'), false)
  assert.equal(isOpenDay('2026-10-09'), false)
  assert.equal(isOpenDay('2026-10-10'), true)
})

test('다음 개관일', () => {
  assert.equal(nextOpenDay('2026-10-10'), '2026-10-10')
  assert.equal(nextOpenDay('2026-10-09'), '2026-10-10')
  assert.equal(nextOpenDay('2026-10-12'), '2026-10-13')
  assert.equal(nextOpenDay('2026-12-31'), '2027-01-02')
})
