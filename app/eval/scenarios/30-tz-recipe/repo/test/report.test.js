import { test } from 'node:test'
import assert from 'node:assert'
import { dailyTotals } from '../src/report/daily.js'
import { weeklyTotals } from '../src/report/weekly.js'

const orders = [
  { at: '2026-10-21T03:00:00Z', amount: 1000 },
  { at: '2026-10-21T05:00:00Z', amount: 500 },
  { at: '2026-10-22T05:00:00Z', amount: 700 },
]

test('날짜별 합계', () => {
  assert.deepStrictEqual(dailyTotals(orders), { '2026-10-21': 1500, '2026-10-22': 700 })
})

test('주별 합계 (월요일부터)', () => {
  assert.deepStrictEqual(weeklyTotals(orders), { '2026-10-19': 2200 })
})
