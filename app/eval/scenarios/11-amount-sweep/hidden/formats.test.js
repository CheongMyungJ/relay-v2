import { test } from 'node:test'
import assert from 'node:assert'
import { profitAndLoss } from '../src/reports/profit-loss.js'
import * as cash from '../src/reports/cashflow.js'
import { accountBalances } from '../src/reports/balance.js'
import { monthlyTotals } from '../src/reports/monthly.js'
import { spendingByCategory } from '../src/reports/category.js'
import { vatSummary } from '../src/reports/vat.js'
import * as vendor from '../src/reports/vendor.js'
import { budgetVsActual } from '../src/reports/budget.js'
import { parseAmount } from '../src/lib/money.js'

// 괄호가 없는 형식은 지금처럼 읽어야 한다: 양수, ₩, 공백, 소수점, 빈 칸, 마이너스
const AMOUNTS = ['1,200', '₩3,000', '₩ 450', '12.50', '', '   ', '  700 ', '-1,200', '1,234,567.25']
const VALUES = [1200, 3000, 450, 12.5, 0, 0, 700, -1200, 1234567.25]
const TOTAL = 1238729.75
const VATS = ['120', '₩300', '₩ 45', '1.25', '', '   ', ' 70 ', '-120', '123,456.75']

const rows = (account, extra = {}) =>
  AMOUNTS.map((amount, i) => ({
    date: `2026-03-${String(i + 1).padStart(2, '0')}`,
    account: String(account),
    category: '소모품',
    vendor: '가나상사',
    memo: '',
    amount,
    vat: VATS[i],
    ...extra,
  }))

test('lib/money 형식 그대로', () => {
  assert.deepStrictEqual(AMOUNTS.map(parseAmount), VALUES)
})

test('profit-loss 형식 그대로', () => {
  const r = profitAndLoss([...rows(4010), ...rows(5110)])
  assert.strictEqual(r.revenue, TOTAL)
  assert.strictEqual(r.expense, TOTAL)
  assert.strictEqual(r.net, 0)
})

test('cashflow 형식 그대로', () => {
  const r = cash.cashflow(rows(1020), '₩ 1,000')
  assert.strictEqual(r.opening, 1000)
  assert.strictEqual(r.inflow, TOTAL + 1200)
  assert.strictEqual(r.outflow, 1200)
  assert.strictEqual(r.closing, 1000 + TOTAL)
  if (typeof cash.parseCashAmount === 'function') assert.deepStrictEqual(AMOUNTS.map(cash.parseCashAmount), VALUES)
})

test('balance 형식 그대로', () => {
  assert.deepStrictEqual(accountBalances(rows(1020)), { 1020: TOTAL })
})

test('monthly 형식 그대로', () => {
  const t = monthlyTotals([...rows(4010), ...rows(5110)], 2026)
  assert.deepStrictEqual(t[2], { month: 3, revenue: TOTAL, expense: TOTAL, net: 0 })
})

test('category 형식 그대로', () => {
  assert.deepStrictEqual(spendingByCategory(rows(5110)), [{ category: '소모품', total: TOTAL, share: 1 }])
})

test('vat 형식 그대로', () => {
  assert.deepStrictEqual(vatSummary([...rows(4010), ...rows(5110)]), {
    salesSupply: TOTAL,
    salesVat: 123873,
    purchaseSupply: TOTAL,
    purchaseVat: 123873,
    payable: 0,
  })
})

test('vendor 형식 그대로', () => {
  assert.deepStrictEqual(vendor.vendorTotals(rows(5110)), [{ vendor: '가나상사', total: TOTAL, count: 9 }])
  if (typeof vendor.amountOf === 'function') {
    assert.deepStrictEqual(AMOUNTS.map((amount) => vendor.amountOf({ amount })), VALUES)
  }
})

test('budget 형식 그대로', () => {
  const r = budgetVsActual(rows(5110), { 5110: '₩2,000,000' })
  assert.deepStrictEqual(
    r.map((l) => [l.budget, l.actual, l.variance]),
    [[2000000, TOTAL, 2000000 - TOTAL]],
  )
})
