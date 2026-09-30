import { test } from 'node:test'
import assert from 'node:assert'
import { accountBalances, balanceOf, balancesByType, nonZeroBalances } from '../../src/reports/balance.js'
import { row } from '../helpers.js'

const rows = [
  row('2026-01-05', 1020, '3,300,000'),
  row('2026-01-08', 1020, '-132,000'),
  row('2026-01-10', 2010, '500,000'),
  row('2026-02-10', 2010, '-500,000'),
  row('2026-02-12', 1020, '₩ 64,000'),
]

test('기준일까지의 계정 잔액', () => {
  assert.deepStrictEqual(accountBalances(rows, '2026-01-31'), { 1020: 3168000, 2010: 500000 })
  assert.strictEqual(balanceOf(rows, 1020), 3232000)
  assert.strictEqual(balanceOf(rows, 1300), 0)
})

test('종류별 합계와 0 아닌 잔액', () => {
  const all = accountBalances(rows)
  assert.deepStrictEqual(nonZeroBalances(all), { 1020: 3232000 })
  assert.deepStrictEqual(balancesByType(all), { asset: 3232000, liability: 0 })
})
