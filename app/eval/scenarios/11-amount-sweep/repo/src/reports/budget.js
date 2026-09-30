import { accountName, isExpense } from '../ledger/accounts.js'
import { inRange } from '../lib/dates.js'
import { renderTable } from '../lib/table.js'
import { formatPercent, formatWon } from '../format/number.js'
import { renderReport } from '../format/text.js'

const strip = (v) => String(v).replace(/₩|,|\s|\(|\)/g, '')

function won(v) {
  if (v === undefined || v === null || v === '') return 0
  if (typeof v === 'number') return v
  const n = Number(strip(v))
  if (Number.isNaN(n)) throw new Error(`금액을 읽을 수 없음: ${v}`)
  return n
}

// 예산 대비 실적. plan: { 계정코드: 금액 } (budget/plan.js의 parsePlan 결과)
// 계획에 있는 계정만 본다. period: { from, to }
export function budgetVsActual(rows, plan, period = {}) {
  const actual = {}
  for (const row of rows) {
    if (!(row.account in plan) || !isExpense(row.account)) continue
    if ((period.from || period.to) && !inRange(row.date, period.from, period.to)) continue
    actual[row.account] = (actual[row.account] ?? 0) + won(row.amount)
  }
  return Object.keys(plan)
    .sort()
    .map((account) => {
      const budget = won(plan[account])
      const spent = actual[account] ?? 0
      return {
        account,
        name: accountName(account),
        budget,
        actual: spent,
        variance: budget - spent,
        rate: budget ? spent / budget : null,
      }
    })
}

export function overBudget(result) {
  return result.filter((line) => line.variance < 0)
}

// 지금까지의 집행 속도로 연말 실적을 짐작한다. elapsed: 지난 달 수(1~12)
export function forecast(result, elapsed) {
  if (!(elapsed >= 1 && elapsed <= 12)) throw new Error(`지난 달 수는 1~12: ${elapsed}`)
  return result.map((line) => {
    const projected = (line.actual / elapsed) * 12
    return { ...line, projected, projectedVariance: line.budget - projected }
  })
}

export function formatBudget(result) {
  const table = renderTable(
    [
      { key: 'account', title: '계정' },
      { key: 'name', title: '이름', max: 14 },
      { key: 'budget', title: '예산', align: 'right', format: (v) => formatWon(v) },
      { key: 'actual', title: '실적', align: 'right', format: (v) => formatWon(v) },
      { key: 'variance', title: '남은 예산', align: 'right', format: (v) => formatWon(v) },
      { key: 'rate', title: '집행률', align: 'right', format: (v) => (v === null ? '-' : formatPercent(v)) },
    ],
    result,
  )
  return renderReport('예산 대비 실적', [{ body: table }])
}
