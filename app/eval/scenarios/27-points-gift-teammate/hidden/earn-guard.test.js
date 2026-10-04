import { test } from 'node:test'
import assert from 'node:assert'
import { receiptLines } from '../src/format/receipt.js'
import { createOrder } from '../src/orders/order.js'
import { cancelOrder } from '../src/orders/refund.js'

// 지키기: 주문 금액, 저장된 적립 포인트를 쓰는 곳(영수증, 전체 취소), 영수증 글자는 그대로여야 한다

const stored = {
  number: 'O-0950',
  customerId: 'U-3',
  lines: [{ sku: 'A', name: 'A', unitPrice: 12345, qty: 2 }],
  coupon: null,
  amounts: { goods: 24690, coupon: 0, shipping: 3000, pointsUsed: 0, total: 27690 },
  points: { used: 0, earned: 277 },
}

test('저장된 주문의 영수증은 저장된 적립 포인트를 그대로 보인다', () => {
  assert.deepStrictEqual(receiptLines(stored), [
    '주문 O-0950',
    '상품 금액          24,690원',
    '배송비             3,000원',
    '결제 금액          27,690원',
    '적립 예정             277P',
  ])
})

test('전체 취소는 저장된 적립 포인트를 회수한다', () => {
  assert.deepStrictEqual(cancelOrder(stored), { orderNumber: 'O-0950', refundAmount: 27690, pointsRecovered: 277, pointsReturned: 0 })
})

test('주문 금액 계산은 그대로', () => {
  const o = createOrder({
    customerId: 'U-3',
    number: 'O-0951',
    lines: [{ sku: 'A', unitPrice: 12345, qty: 2 }, { sku: 'B', unitPrice: 4990, qty: 1 }],
    coupon: { code: 'P', percent: 5 },
    pointsUsed: 1200,
  })
  assert.deepStrictEqual(o.amounts, { goods: 29680, coupon: 1480, shipping: 3000, pointsUsed: 1200, total: 30000 })
  assert.throws(() => createOrder({ customerId: 'U-3', number: 'O-0952', lines: [{ sku: 'A', unitPrice: 5000 }], pointsUsed: 900 }), /1000P부터/)
})
