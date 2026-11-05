import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createVirtualClock } from '../src/clock.js'
import { createDeliveryLog } from '../src/dispatch/delivery-log.js'

test('기록 찾기와 요약', () => {
  const clock = createVirtualClock(0)
  const log = createDeliveryLog({ clock })
  log.record({ eventId: 'e1', channel: 'mail', attempt: 1, status: 'sent' })
  clock.advance(1000)
  log.record({ eventId: 'e2', channel: 'mail', attempt: 1, status: 'failed' })
  log.record({ eventId: 'e2', channel: 'push', attempt: 1, status: 'sent' })
  assert.equal(log.search({ channel: 'mail' }).length, 2)
  assert.deepEqual(log.search({ since: 500 }).map((e) => e.eventId), ['e2', 'e2'])
  assert.deepEqual(log.summary(), { mail: { sent: 1, failed: 1 }, push: { sent: 1 } })
  assert.deepEqual(log.latest('e2'), { mail: 'failed', push: 'sent' })
})

test('한도를 넘으면 오래된 기록부터 버린다', () => {
  const clock = createVirtualClock(0)
  const log = createDeliveryLog({ clock, limit: 2 })
  for (const id of ['a', 'b', 'c']) log.record({ eventId: id, channel: 'mail', status: 'sent' })
  assert.deepEqual(log.entries().map((e) => e.eventId), ['b', 'c'])
})
