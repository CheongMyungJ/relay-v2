import { test } from 'node:test'
import assert from 'node:assert'
import { amountOf, concentration, vendorHistory, vendorTotals } from '../../src/reports/vendor.js'
import { row } from '../helpers.js'

const rows = [
  row('2026-01-08', 5110, '120,000', { vendor: '(주)다라문구' }),
  row('2026-02-12', 5110, '64,000', { vendor: '다라문구' }),
  row('2026-01-15', 5200, '1,500,000', { vendor: '마바부동산' }),
  row('2026-01-05', 4010, '3,000,000', { vendor: '가나상사' }),
]

test('거래처별 매입 합계', () => {
  assert.deepStrictEqual(vendorTotals(rows), [
    { vendor: '마바부동산', total: 1500000, count: 1 },
    { vendor: '다라문구', total: 184000, count: 2 },
  ])
  assert.strictEqual(vendorTotals(rows, 1).length, 1)
  assert.strictEqual(concentration(vendorTotals(rows)), 1500000 / 1684000)
})

test('거래처 내역과 행 금액', () => {
  assert.deepStrictEqual(
    vendorHistory(rows, '주식회사 다라문구').map((h) => h.amount),
    [120000, 64000],
  )
  assert.strictEqual(amountOf({ amount: '₩ 1,500' }), 1500)
  assert.strictEqual(amountOf({ amount: '-700' }), -700)
})
