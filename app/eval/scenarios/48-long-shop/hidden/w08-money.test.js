import assert from 'node:assert/strict'
import { test } from 'node:test'
import { atKst, paidOrder, shop, to } from './shop-setup.js'

test('방해 금지 시간의 환불 알림은 메일만, 문자는 보내지도 미루지도 않는다', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  atKst(s, '2026-03-03 23:00')
  const before = to(s.channels.sms, '010-1234-5678').length
  s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  assert.ok(to(s.channels.email, 'hana@example.com').some((m) => m.body.includes('10,572원')))
  assert.equal(to(s.channels.sms, '010-1234-5678').length, before)
  assert.equal(s.notifier.pending().length, 0)
  atKst(s, '2026-03-04 09:00')
  s.notifier.flush()
  assert.equal(to(s.channels.sms, '010-1234-5678').length, before)
})

test('밤 9시 반의 환불은 문자도 간다', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  atKst(s, '2026-03-03 21:30')
  s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  assert.ok(to(s.channels.sms, '010-1234-5678').some((m) => m.body.includes('10,572원')))
})

test('새벽 6시의 후불 송장도 메일만', () => {
  const s = shop()
  atKst(s, '2026-03-04 06:00')
  s.billing.issueManualInvoice({ customerId: 'c-1', lines: [{ name: '납품', amount: 55000 }] })
  assert.equal(to(s.channels.email, 'hana@example.com').length, 1)
  assert.equal(to(s.channels.sms, '010-1234-5678').length, 0)
  assert.equal(s.notifier.pending().length, 0)
})

test('돈 알림이 아닌 배송 소식은 전처럼 아침으로 미룬다', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  const o = paidOrder(s, 'c-1', [['MUG', 1]])
  atKst(s, '2026-03-03 23:00')
  s.orders.ship(o.id, { carrier: 'cj', trackingNo: '1' })
  assert.equal(s.notifier.pending().length, 1)
  assert.equal(s.notifier.pending()[0].dueAt, '2026-03-03T22:00:00.000Z')
})
