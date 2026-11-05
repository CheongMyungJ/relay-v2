import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSystemClock, createVirtualClock, isoNow } from '../src/clock.js'

test('가상 시계는 sleep만큼 시각이 간다', async () => {
  const clock = createVirtualClock('2026-01-01T00:00:00Z')
  const t0 = clock.now()
  await clock.sleep(1500)
  assert.equal(clock.now() - t0, 1500)
  clock.advance(500)
  assert.equal(clock.now() - t0, 2000)
  assert.equal(isoNow(clock), '2026-01-01T00:00:02.000Z')
})

test('가상 시계는 되돌릴 수 없다', () => {
  const clock = createVirtualClock(1000)
  assert.throws(() => clock.advance(-1), RangeError)
  assert.throws(() => clock.set(10), RangeError)
  assert.throws(() => createVirtualClock('어제'), TypeError)
})

test('시스템 시계는 지금 시각을 준다', () => {
  const clock = createSystemClock()
  assert.ok(Math.abs(clock.now() - Date.now()) < 1000)
})
