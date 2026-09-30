import { test } from 'node:test'
import assert from 'node:assert'
import { comparePeriods, formatProfitAndLoss, operatingMargin, profitAndLoss } from '../../src/reports/profit-loss.js'
import { row } from '../helpers.js'

const rows = [
  row('2026-01-05', 4010, '3,000,000'),
  row('2026-01-20', 4020, '₩500,000'),
  row('2026-01-08', 5110, '120,000'),
  row('2026-01-15', 5200, '1,500,000'),
  row('2026-01-15', 1020, '-1,650,000'),
  row('2026-02-03', 4010, '2,400,000'),
]

test('수익, 비용, 순이익', () => {
  const r = profitAndLoss(rows, { from: '2026-01-01', to: '2026-01-31' })
  assert.strictEqual(r.revenue, 3500000)
  assert.strictEqual(r.expense, 1620000)
  assert.strictEqual(r.net, 1880000)
  assert.deepStrictEqual(
    r.lines.map((l) => l.account),
    ['4010', '4020', '5110', '5200'],
  )
})

test('기간 비교와 이익률', () => {
  const c = comparePeriods(rows, { from: '2026-02-01', to: '2026-02-28' }, { from: '2026-01-01', to: '2026-01-31' })
  assert.strictEqual(c.change.revenue, -1100000)
  assert.strictEqual(operatingMargin(c.current), 1)
  assert.strictEqual(operatingMargin({ revenue: 0, net: 0 }), null)
})

test('글자 리포트', () => {
  const text = formatProfitAndLoss(profitAndLoss(rows))
  assert.match(text, /순이익\s+₩4,280,000/)
})
