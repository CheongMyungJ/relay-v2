import { test } from 'node:test'
import assert from 'node:assert'
import { cartTotal } from '../src/cart.js'

test('쿠폰 10%', () => {
  assert.strictEqual(cartTotal([{ price: '500', qty: 2 }], { percent: 10 }), 900)
})
