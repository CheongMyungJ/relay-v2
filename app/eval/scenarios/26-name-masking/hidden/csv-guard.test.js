import { test } from 'node:test'
import assert from 'node:assert'
import { customers, orders } from '../src/data.js'
import { ordersCsv } from '../src/export/orders-csv.js'

// 지키기: 칸과 차례, 금액은 그대로
test('CSV의 칸과 금액은 그대로', () => {
  const rows = ordersCsv(orders, customers).split('\n').map((l) => l.split(','))
  assert.deepStrictEqual(rows[0], ['주문번호', '날짜', '고객', '이메일', '금액'])
  assert.deepStrictEqual(rows.slice(1).map((r) => [r[0], r[1], r[4]]), [
    ['O-501', '2026-09-28', '36000'],
    ['O-502', '2026-09-29', '9000'],
    ['O-503', '2026-09-30', '12500'],
  ])
})
