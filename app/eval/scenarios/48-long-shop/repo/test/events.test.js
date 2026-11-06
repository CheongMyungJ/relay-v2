import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createBus } from '../src/shared/events.js'
import { createIds } from '../src/shared/ids.js'
import { DomainError, fail } from '../src/shared/errors.js'
import { createClock } from '../src/clock.js'

test('구독한 차례대로 바로 부른다', () => {
  const bus = createBus()
  const calls = []
  bus.on('a', (p) => calls.push(`1:${p.n}`))
  const off = bus.on('a', (p) => calls.push(`2:${p.n}`))
  bus.emit('a', { n: 1 })
  off()
  bus.emit('a', { n: 2 })
  assert.deepEqual(calls, ['1:1', '2:1', '1:2'])
  assert.deepEqual(bus.history().map((e) => e.payload.n), [1, 2])
})

test('구독자의 오류는 낸 쪽으로 올라간다', () => {
  const bus = createBus()
  bus.on('a', () => fail('BOOM', '터짐'))
  assert.throws(() => bus.emit('a', {}), (e) => e instanceof DomainError && e.code === 'BOOM')
})

test('id는 접두어마다 센다', () => {
  const ids = createIds()
  assert.deepEqual([ids.next('ord'), ids.next('ord'), ids.next('inv')], ['ord-1', 'ord-2', 'inv-1'])
})

test('시계', () => {
  const clock = createClock('2026-03-02T00:00:00Z')
  clock.advance(60_000)
  assert.equal(clock.now().toISOString(), '2026-03-02T00:01:00.000Z')
  clock.set('2026-03-05T00:00:00Z')
  assert.equal(clock.now().toISOString(), '2026-03-05T00:00:00.000Z')
  assert.throws(() => clock.set('어제'))
  assert.throws(() => createClock('nope'))
})
