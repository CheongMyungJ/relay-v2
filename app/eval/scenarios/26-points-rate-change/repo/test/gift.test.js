import { test } from 'node:test'
import assert from 'node:assert'
import { createGiftOrder } from '../src/gift/gift-order.js'

const base = {
  customerId: 'U-1',
  recipient: { name: '김하늘', phone: '010-1234-5678' },
  lines: [{ sku: 'A', unitPrice: 15000, qty: 2 }],
}

test('선물하기 주문의 금액은 일반 주문과 같다', () => {
  const g = createGiftOrder({ ...base, number: 'G-0001', message: '생일 축하해' })
  assert.deepStrictEqual(g.amounts, { goods: 30000, coupon: 0, shipping: 0, pointsUsed: 0, total: 30000 })
  assert.strictEqual(g.points.earned, 300)
})

test('메시지 카드는 60자까지', () => {
  assert.throws(() => createGiftOrder({ ...base, number: 'G-0002', message: '가'.repeat(61) }), /60자/)
})

test('받는 사람 전화번호 형식', () => {
  assert.throws(() => createGiftOrder({ ...base, number: 'G-0003', recipient: { name: '김하늘', phone: '01012345678' } }), /010-0000-0000/)
})
