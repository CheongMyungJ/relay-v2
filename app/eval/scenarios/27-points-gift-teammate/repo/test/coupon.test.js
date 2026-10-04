import { test } from 'node:test'
import assert from 'node:assert'
import { couponDiscount } from '../src/cart/coupon.js'

test('금액 할인', () => {
  assert.strictEqual(couponDiscount(12000, { code: 'A', amount: 3000 }), 3000)
})

test('비율 할인은 10원 단위 버림, 최대 할인', () => {
  assert.strictEqual(couponDiscount(12345, { code: 'B', percent: 10 }), 1230)
  assert.strictEqual(couponDiscount(90000, { code: 'B', percent: 10, max: 5000 }), 5000)
})

test('최소 주문 금액', () => {
  assert.throws(() => couponDiscount(19990, { code: 'C', amount: 3000, minGoods: 20000 }), /최소 주문 금액/)
})

test('할인은 상품 금액을 넘지 않는다', () => {
  assert.strictEqual(couponDiscount(2000, { code: 'D', amount: 3000 }), 2000)
})
