import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createVirtualClock } from '../src/clock.js'
import { loadConfig } from '../src/config/load.js'
import { IntakeError, intakeLagMs, parseBody, receive } from '../src/intake/receive.js'
import { shippedEvent, START } from './helpers.js'

const config = loadConfig()

test('이벤트를 내부 모양으로 바꾸고 수신 시각을 붙인다', () => {
  const clock = createVirtualClock(START)
  const event = receive(shippedEvent({ type: ' Order.Shipped ', userId: 42, traceId: 't-1' }), { clock, config })
  assert.equal(event.type, 'order.shipped')
  assert.equal(event.userId, '42')
  assert.equal(event.traceId, 't-1')
  assert.equal(event.receivedAt, clock.now())
  assert.equal(intakeLagMs(event), 2000)
})

test('모르는 출처와 종류는 거절한다', () => {
  const clock = createVirtualClock(START)
  assert.throws(() => receive(shippedEvent({ source: 'crm' }), { clock, config }), IntakeError)
  assert.throws(() => receive(shippedEvent({ type: 'order.lost' }), { clock, config }), IntakeError)
})

test('문제를 모두 모아 알린다', () => {
  const clock = createVirtualClock(START)
  try {
    receive({ id: '', source: 'orders', type: 'order.shipped', occurredAt: 'x' }, { clock, config })
    assert.fail('던져야 한다')
  } catch (err) {
    assert.equal(err.problems.length, 4)
  }
})

test('너무 먼 미래의 이벤트는 거절한다', () => {
  const clock = createVirtualClock(START)
  assert.throws(() => receive(shippedEvent({ occurredAt: '2026-09-21T02:00:00Z' }), { clock, config }), /미래/)
})

test('data가 너무 크면 거절한다', () => {
  const clock = createVirtualClock(START)
  const data = { note: 'x'.repeat(20_000) }
  assert.throws(() => receive(shippedEvent({ data }), { clock, config }), /너무 크다/)
})

test('웹훅 본문 읽기', () => {
  assert.equal(parseBody('{"id":"a"}').length, 1)
  assert.equal(parseBody('[{"id":"a"},{"id":"b"}]').length, 2)
  assert.throws(() => parseBody('nope'), IntakeError)
  assert.throws(() => parseBody('42'), IntakeError)
})
