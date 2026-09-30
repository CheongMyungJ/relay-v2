import { test } from 'node:test'
import assert from 'node:assert'

// 리포트 모듈의 공개 함수 이름과 인자 개수(fn.length). 다른 팀 스크립트가 불러 쓴다
const API = {
  'profit-loss': { comparePeriods: 3, formatProfitAndLoss: 1, operatingMargin: 1, profitAndLoss: 1 },
  cashflow: { cashflow: 1, formatCashflow: 1, lowestMonth: 1, parseCashAmount: 1, runwayMonths: 1 },
  balance: { accountBalances: 2, balanceOf: 3, balancesByType: 1, formatBalances: 2, nonZeroBalances: 1 },
  monthly: { bestMonth: 1, formatMonthly: 2, monthOverMonth: 1, monthlyTotals: 2, quarterTotals: 1 },
  category: { categoryTrend: 3, formatCategories: 1, spendingByCategory: 1 },
  vat: { formatVatSummary: 1, vatByMonth: 2, vatSummary: 1 },
  vendor: { amountOf: 1, concentration: 1, formatVendorTotals: 1, vendorHistory: 2, vendorTotals: 2 },
  budget: { budgetVsActual: 2, forecast: 2, formatBudget: 1, overBudget: 1 },
}

for (const [name, expected] of Object.entries(API)) {
  test(`${name} 공개 API`, async () => {
    const mod = await import(`../src/reports/${name}.js`)
    const actual = {}
    for (const fn of Object.keys(expected)) {
      actual[fn] = typeof mod[fn] === 'function' ? mod[fn].length : '(없음)'
    }
    assert.deepStrictEqual(actual, expected)
  })
}
