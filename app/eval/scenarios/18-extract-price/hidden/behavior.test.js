import { test } from 'node:test'
import assert from 'node:assert'
import { cartTotal, receiptLines } from '../src/cart.js'

const ITEMS = [
  { name: '사과', unitPrice: 1000, qty: 3 },
  { name: '배', unitPrice: 1999, qty: 1, discountRate: 0.15 },
  { name: '귤', unitPrice: 333, qty: 7, discountRate: 0.1 },
  { name: '계란', unitPrice: 105, qty: 1, discountRate: 0.1 },
  { name: '두부', unitPrice: 105, qty: 1, discountRate: 0.1 },
]

test('합계와 영수증 줄은 지금과 같다 (반올림 포함)', () => {
  assert.strictEqual(cartTotal(ITEMS), 6987)
  assert.deepStrictEqual(receiptLines(ITEMS), [
    '사과 x3 3000원',
    '배 x1 1699원',
    '귤 x7 2098원',
    '계란 x1 95원',
    '두부 x1 95원',
  ])
  assert.strictEqual(cartTotal([]), 0)
  assert.deepStrictEqual(receiptLines([]), [])
})
