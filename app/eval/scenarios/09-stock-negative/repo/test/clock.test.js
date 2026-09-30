import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClock, inRange, kstDate, kstWeek } from '../src/util/clock.js'

test('고정 시계는 advance로만 움직인다', () => {
  const clock = createClock('2026-09-30T00:00:00Z')
  assert.equal(clock.iso(), '2026-09-30T00:00:00.000Z')
  clock.advance(60_000)
  assert.equal(clock.iso(), '2026-09-30T00:01:00.000Z')
  assert.throws(() => createClock().advance(1))
})

test('한국 시간 날짜', () => {
  assert.equal(kstDate(new Date('2026-09-30T15:30:00Z')), '2026-10-01')
  assert.equal(kstDate(new Date('2026-09-30T14:59:00Z')), '2026-09-30')
})

test('주는 월요일부터 일요일까지(한국 시간)', () => {
  const w = kstWeek(new Date('2026-10-04T14:00:00Z')) // 일요일 23시 KST
  assert.equal(w.label, '2026-09-28 ~ 2026-10-04')
  assert.equal(inRange('2026-09-27T15:00:00Z', w), true) // 월요일 0시 KST
  assert.equal(inRange('2026-10-04T15:00:00Z', w), false)
})
