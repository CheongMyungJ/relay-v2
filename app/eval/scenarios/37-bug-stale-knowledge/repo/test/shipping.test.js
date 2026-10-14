import { test } from 'node:test'
import assert from 'node:assert'
import { shippingFee, shipsToday } from '../src/shipping.js'

test('적은 주문은 기본 배송비', () => {
  assert.equal(shippingFee({ subtotal: 20000, remote: false }), 3000)
})

test('큰 주문은 무료', () => {
  assert.equal(shippingFee({ subtotal: 80000, remote: false }), 0)
})

test('도서산간은 추가 배송비', () => {
  assert.equal(shippingFee({ subtotal: 20000, remote: true }), 7000)
})

test('2시 전 주문은 당일 출고', () => {
  assert.equal(shipsToday(new Date(2026, 9, 1, 13, 59)), true)
  assert.equal(shipsToday(new Date(2026, 9, 1, 14, 0)), false)
})
