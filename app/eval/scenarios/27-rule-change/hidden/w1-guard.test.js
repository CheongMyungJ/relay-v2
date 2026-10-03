import { test } from 'node:test'
import assert from 'node:assert'
import { checkoutAmounts } from '../src/checkout.js'

// 지키기: 쿠폰 없는 큰·작은 주문
test('쿠폰 없는 주문의 배송비', () => {
  assert.strictEqual(checkoutAmounts({ items: [{ price: 10000, qty: 1 }] }).shipping, 3000)
  assert.strictEqual(checkoutAmounts({ items: [{ price: 70000, qty: 1 }] }).shipping, 0)
})
