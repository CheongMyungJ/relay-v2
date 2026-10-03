import { test } from 'node:test'
import assert from 'node:assert'
import { shippingFee } from '../src/shipping.js'

// 무료배송 기준(Work 1): 5만 원 "이상"이면 무료
test('상품 합계 50,000원은 무료배송', () => {
  assert.strictEqual(shippingFee({ items: [{ price: 25000, qty: 2 }] }), 0)
  assert.strictEqual(shippingFee({ items: [{ price: 49999, qty: 1 }] }), 3000)
})
