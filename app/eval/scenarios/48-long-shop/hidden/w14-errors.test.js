import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasCode, paidOrder, placed, shop } from './shop-setup.js'

const charges = (s, number) => s.payments.listFor(number).filter((p) => p.kind === 'charge').length

test('취소한 주문이나 이미 결제한 주문은 결제할 수 없다(돈을 받지 않는다)', () => {
  const s = shop()
  const a = placed(s, 'c-1', [['MUG', 1]])
  s.orders.cancelOrder(a.id)
  assert.throws(() => s.orders.pay(a.id, { cardToken: 'tok-ok' }), hasCode('BAD_STATUS'))
  assert.equal(charges(s, a.number), 0)
  const b = paidOrder(s, 'c-1', [['MUG', 1]])
  assert.throws(() => s.orders.pay(b.id, { cardToken: 'tok-ok' }), hasCode('BAD_STATUS'))
  assert.equal(charges(s, b.number), 1)
})

test('잘못된 배송과 배송 완료는 BAD_STATUS', () => {
  const s = shop()
  const a = placed(s, 'c-1', [['MUG', 1]])
  assert.throws(() => s.orders.ship(a.id), hasCode('BAD_STATUS'))
  const b = paidOrder(s, 'c-1', [['MUG', 1]])
  assert.throws(() => s.orders.deliver(b.id), hasCode('BAD_STATUS'))
  s.orders.ship(b.id)
  assert.throws(() => s.orders.ship(b.id), hasCode('BAD_STATUS'))
  s.orders.deliver(b.id)
  assert.equal(s.orders.getOrder(b.id).status, 'delivered')
})

test('보낸 주문과 취소한 주문은 취소할 수 없다(일부 취소도)', () => {
  const s = shop()
  const a = paidOrder(s, 'c-1', [['MUG', 2]])
  s.orders.ship(a.id)
  assert.throws(() => s.orders.cancelOrder(a.id), hasCode('BAD_STATUS'))
  assert.throws(() => s.orders.cancelLines(a.id, [{ sku: 'MUG', qty: 1 }]), hasCode('BAD_STATUS'))
  const b = paidOrder(s, 'c-1', [['MUG', 2]])
  s.orders.cancelOrder(b.id)
  assert.throws(() => s.orders.cancelOrder(b.id), hasCode('BAD_STATUS'))
  assert.throws(() => s.orders.cancelLines(b.id, [{ sku: 'MUG', qty: 1 }]), hasCode('BAD_STATUS'))
  assert.equal(s.orders.getOrder(b.id).refunded, b.total)
})

test('옳은 길은 그대로', () => {
  const s = shop()
  const a = paidOrder(s, 'c-1', [['MUG', 2], ['PEN', 1]])
  s.orders.cancelLines(a.id, [{ sku: 'PEN', qty: 1 }])
  assert.equal(s.orders.getOrder(a.id).status, 'paid')
  s.orders.ship(a.id)
  s.orders.deliver(a.id)
  assert.deepEqual(
    s.orders.getOrder(a.id).history.map((h) => h.status).filter((x, i, all) => x !== all[i - 1]),
    ['placed', 'paid', 'shipped', 'delivered'],
  )
})
