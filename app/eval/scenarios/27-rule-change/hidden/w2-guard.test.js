import { test } from 'node:test'
import assert from 'node:assert'
import { checkoutAmounts } from '../src/checkout.js'

// 지키기: 쿠폰 없는 주문과 할인액 계산
test('쿠폰 없는 주문과 할인액은 그대로', () => {
  assert.strictEqual(checkoutAmounts({ items: [{ price: 10000, qty: 1 }] }).shipping, 3000)
  assert.strictEqual(checkoutAmounts({ items: [{ price: 70000, qty: 1 }] }).shipping, 0)
  const pct = { items: [{ price: 33333, qty: 1 }], coupon: { type: 'percent', value: 10 } }
  assert.strictEqual(checkoutAmounts(pct).discount, 3333)
})
