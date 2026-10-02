import { test } from 'node:test'
import assert from 'node:assert'
import { earnPoints } from '../src/points.js'
import { orderAmounts } from '../src/order.js'

// 고객에게 주는 금액(포인트)은 원 단위 버림
test('O-1001: 골드 12,390원 → 185점', () => {
  const order = { items: [{ unitPrice: 4130, qty: 3 }], address: { zip: '06236' } }
  assert.strictEqual(earnPoints(orderAmounts(order), { grade: 'gold' }), 185)
})

test('소수점 아래는 버린다', () => {
  assert.strictEqual(earnPoints({ items: 9990, shipping: 3000, paid: 12990 }, { grade: 'basic' }), 99)
  assert.strictEqual(earnPoints({ items: 7777, shipping: 3000, paid: 10777 }, { grade: 'silver' }), 77)
  assert.strictEqual(earnPoints({ items: 15550, shipping: 0, paid: 15550 }, { grade: 'gold' }), 233)
})
