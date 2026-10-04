import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { createOrder } from '../src/orders/order.js'

// 적립 규정: 1P 미만은 버린다(반올림하지 않는다)

const base = { customerId: 'U-9', orderedAt: '2026-10-05T10:00:00+09:00' }

test('1P 미만 버림', () => {
  const a = createOrder({ ...base, number: 'O-2011', lines: [{ sku: 'A', unitPrice: 33370, qty: 1 }] })
  assert.strictEqual(a.points.earned, 333)
  const b = createOrder({ ...base, number: 'O-2012', lines: [{ sku: 'B', unitPrice: 15330, qty: 3 }] })
  assert.strictEqual(b.points.earned, 459)
})

test('O-1042: 리포트의 주문이 고객센터 안내와 같다', () => {
  const input = JSON.parse(readFileSync(new URL('../examples/O-1042.json', import.meta.url), 'utf8'))
  const o = createOrder(input)
  assert.strictEqual(o.amounts.total, 26770)
  assert.strictEqual(o.points.earned, 237)
})
