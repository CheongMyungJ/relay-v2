import { test } from 'node:test'
import assert from 'node:assert'
import { customers, orders } from '../src/data.js'
import { ordersCsv } from '../src/export/orders-csv.js'

test('머리줄과 주문 수', () => {
  const lines = ordersCsv(orders, customers).split('\n')
  assert.strictEqual(lines[0], '주문번호,날짜,고객,이메일,금액')
  assert.strictEqual(lines.length, 4)
})
