import { test } from 'node:test'
import assert from 'node:assert'
import { cartBanner } from '../src/banner.js'

// 지키기: 쿠폰 없는 장바구니의 문구
test('쿠폰 없는 장바구니의 안내 문구는 그대로', () => {
  assert.strictEqual(cartBanner({ items: [{ price: 30000, qty: 1 }] }), '무료배송까지 20,000원 남았습니다')
  assert.strictEqual(cartBanner({ items: [{ price: 80000, qty: 1 }] }), '무료배송 대상입니다')
})
