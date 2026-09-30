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

// 괄호 음수: (1,200)은 -1,200이다. ₩와 공백이 붙을 수 있다
const row = (date, account, amount, extra = {}) => ({
  date,
  account: String(account),
  category: '',
  vendor: '',
  memo: '',
  amount,
  vat: '',
  ...extra,
})

test('profit-loss: 괄호 음수', () => {
  const r = profitAndLoss([
    row('2026-01-05', 4010, '3,000,000'),
    row('2026-01-10', 4010, '(200,000)'),
    row('2026-01-12', 4020, '1,000,000'),
    row('2026-01-18', 4020, '₩(400,000)'),
    row('2026-01-08', 5110, '120,000'),
    row('2026-01-20', 5110, '( 30,000 )'),
    row('2026-01-20', 1020, '(99,999)'),
  ])
  assert.strictEqual(r.revenue, 3400000)
  assert.strictEqual(r.expense, 90000)
  assert.strictEqual(r.net, 3310000)
})

test('cashflow: 괄호 음수', () => {
  const r = cash.cashflow(
    [
      row('2026-01-05', 1020, '500,000'),
      row('2026-01-10', 1020, '(120,000)'),
      row('2026-01-11', 1010, '-30,000'),
      row('2026-02-01', 1010, '(₩ 12.50)'),
      row('2026-02-01', 5110, '(1)'),
    ],
    '(50,000)',
  )
  assert.strictEqual(r.opening, -50000)
  assert.strictEqual(r.inflow, 500000)
  assert.strictEqual(r.outflow, 150012.5)
  assert.strictEqual(r.closing, 299987.5)
  assert.deepStrictEqual(r.byMonth['2026-01'], { inflow: 500000, outflow: 150000 })
  // 내보내는 도우미가 남아 있으면 그것도 괄호 음수를 읽어야 한다 (이름과 인자는 api.test.js가 본다)
  if (typeof cash.parseCashAmount === 'function') assert.strictEqual(cash.parseCashAmount('(1,200)'), -1200)
})

test('balance: 괄호 음수', () => {
  const r = accountBalances([
    row('2026-01-05', 1020, '1,000,000'),
    row('2026-01-06', 1020, '(200,000)'),
    row('2026-01-07', 2010, '300,000'),
    row('2026-01-08', 2010, '₩(300,000)'),
    row('2026-01-09', 5110, '(₩1,200)'),
  ])
  assert.deepStrictEqual(r, { 1020: 800000, 2010: 0, 5110: -1200 })
})

test('monthly: 괄호 음수', () => {
  const t = monthlyTotals(
    [
      row('2026-01-05', 4010, '3,000,000'),
      row('2026-01-10', 4010, '(500,000)'),
      row('2026-01-11', 5110, '100,000'),
      row('2026-01-12', 5110, '(20,000)'),
      row('2026-02-01', 4010, '(₩ 1,000)'),
    ],
    2026,
  )
  assert.deepStrictEqual(t[0], { month: 1, revenue: 2500000, expense: 80000, net: 2420000 })
  assert.deepStrictEqual(t[1], { month: 2, revenue: -1000, expense: 0, net: -1000 })
})

test('category: 괄호 음수', () => {
  const list = spendingByCategory([
    row('2026-01-05', 5110, '50,000', { category: '소모품' }),
    row('2026-01-06', 5110, '(10,000)', { category: '소모품' }),
    row('2026-01-07', 5120, '30,000', { category: '식대' }),
    row('2026-01-08', 5120, '( 2,000 )', { category: '식대' }),
  ])
  assert.deepStrictEqual(
    list.map((c) => [c.category, c.total]),
    [
      ['소모품', 40000],
      ['식대', 28000],
    ],
  )
  assert.strictEqual(list[0].share, 40000 / 68000)
})

test('vat: 괄호 음수', () => {
  const s = vatSummary([
    row('2026-01-05', 4010, '100,000', { vat: '10,000' }),
    row('2026-01-06', 4010, '(20,000)', { vat: '(2,000)' }),
    row('2026-01-07', 4010, '(₩5,000)'),
    row('2026-01-08', 5110, '30,000'),
    row('2026-01-09', 5110, '(10,000)', { vat: '(1,000)' }),
  ])
  assert.deepStrictEqual(s, {
    salesSupply: 75000,
    salesVat: 7500,
    purchaseSupply: 20000,
    purchaseVat: 2000,
    payable: 5500,
  })
})

test('vendor: 괄호 음수', () => {
  const list = vendor.vendorTotals([
    row('2026-01-05', 5110, '100,000', { vendor: '(주)가나상사' }),
    row('2026-01-06', 5110, '(40,000)', { vendor: '가나상사' }),
    row('2026-01-07', 5110, '70,000', { vendor: '다라마트' }),
    row('2026-01-08', 5110, '₩(5,000)', { vendor: '다라마트' }),
  ])
  assert.deepStrictEqual(list, [
    { vendor: '다라마트', total: 65000, count: 2 },
    { vendor: '가나상사', total: 60000, count: 2 },
  ])
  if (typeof vendor.amountOf === 'function') assert.strictEqual(vendor.amountOf({ amount: '(1,200)' }), -1200)
})

test('budget: 괄호 음수', () => {
  const r = budgetVsActual(
    [
      row('2026-01-05', 5110, '300,000'),
      row('2026-01-06', 5110, '(50,000)'),
      row('2026-01-07', 5110, '120,000'),
      row('2026-01-08', 5200, '1,000,000'),
      row('2026-01-09', 5200, '(₩ 200,000)'),
    ],
    { 5110: '₩500,000', 5200: '₩1,000,000' },
  )
  assert.deepStrictEqual(
    r.map((l) => [l.account, l.actual, l.variance]),
    [
      ['5110', 370000, 130000],
      ['5200', 800000, 200000],
    ],
  )
})
