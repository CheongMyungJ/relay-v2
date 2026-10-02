import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createVirtualClock } from '../src/clock.js'
import { loadConfig } from '../src/config/load.js'
import { createDeduper } from '../src/dedupe/deduper.js'
import { dedupeKey } from '../src/dedupe/key.js'
import { createTtlStore } from '../src/dedupe/store.js'
import { receive } from '../src/intake/receive.js'
import { shippedEvent, START } from './helpers.js'

const config = loadConfig()

test('키는 추적용 값과 본문에 영향받지 않는다', () => {
  const clock = createVirtualClock(START)
  const a = receive(shippedEvent({ traceId: 't-1' }), { clock, config })
  const b = receive(shippedEvent({ traceId: 't-2', deliveryAttempt: 2, data: { orderNo: 'A-1001', carrier: 'x', trackingNo: 'y' } }), { clock, config })
  assert.equal(dedupeKey(a), dedupeKey(b))
})

test('다른 이벤트는 다른 키', () => {
  const clock = createVirtualClock(START)
  const a = receive(shippedEvent(), { clock, config })
  const b = receive(shippedEvent({ id: 'ord-1002-shipped' }), { clock, config })
  const c = receive(shippedEvent({ userId: 'u-2' }), { clock, config })
  assert.notEqual(dedupeKey(a), dedupeKey(b))
  assert.notEqual(dedupeKey(a), dedupeKey(c))
})

test('같은 이벤트를 한꺼번에 두 번 받으면 한 번만 통과', () => {
  const clock = createVirtualClock(START)
  const deduper = createDeduper({ clock, windowMs: 60_000, maxEntries: 100 })
  const raw = shippedEvent()
  assert.equal(deduper.checkAndMark(receive(raw, { clock, config })), false)
  assert.equal(deduper.checkAndMark(receive(raw, { clock, config })), true)
  assert.equal(deduper.size(), 1)
})

test('만료 시간이 지나면 잊는다', () => {
  const clock = createVirtualClock(START)
  const store = createTtlStore({ clock, ttlMs: 1000 })
  store.add('k')
  clock.advance(999)
  assert.equal(store.has('k'), true)
  clock.advance(1)
  assert.equal(store.has('k'), false)
})

test('최대 개수를 넘으면 오래된 것부터 지운다', () => {
  const clock = createVirtualClock(START)
  const store = createTtlStore({ clock, ttlMs: 60_000, maxEntries: 2 })
  store.add('a')
  store.add('b')
  store.add('c')
  assert.deepEqual([store.has('a'), store.has('b'), store.has('c')], [false, true, true])
})
