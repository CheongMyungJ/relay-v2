import { test } from 'node:test'
import assert from 'node:assert'
import { cancelOrder, createRefund } from '../src/orders/refund.js'

// 지키기: 환불 금액, 환불 검사, 전체 취소는 그대로여야 한다

const order = {
  number: 'O-2110',
  customerId: 'U-5',
  lines: [
    { sku: 'A', name: 'A', unitPrice: 18200, qty: 2 },
    { sku: 'B', name: 'B', unitPrice: 6400, qty: 1 },
  ],
  coupon: { code: 'C', amount: 3000 },
  amounts: { goods: 42800, coupon: 3000, shipping: 0, pointsUsed: 1000, total: 38800 },
  points: { used: 1000, earned: 388 },
}

test('부분 환불 금액은 돌려받는 상품 금액', () => {
  assert.strictEqual(createRefund(order, { number: 'R-0410', items: [{ sku: 'A', qty: 1 }] }).refundAmount, 18200)
})

test('환불 검사', () => {
  assert.throws(() => createRefund(order, { number: 'R-41', items: [{ sku: 'A', qty: 1 }] }), /R-0000/)
  assert.throws(() => createRefund(order, { number: 'R-0411', items: [{ sku: 'Z', qty: 1 }] }), /주문에 없는/)
  assert.throws(() => createRefund(order, { number: 'R-0412', items: [{ sku: 'A', qty: 2 }, { sku: 'B', qty: 1 }] }), /전체 취소/)
})

test('전체 취소', () => {
  assert.deepStrictEqual(cancelOrder(order), { orderNumber: 'O-2110', refundAmount: 38800, pointsRecovered: 388, pointsReturned: 1000 })
})
