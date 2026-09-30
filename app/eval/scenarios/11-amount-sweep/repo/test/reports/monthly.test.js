import { test } from 'node:test'
import assert from 'node:assert'
import { bestMonth, monthOverMonth, monthlyTotals, quarterTotals } from '../../src/reports/monthly.js'
import { row } from '../helpers.js'

const rows = [
  row('2026-01-05', 4010, '3,000,000'),
  row('2026-01-08', 5110, '120,000'),
  row('2026-02-03', 4010, '₩2,400,000'),
  row('2026-02-15', 5200, '1,500,000'),
  row('2026-04-01', 4020, '1,000,000'),
  row('2025-12-30', 4010, '9,999,999'),
  row('2026-01-20', 1020, '3,300,000'),
]

test('달마다 수익, 비용, 순이익', () => {
  const t = monthlyTotals(rows, 2026)
  assert.strictEqual(t.length, 12)
  assert.deepStrictEqual(t[0], { month: 1, revenue: 3000000, expense: 120000, net: 2880000 })
  assert.deepStrictEqual(t[1], { month: 2, revenue: 2400000, expense: 1500000, net: 900000 })
  assert.strictEqual(t[2].net, 0)
})

test('전달 대비, 분기, 가장 좋은 달', () => {
  const t = monthlyTotals(rows, 2026)
  assert.deepStrictEqual(monthOverMonth(t).slice(0, 3), [null, -1980000, -900000])
  assert.strictEqual(quarterTotals(t)[0].net, 3780000)
  assert.strictEqual(bestMonth(t).month, 1)
})
