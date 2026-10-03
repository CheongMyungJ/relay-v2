import { test } from 'node:test'
import assert from 'node:assert'
import { cartBanner } from '../src/banner.js'

test('남은 금액 안내', () => {
  assert.strictEqual(cartBanner({ items: [{ price: 30000, qty: 1 }] }), '무료배송까지 20,000원 남았습니다')
  assert.strictEqual(cartBanner({ items: [{ price: 80000, qty: 1 }] }), '무료배송 대상입니다')
})
