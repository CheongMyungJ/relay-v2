import { test } from 'node:test'
import assert from 'node:assert'
import { vatByMonth, vatSummary } from '../../src/reports/vat.js'
import { row } from '../helpers.js'

const rows = [
  row('2026-01-05', 4010, '3,000,000', { vat: '300,000' }),
  row('2026-01-08', 5110, '120,000', { vat: '12,000' }),
  row('2026-02-12', 5110, '64,000'),
  row('2026-02-20', 5120, '50,000', { category: '면세' }),
  row('2026-04-01', 4010, '1,000,000', { vat: '100,000' }),
]

test('분기 부가세', () => {
  assert.deepStrictEqual(vatSummary(rows, { year: 2026, quarter: 1 }), {
    salesSupply: 3000000,
    salesVat: 300000,
    purchaseSupply: 184000,
    purchaseVat: 18400,
    payable: 281600,
  })
})

test('달별 세액', () => {
  const m = vatByMonth(rows, 2026)
  assert.deepStrictEqual(m[0], { month: 1, salesVat: 300000, purchaseVat: 12000 })
  assert.deepStrictEqual(m[1], { month: 2, salesVat: 0, purchaseVat: 6400 })
  assert.strictEqual(m[3].salesVat, 100000)
})
