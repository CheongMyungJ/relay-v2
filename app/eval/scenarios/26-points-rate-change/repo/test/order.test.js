import { test } from 'node:test'
import assert from 'node:assert'
import { createOrder, orderAmounts } from '../src/orders/order.js'

const base = { customerId: 'U-1', orderedAt: '2026-10-01T10:00:00+09:00' }

test('쿠폰을 뺀 상품 금액이 30,000원 이상이면 배송비 무료', () => {
  const a = orderAmounts([{ sku: 'A', unitPrice: 16000, qty: 2 }], { code: 'C', amount: 2000 })
  assert.deepStrictEqual(a, { goods: 32000, coupon: 2000, shipping: 0, pointsUsed: 0, total: 30000 })
})

test('30,000원 미만이면 배송비 3,000원', () => {
  const a = orderAmounts([{ sku: 'A', unitPrice: 16000, qty: 2 }], { code: 'C', amount: 3000 })
  assert.strictEqual(a.shipping, 3000)
  assert.strictEqual(a.total, 32000)
})

test('사용한 포인트는 결제 금액에서 뺀다', () => {
  const o = createOrder({ ...base, number: 'O-0001', lines: [{ sku: 'A', unitPrice: 20000, qty: 2 }], pointsUsed: 1000 })
  assert.strictEqual(o.amounts.total, 39000)
  assert.strictEqual(o.points.used, 1000)
})

test('적립 포인트를 주문에 저장한다', () => {
  const o = createOrder({ ...base, number: 'O-0002', lines: [{ sku: 'A', unitPrice: 25000, qty: 2 }] })
  assert.strictEqual(o.points.earned, 500)
})

test('주문 번호 형식', () => {
  assert.throws(() => createOrder({ ...base, number: 'O-12', lines: [{ sku: 'A', unitPrice: 1000 }] }), /O-0000/)
})
