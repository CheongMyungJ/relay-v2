import { test } from 'node:test'
import assert from 'node:assert'
import { couponDiscount, itemsTotal } from '../src/cart.js'

test('상품 합계', () => {
  assert.strictEqual(itemsTotal({ items: [{ price: 1000, qty: 3 }, { price: 500, qty: 1 }] }), 3500)
})

test('쿠폰: 정액, 정률 버림, 최소 금액', () => {
  const items = [{ price: 33333, qty: 1 }]
  assert.strictEqual(couponDiscount({ items, coupon: { type: 'amount', value: 3000 } }), 3000)
  assert.strictEqual(couponDiscount({ items, coupon: { type: 'percent', value: 10 } }), 3333)
  assert.strictEqual(couponDiscount({ items, coupon: { type: 'amount', value: 3000, minTotal: 40000 } }), 0)
})
