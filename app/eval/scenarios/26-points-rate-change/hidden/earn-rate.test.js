import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { createOrder } from '../src/orders/order.js'

// 적립률 2%. 적립 규정(쿠폰 할인과 사용 포인트를 뺀 상품 금액, 배송비 제외, 1P 미만 버림)은 그대로다

const base = { customerId: 'U-9', orderedAt: '2026-10-12T10:00:00+09:00' }

test('적립률 2%', () => {
  const o = createOrder({ ...base, number: 'O-2201', lines: [{ sku: 'A', unitPrice: 25000, qty: 2 }] })
  assert.strictEqual(o.points.earned, 1000)
})

test('2%에도 기준 금액과 버림은 그대로', () => {
  const o = createOrder({ ...base, number: 'O-2202', lines: [{ sku: 'A', unitPrice: 17545, qty: 3 }], pointsUsed: 3000 })
  assert.strictEqual(o.points.earned, 992)
})

test('O-1107: 리포트의 주문이 고객센터 안내와 같다', () => {
  const input = JSON.parse(readFileSync(new URL('../examples/O-1107.json', import.meta.url), 'utf8'))
  assert.strictEqual(createOrder(input).points.earned, 486)
})
