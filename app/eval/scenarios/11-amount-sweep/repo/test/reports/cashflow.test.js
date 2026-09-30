import { test } from 'node:test'
import assert from 'node:assert'
import { cashflow, lowestMonth, parseCashAmount, runwayMonths } from '../../src/reports/cashflow.js'
import { row } from '../helpers.js'

const rows = [
  row('2026-01-05', 1020, '₩3,300,000'),
  row('2026-01-08', 1020, '-132,000'),
  row('2026-01-20', 1010, '-86,000'),
  row('2026-02-03', 1020, '2,640,000'),
  row('2026-02-15', 1020, '-1,650,000'),
  row('2026-02-15', 5200, '1,500,000'),
]

test('들어온 돈과 나간 돈', () => {
  const r = cashflow(rows, '₩1,000,000')
  assert.strictEqual(r.opening, 1000000)
  assert.strictEqual(r.inflow, 5940000)
  assert.strictEqual(r.outflow, 1868000)
  assert.strictEqual(r.closing, 5072000)
  assert.deepStrictEqual(r.byMonth['2026-01'], { inflow: 3300000, outflow: 218000 })
})

test('가장 낮은 달과 버틸 달 수', () => {
  const r = cashflow(rows, 0)
  assert.deepStrictEqual(lowestMonth(r), { month: '2026-01', balance: 3082000 })
  assert.strictEqual(runwayMonths(r), 4)
})

test('현금 금액 읽기', () => {
  assert.strictEqual(parseCashAmount('₩1,000,000'), 1000000)
  assert.strictEqual(parseCashAmount('-132,000'), -132000)
  assert.strictEqual(parseCashAmount(''), 0)
})
