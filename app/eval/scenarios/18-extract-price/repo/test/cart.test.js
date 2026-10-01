import { test } from 'node:test'
import assert from 'node:assert'
import { cartTotal, receiptLines } from '../src/cart.js'

test('합계', () => {
  assert.strictEqual(cartTotal([{ name: '사과', unitPrice: 1000, qty: 3 }]), 3000)
})

test('영수증 줄', () => {
  assert.deepStrictEqual(receiptLines([{ name: '사과', unitPrice: 1000, qty: 3 }]), ['사과 x3 3000원'])
})
