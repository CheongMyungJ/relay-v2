import { test } from 'node:test'
import assert from 'node:assert'
import { budgetVsActual, forecast, overBudget } from '../../src/reports/budget.js'
import { parsePlan } from '../../src/budget/plan.js'
import { row } from '../helpers.js'

const plan = parsePlan(`
# 예산
5110 = ₩500,000
5200 = ₩4,000,000
`)

const rows = [
  row('2026-01-08', 5110, '320,000'),
  row('2026-02-12', 5110, '₩ 240,000'),
  row('2026-01-15', 5200, '1,500,000'),
  row('2026-01-20', 5120, '100,000'),
]

test('예산 대비 실적', () => {
  const r = budgetVsActual(rows, plan)
  assert.deepStrictEqual(
    r.map((l) => [l.account, l.budget, l.actual, l.variance]),
    [
      ['5110', 500000, 560000, -60000],
      ['5200', 4000000, 1500000, 2500000],
    ],
  )
  assert.deepStrictEqual(overBudget(r).map((l) => l.account), ['5110'])
})

test('연말 짐작', () => {
  const f = forecast(budgetVsActual(rows, plan, { from: '2026-01-01', to: '2026-01-31' }), 1)
  assert.strictEqual(f[1].projected, 18000000)
  assert.throws(() => forecast([], 0))
})
