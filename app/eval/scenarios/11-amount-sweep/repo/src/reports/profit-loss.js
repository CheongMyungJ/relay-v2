import { accountName, accountType } from '../ledger/accounts.js'
import { inRange } from '../lib/dates.js'
import { renderTable } from '../lib/table.js'
import { formatWon } from '../format/number.js'
import { keyValueLines, renderReport } from '../format/text.js'

function toNumber(raw) {
  if (raw === undefined || raw === null) return 0
  const cleaned = String(raw).replace(/[^0-9.\-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return 0
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

// 손익계산. period: { from, to } (양 끝 포함, 없으면 전체)
export function profitAndLoss(rows, period = {}) {
  const byAccount = new Map()
  for (const row of rows) {
    if (!inRange(row.date, period.from, period.to)) continue
    const type = accountType(row.account)
    if (type !== 'revenue' && type !== 'expense') continue
    byAccount.set(row.account, (byAccount.get(row.account) ?? 0) + toNumber(row.amount))
  }
  let revenue = 0
  let expense = 0
  const lines = []
  for (const [account, amount] of [...byAccount].sort((a, b) => a[0].localeCompare(b[0]))) {
    const type = accountType(account)
    if (type === 'revenue') revenue += amount
    else expense += amount
    lines.push({ account, name: accountName(account), type, amount })
  }
  return { revenue, expense, net: revenue - expense, lines }
}

// 영업이익률. 수익이 0이면 null
export function operatingMargin(result) {
  if (!result.revenue) return null
  return result.net / result.revenue
}

// 두 기간 비교. current, previous: { from, to }
export function comparePeriods(rows, current, previous) {
  const now = profitAndLoss(rows, current)
  const before = profitAndLoss(rows, previous)
  return {
    current: now,
    previous: before,
    change: {
      revenue: now.revenue - before.revenue,
      expense: now.expense - before.expense,
      net: now.net - before.net,
    },
  }
}

export function formatProfitAndLoss(result, title = '손익계산서') {
  const table = renderTable(
    [
      { key: 'account', title: '계정' },
      { key: 'name', title: '이름', max: 16 },
      { key: 'amount', title: '금액', align: 'right', format: (v) => formatWon(v) },
    ],
    result.lines,
  )
  const summary = keyValueLines([
    ['수익', formatWon(result.revenue)],
    ['비용', formatWon(result.expense)],
    ['순이익', formatWon(result.net)],
  ])
  return renderReport(title, [
    { heading: '계정별', body: table },
    { heading: '합계', body: summary },
  ])
}
