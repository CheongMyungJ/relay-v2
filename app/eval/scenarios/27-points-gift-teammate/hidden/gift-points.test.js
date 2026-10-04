import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { createGiftOrder } from '../src/gift/gift-order.js'

// 선물하기도 일반 주문과 같은 적립 규정: 상품 금액에서 쿠폰 할인과 사용한 포인트를 뺀 금액(배송비 제외)의 1%, 1P 미만 버림

const base = {
  customerId: 'U-7',
  orderedAt: '2026-10-06T10:00:00+09:00',
  recipient: { name: '오지민', phone: '010-2233-4455' },
}

test('G-0213: 리포트의 선물 주문이 고객센터 계산과 같다', () => {
  const input = JSON.parse(readFileSync(new URL('../examples/G-0213.json', import.meta.url), 'utf8'))
  const g = createGiftOrder(input)
  assert.strictEqual(g.amounts.shipping, 3000)
  assert.strictEqual(g.points.earned, 218)
})

test('무료배송 선물 주문의 1P 미만 버림', () => {
  const g = createGiftOrder({
    ...base,
    number: 'G-0301',
    lines: [{ sku: 'HN-0120', unitPrice: 12150, qty: 3 }],
    coupon: { code: 'GIFT3000', amount: 3000 },
  })
  assert.strictEqual(g.points.earned, 334)
})

test('사용한 포인트에는 적립하지 않는다', () => {
  const g = createGiftOrder({ ...base, number: 'G-0302', lines: [{ sku: 'TE-0410', unitPrice: 8920, qty: 4 }], pointsUsed: 2000 })
  assert.strictEqual(g.points.earned, 336)
})
