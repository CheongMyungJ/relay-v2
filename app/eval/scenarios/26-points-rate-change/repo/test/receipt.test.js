import { test } from 'node:test'
import assert from 'node:assert'
import { receiptLines } from '../src/format/receipt.js'

test('영수증 줄', () => {
  const order = {
    number: 'O-0200',
    amounts: { goods: 32000, coupon: 2000, shipping: 0, pointsUsed: 1000, total: 29000 },
    points: { used: 1000, earned: 290 },
  }
  assert.deepStrictEqual(receiptLines(order), [
    '주문 O-0200',
    '상품 금액          32,000원',
    '쿠폰 할인          -2,000원',
    '배송비                 0원',
    '포인트 사용         -1,000원',
    '결제 금액          29,000원',
    '적립 예정             290P',
  ])
})
