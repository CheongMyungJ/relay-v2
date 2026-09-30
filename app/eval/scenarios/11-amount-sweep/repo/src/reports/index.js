import { accountBalances, formatBalances } from './balance.js'
import { budgetVsActual, formatBudget } from './budget.js'
import { cashflow, formatCashflow } from './cashflow.js'
import { formatCategories, spendingByCategory } from './category.js'
import { formatMonthly, monthlyTotals } from './monthly.js'
import { formatProfitAndLoss, profitAndLoss } from './profit-loss.js'
import { formatVatSummary, vatSummary } from './vat.js'
import { formatVendorTotals, vendorTotals } from './vendor.js'

// 리포트 목록. run은 결과(데이터), render는 글자. opts는 CLI 옵션을 그대로 받는다
export const REPORTS = {
  'profit-loss': {
    run: (rows, opts) => profitAndLoss(rows, { from: opts.from, to: opts.to }),
    render: (result) => formatProfitAndLoss(result),
    table: (result) => result.lines,
  },
  cashflow: {
    run: (rows, opts) => cashflow(rows, opts.opening ?? 0),
    render: (result) => formatCashflow(result),
    table: (result) => Object.entries(result.byMonth).map(([month, m]) => ({ month, ...m })),
  },
  balance: {
    run: (rows, opts) => accountBalances(rows, opts.asOf),
    render: (result, opts) => formatBalances(result, opts.asOf),
    table: (result) => Object.entries(result).map(([account, balance]) => ({ account, balance })),
  },
  monthly: {
    run: (rows, opts) => monthlyTotals(rows, opts.year ?? new Date().getFullYear()),
    render: (result, opts) => formatMonthly(result, opts.year ?? new Date().getFullYear()),
    table: (result) => result,
  },
  category: {
    run: (rows, opts) => spendingByCategory(rows, { from: opts.from, to: opts.to, top: opts.top }),
    render: (result) => formatCategories(result),
    table: (result) => result,
  },
  vat: {
    run: (rows, opts) => vatSummary(rows, { year: opts.year, quarter: opts.quarter }),
    render: (result, opts) => formatVatSummary(result, { year: opts.year, quarter: opts.quarter }),
    table: (result) => [result],
  },
  vendor: {
    run: (rows, opts) => vendorTotals(rows, opts.top),
    render: (result) => formatVendorTotals(result),
    table: (result) => result,
  },
  budget: {
    run: (rows, opts) => budgetVsActual(rows, opts.plan ?? {}, { from: opts.from, to: opts.to }),
    render: (result) => formatBudget(result),
    table: (result) => result,
  },
}

export function reportNames() {
  return Object.keys(REPORTS)
}

export function getReport(name) {
  const report = REPORTS[name]
  if (!report) throw new Error(`없는 리포트: ${name} (있는 것: ${reportNames().join(', ')})`)
  return report
}
