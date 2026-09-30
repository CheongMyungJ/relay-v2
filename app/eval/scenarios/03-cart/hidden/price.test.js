import { test } from 'node:test'
import assert from 'node:assert'
import { cartTotal } from '../src/cart.js'
import { parsePrice } from '../src/parse.js'

test('천 단위 쉼표와 소수점 가격', () => {
  assert.strictEqual(parsePrice('1,200'), 1200)
  assert.strictEqual(parsePrice('12.50'), 12.5)
  assert.strictEqual(parsePrice('1,234.50'), 1234.5)
  assert.strictEqual(parsePrice('500'), 500)
})

test('쉼표 가격에 쿠폰', () => {
  assert.strictEqual(cartTotal([{ price: '1,200', qty: 2 }], { percent: 10 }), 2160)
  assert.strictEqual(cartTotal([{ price: '1,200', qty: 2 }]), 2400)
})
