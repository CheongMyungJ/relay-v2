import { test } from 'node:test'
import assert from 'node:assert'
import { createOrder } from '../src/orders/order.js'

// 적립 규정: 적립 포인트는 상품 금액에서 쿠폰 할인과 사용한 포인트를 뺀 금액(배송비 제외)의 1%, 1P 미만 버림.
// 여기 예시는 소수점 아래가 0.5 미만이라 버림과 반올림이 같고, 기준 금액만 가린다

const base = { customerId: 'U-9', orderedAt: '2026-10-05T10:00:00+09:00' }

test('배송비는 적립 기준에 넣지 않는다', () => {
  const o = createOrder({
    ...base,
    number: 'O-2001',
    lines: [
      { sku: 'TE-0410', unitPrice: 8900, qty: 1 },
      { sku: 'RC-0715', unitPrice: 15930, qty: 1 },
    ],
    coupon: { code: 'APP2000', amount: 2000 },
  })
  assert.strictEqual(o.amounts.shipping, 3000)
  assert.strictEqual(o.points.earned, 228)
})

test('쿠폰 할인 뒤 금액에 적립한다', () => {
  const o = createOrder({
    ...base,
    number: 'O-2002',
    lines: [{ sku: 'KT-2290', unitPrice: 20960, qty: 2 }],
    coupon: { code: 'TEN', percent: 10, max: 5000 },
  })
  assert.strictEqual(o.amounts.coupon, 4190)
  assert.strictEqual(o.points.earned, 377)
})

test('사용한 포인트에는 적립하지 않는다', () => {
  const o = createOrder({
    ...base,
    number: 'O-2003',
    lines: [{ sku: 'SN-1135', unitPrice: 13740, qty: 3 }],
    pointsUsed: 3000,
  })
  assert.strictEqual(o.points.earned, 382)
})
