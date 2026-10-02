import { test } from 'node:test'
import assert from 'node:assert'
import { earnPoints } from '../src/points.js'

test('배송비를 뺀 금액에 등급 적립률', () => {
  assert.strictEqual(earnPoints({ items: 20000, shipping: 3000, paid: 23000 }, { grade: 'gold' }), 300)
  assert.strictEqual(earnPoints({ items: 40000, shipping: 3000, paid: 43000 }, { grade: 'vip' }), 800)
})

test('모르는 등급은 적립하지 않는다', () => {
  assert.strictEqual(earnPoints({ items: 20000, shipping: 0, paid: 20000 }, { grade: 'staff' }), 0)
})
