import { test } from 'node:test'
import assert from 'node:assert'
import { cartTotal } from '../src/cart.js'
import { pointsLine, receiptLines } from '../src/receipt.js'

test('장바구니 합계', () => {
  assert.strictEqual(cartTotal([{ price: 1200, qty: 3 }]), '합계 3,600원')
})

test('영수증 줄과 적립', () => {
  assert.deepStrictEqual(receiptLines([{ name: '연필', price: 500, qty: 2 }]), ['연필 2개 1,000원'])
  assert.strictEqual(pointsLine(1500), '적립 1,500P')
})
