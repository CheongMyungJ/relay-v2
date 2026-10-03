import { test } from 'node:test'
import assert from 'node:assert'
import { checkoutAmounts } from '../src/checkout.js'

test('적은 주문은 배송비', () => {
  assert.deepStrictEqual(checkoutAmounts({ items: [{ price: 10000, qty: 1 }] }), {
    items: 10000,
    discount: 0,
    shipping: 3000,
    pay: 13000,
  })
})

test('큰 주문은 무료배송', () => {
  assert.strictEqual(checkoutAmounts({ items: [{ price: 70000, qty: 1 }] }).shipping, 0)
})
