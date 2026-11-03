import { test } from 'node:test'
import assert from 'node:assert'
import { monthlyTotals } from '../src/sales.js'

test('월별 합계: 달 오름차순, 환불은 뺀다, 판매가 없는 달은 없다', () => {
  const sales = [
    { date: '2026-03-05', amount: 200 },
    { date: '2026-01-31', amount: 100 },
    { date: '2026-03-20', amount: -50 },
    { date: '2026-01-01', amount: 40 },
  ]
  assert.deepStrictEqual(monthlyTotals(sales), [
    { month: '2026-01', total: 140 },
    { month: '2026-03', total: 150 },
  ])
  assert.deepStrictEqual(monthlyTotals([]), [])
})

test('해를 넘는 달도 차례대로', () => {
  const sales = [
    { date: '2026-01-10', amount: 10 },
    { date: '2025-12-10', amount: 20 },
  ]
  assert.deepStrictEqual(monthlyTotals(sales).map((m) => m.month), ['2025-12', '2026-01'])
})
