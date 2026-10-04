import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { createRefund } from '../src/orders/refund.js'

// 회수 포인트 = 원래 적립 포인트(저장된 값) − 남은 상품으로 다시 계산한 적립 포인트.
// 적립 규정: 쿠폰 할인과 사용 포인트를 뺀 상품 금액(배송비 제외)의 1%, 1P 미만 버림

const read = (f) => JSON.parse(readFileSync(new URL(`../examples/${f}`, import.meta.url), 'utf8'))

test('R-0311: 리포트의 부분 환불이 정산팀 계산과 같다', () => {
  const r = createRefund(read('O-1077.json'), read('R-0311.json'))
  assert.strictEqual(r.refundAmount, 13130)
  assert.strictEqual(r.pointsRecovered, 132)
})

test('쿠폰과 사용 포인트가 없는 주문의 부분 환불', () => {
  const order = {
    number: 'O-2101',
    customerId: 'U-5',
    lines: [
      { sku: 'A', name: 'A', unitPrice: 22897, qty: 1 },
      { sku: 'B', name: 'B', unitPrice: 7348, qty: 1 },
    ],
    coupon: null,
    amounts: { goods: 30245, coupon: 0, shipping: 0, pointsUsed: 0, total: 30245 },
    points: { used: 0, earned: 302 },
  }
  const r = createRefund(order, { number: 'R-0401', items: [{ sku: 'B', qty: 1 }] })
  assert.strictEqual(r.pointsRecovered, 74)
})
