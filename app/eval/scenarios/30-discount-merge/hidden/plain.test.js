import { test } from 'node:test'
import assert from 'node:assert'
import { previewTotal } from '../src/cart.js'
import { chargeAmount } from '../src/checkout.js'

const items = [
  { price: 3000, qty: 2 },
  { price: 4000, qty: 1 },
]

test('할인 없는 주문과 쿠폰만 쓴 주문은 그대로다', () => {
  assert.strictEqual(previewTotal(items), 10000)
  assert.strictEqual(chargeAmount(items), 10000)
  assert.strictEqual(chargeAmount(items, { coupon: 12000 }), 0)
  assert.strictEqual(previewTotal(items, { coupon: 12000 }), 0)
})
