import { test } from 'node:test'
import assert from 'node:assert'
import { applyCoupon } from '../src/discount.js'

test('할인 계산은 그대로', () => {
  assert.strictEqual(applyCoupon(1000, { percent: 15 }), 850)
  assert.strictEqual(applyCoupon(999, { percent: 10 }), 899)
  assert.strictEqual(applyCoupon(1000), 1000)
})
