import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paidOrder, shop } from './shop-setup.js'

const refunds = (s, number) =>
  s.payments.listFor(number).filter((p) => p.kind === 'refund').reduce((sum, p) => sum + p.amount, 0)

test('일부 취소의 환불은 쿠폰 할인의 그 줄 몫(원 미만 버림)을 뺀다', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  const { refund, order } = s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  // 5,000 × 12,000 / 42,000 = 1,428.57 → 1,428
  assert.equal(refund, 10572)
  assert.equal(order.status, 'paid')
  assert.equal(order.lines.find((l) => l.sku === 'MUG').cancelledQty, 1)
  assert.equal(order.lines.find((l) => l.sku === 'TEA').cancelledQty, 0)
  assert.equal(s.catalog.get('MUG').stock, 50)
  assert.equal(refunds(s, o.number), 10572)
})

test('수량 일부만 취소', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 3], ['PEN', 1]], { coupon: 'SPRING5' })
  const { refund } = s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 2 }])
  // 24,000 − ⌊5,000 × 24,000 / 38,000⌋ = 24,000 − 3,157
  assert.equal(refund, 20843)
  assert.equal(s.catalog.get('MUG').stock, 49)
  assert.equal(s.orders.getOrder(o.id).lines.find((l) => l.sku === 'MUG').cancelledQty, 2)
})

test('쿠폰이 없으면 줄 금액 그대로, 배송비는 돌려주지 않는다', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['PEN', 2]])
  assert.ok(o.shipping > 0)
  assert.equal(s.orders.cancelLines(o.id, [{ sku: 'PEN', qty: 2 }]).refund, 4000)
})

test('남은 상품을 모두 취소하면 주문 취소이고 남은 금액(배송비 포함)을 돌려준다', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  const { refund, order } = s.orders.cancelLines(o.id, [{ sku: 'TEA', qty: 1 }])
  assert.equal(refund, o.total - 10572)
  assert.equal(order.status, 'cancelled')
  assert.equal(refunds(s, o.number), o.total)
})

test('일부 취소한 뒤 주문 전체 취소는 남은 금액만 돌려준다', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  assert.equal(s.orders.cancelOrder(o.id).refund, o.total - 10572)
  assert.equal(s.catalog.get('TEA').stock, 50)
})

test('결제 전 주문의 일부 취소는 환불이 없다', () => {
  const s = shop()
  const o = s.orders.placeOrder({ customerId: 'c-1', cart: s.newCart().add('MUG').add('PEN') })
  assert.equal(s.orders.cancelLines(o.id, [{ sku: 'PEN', qty: 1 }]).refund, 0)
  assert.equal(s.catalog.get('PEN').stock, 50)
})
