import { test } from 'node:test'
import assert from 'node:assert'
import { cancelOrder, createRefund } from '../src/orders/refund.js'

const order = {
  number: 'O-0100',
  customerId: 'U-1',
  lines: [
    { sku: 'A', name: 'A', unitPrice: 20000, qty: 2 },
    { sku: 'B', name: 'B', unitPrice: 10000, qty: 1 },
  ],
  coupon: null,
  amounts: { goods: 50000, coupon: 0, shipping: 0, pointsUsed: 0, total: 50000 },
  points: { used: 0, earned: 500 },
}

test('부분 환불: 돌려받는 상품 금액을 환불한다', () => {
  const r = createRefund(order, { number: 'R-0001', items: [{ sku: 'B', qty: 1 }] })
  assert.strictEqual(r.refundAmount, 10000)
  assert.strictEqual(r.pointsRecovered, 100)
})

test('남은 수량보다 많이 환불할 수 없다', () => {
  assert.throws(
    () => createRefund(order, { number: 'R-0002', items: [{ sku: 'A', qty: 2 }], alreadyRefunded: [{ sku: 'A', qty: 1 }] }),
    /남은 수량 1/,
  )
})

test('전체 취소는 저장된 금액과 포인트를 모두 돌려놓는다', () => {
  assert.deepStrictEqual(cancelOrder(order), { orderNumber: 'O-0100', refundAmount: 50000, pointsRecovered: 500, pointsReturned: 0 })
})
