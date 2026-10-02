import { test } from 'node:test'
import assert from 'node:assert'
import { earnPoints } from '../src/points.js'

// 지키기: 배송비 제외, 나누어떨어지는 적립, 모르는 등급, 0원
test('적립 기준은 그대로', () => {
  assert.strictEqual(earnPoints({ items: 20000, shipping: 3000, paid: 23000 }, { grade: 'gold' }), 300)
  assert.strictEqual(earnPoints({ items: 40000, shipping: 0, paid: 40000 }, { grade: 'vip' }), 800)
  assert.strictEqual(earnPoints({ items: 20000, shipping: 0, paid: 20000 }, { grade: 'staff' }), 0)
  assert.strictEqual(earnPoints({ items: 0, shipping: 3000, paid: 3000 }, { grade: 'gold' }), 0)
})
