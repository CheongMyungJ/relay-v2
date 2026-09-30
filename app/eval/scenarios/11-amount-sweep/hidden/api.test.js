import { test } from 'node:test'
import assert from 'node:assert'

// 리포트 모듈의 공개 함수 이름과 인자 이름. 다른 팀 스크립트가 불러 쓴다.
// 기본값을 붙이거나 뒤에 선택 인자를 더하는 것은 괜찮고, 있던 인자의 이름과 순서가 바뀌면 안 된다
const API = {
  'profit-loss': {
    comparePeriods: ['rows', 'current', 'previous'],
    formatProfitAndLoss: ['result', 'title'],
    operatingMargin: ['result'],
    profitAndLoss: ['rows', 'period'],
  },
  cashflow: {
    cashflow: ['rows', 'opening'],
    formatCashflow: ['result'],
    lowestMonth: ['result'],
    parseCashAmount: ['text'],
    runwayMonths: ['result'],
  },
  balance: {
    accountBalances: ['rows', 'asOf'],
    balanceOf: ['rows', 'account', 'asOf'],
    balancesByType: ['balances'],
    formatBalances: ['balances', 'asOf'],
    nonZeroBalances: ['balances'],
  },
  monthly: {
    bestMonth: ['totals'],
    formatMonthly: ['totals', 'year'],
    monthOverMonth: ['totals'],
    monthlyTotals: ['rows', 'year'],
    quarterTotals: ['totals'],
  },
  category: {
    categoryTrend: ['rows', 'category', 'year'],
    formatCategories: ['list'],
    spendingByCategory: ['rows', 'options'],
  },
  vat: {
    formatVatSummary: ['summary', 'period'],
    vatByMonth: ['rows', 'year'],
    vatSummary: ['rows', 'period'],
  },
  vendor: {
    amountOf: ['row'],
    concentration: ['list'],
    formatVendorTotals: ['list'],
    vendorHistory: ['rows', 'vendor'],
    vendorTotals: ['rows', 'limit'],
  },
  budget: {
    budgetVsActual: ['rows', 'plan', 'period'],
    forecast: ['result', 'elapsed'],
    formatBudget: ['result'],
    overBudget: ['result'],
  },
}

/** 함수 선언의 맨 바깥 인자 이름들 (기본값은 뺀다) */
function params(fn) {
  const s = fn.toString()
  const out = []
  let depth = 0
  let cur = ''
  for (let i = s.indexOf('(') + 1; i < s.length; i++) {
    const ch = s[i]
    if ('([{'.includes(ch)) depth++
    if (')]}'.includes(ch)) {
      if (depth === 0) break
      depth--
    }
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out.map((p) => p.split('=')[0].trim()).filter(Boolean)
}

for (const [name, expected] of Object.entries(API)) {
  test(`${name} 공개 API`, async () => {
    const mod = await import(`../src/reports/${name}.js`)
    const actual = {}
    for (const [fn, names] of Object.entries(expected)) {
      if (typeof mod[fn] !== 'function') actual[fn] = '(없음)'
      else actual[fn] = params(mod[fn]).slice(0, names.length)
    }
    assert.deepStrictEqual(actual, expected)
  })
}
