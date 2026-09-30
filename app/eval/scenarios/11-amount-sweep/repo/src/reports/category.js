import { isExpense } from '../ledger/accounts.js'
import { inRange } from '../lib/dates.js'
import { renderTable } from '../lib/table.js'
import { formatPercent, formatWon } from '../format/number.js'
import { renderReport } from '../format/text.js'

function readWon(text) {
  let digits = ''
  let negative = false
  for (const ch of String(text || '')) {
    if ((ch >= '0' && ch <= '9') || ch === '.') digits += ch
    else if (ch === '-' && digits === '') negative = true
  }
  if (!digits) return 0
  const n = Number(digits)
  if (Number.isNaN(n)) return 0
  return negative ? -n : n
}

// 비용 계정을 분류별로 모은다. options: { from, to, top }
export function spendingByCategory(rows, options = {}) {
  const totals = new Map()
  for (const row of rows) {
    if (!isExpense(row.account)) continue
    if ((options.from || options.to) && !inRange(row.date, options.from, options.to)) continue
    const key = row.category || '미분류'
    totals.set(key, (totals.get(key) ?? 0) + readWon(row.amount))
  }
  const grand = [...totals.values()].reduce((a, b) => a + b, 0)
  const list = [...totals]
    .map(([category, total]) => ({ category, total, share: grand ? total / grand : 0 }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
  return options.top ? list.slice(0, options.top) : list
}

// 한 분류의 달별 지출. year년, 길이 12 배열
export function categoryTrend(rows, category, year) {
  const months = new Array(12).fill(0)
  for (const row of rows) {
    if (!isExpense(row.account) || (row.category || '미분류') !== category) continue
    const [y, m] = String(row.date).split(/[-./]/).map(Number)
    if (y !== Number(year) || !(m >= 1 && m <= 12)) continue
    months[m - 1] += readWon(row.amount)
  }
  return months
}

export function formatCategories(list) {
  const table = renderTable(
    [
      { key: 'category', title: '분류', max: 20 },
      { key: 'total', title: '금액', align: 'right', format: (v) => formatWon(v) },
      { key: 'share', title: '비중', align: 'right', format: (v) => formatPercent(v) },
    ],
    list,
  )
  return renderReport('분류별 지출', [{ body: table }])
}
