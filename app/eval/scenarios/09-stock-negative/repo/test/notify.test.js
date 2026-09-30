import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createNotifier, knownEvents, render } from '../src/notify/notifier.js'
import { createClock } from '../src/util/clock.js'
import { createLogger, memorySink } from '../src/log/logger.js'

const clock = createClock('2026-09-30T01:00:00Z')
const config = { channels: ['email', 'slack'], from: 'no-reply@stock.local', ops: 'ops@stock.local' }

test('템플릿', () => {
  assert.ok(knownEvents().includes('order.placed'))
  assert.equal(render('order.placed', { orderId: 'ORD-1', customerId: 'c', items: 2, total: 12000 }).body, 'c님의 주문이 접수되었습니다. 상품 2종, 결제 금액 12,000원.')
  assert.throws(() => render('nope', {}))
})

test('채널마다 한 통씩 쌓고 flush로 보낸다', () => {
  const got = []
  const n = createNotifier({ config, clock, log: createLogger({ sink: memorySink() }), transports: { email: (m) => got.push(m) } })
  n.send('order.cancelled', { orderId: 'ORD-1', customerId: 'c', reason: '' })
  assert.equal(n.pending().length, 2)
  assert.equal(n.flush(), 2)
  assert.equal(got.length, 1)
  assert.equal(n.sent().length, 2)
})

test('전송이 실패하면 다시 시도하고 로그를 남긴다', () => {
  const sink = memorySink()
  let fail = true
  const n = createNotifier({
    config: { ...config, channels: ['email'] },
    clock,
    log: createLogger({ sink }),
    transports: { email: () => { if (fail) throw new Error('smtp down') } },
  })
  n.send('stock.low', { sku: 'A-100', name: '무선 마우스', warehouseName: '서울', available: 1 })
  assert.equal(n.flush(), 0)
  assert.equal(sink.entries[0].level, 'error')
  fail = false
  assert.equal(n.flush(), 1)
  assert.equal(n.sent()[0].to, 'ops@stock.local')
})
