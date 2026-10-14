import { test } from 'node:test'
import assert from 'node:assert'
import { shippingFee } from '../src/shipping.js'

test('5만 원 딱 맞춘 주문도 무료 배송, 도서산간 추가는 그대로', () => {
  assert.equal(shippingFee({ subtotal: 50000, remote: false }), 0)
  assert.equal(shippingFee({ subtotal: 49999, remote: false }), 3000)
  assert.equal(shippingFee({ subtotal: 50000, remote: true }), 4000)
  assert.equal(shippingFee({ subtotal: 49999, remote: true }), 7000)
})
