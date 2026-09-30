import { isExpense } from '../ledger/accounts.js'
import { renderTable } from '../lib/table.js'
import { formatWon } from '../format/number.js'
import { renderReport } from '../format/text.js'
import { normalizeVendor } from '../vendors/normalize.js'

// 행의 금액. 거래처 대사 스크립트에서도 불러 쓴다
export function amountOf(row) {
  const raw = (row && row.amount) || ''
  const negative = raw.trim().startsWith('-')
  const value = parseFloat(raw.replace(/[^\d.]/g, ''))
  if (Number.isNaN(value)) return 0
  return negative ? -value : value
}

// 비용 계정의 거래처별 매입 합계. 큰 순서로 limit개(없으면 전부)
export function vendorTotals(rows, limit) {
  const byVendor = new Map()
  for (const row of rows) {
    if (!isExpense(row.account)) continue
    const name = normalizeVendor(row.vendor)
    const entry = byVendor.get(name) ?? { vendor: name, total: 0, count: 0 }
    entry.total += amountOf(row)
    entry.count += 1
    byVendor.set(name, entry)
  }
  const list = [...byVendor.values()].sort((a, b) => b.total - a.total || a.vendor.localeCompare(b.vendor))
  return limit ? list.slice(0, limit) : list
}

// 한 거래처의 거래 내역. 날짜 순
export function vendorHistory(rows, vendor) {
  const target = normalizeVendor(vendor)
  return rows
    .filter((row) => isExpense(row.account) && normalizeVendor(row.vendor) === target)
    .map((row) => ({ date: row.date, account: row.account, memo: row.memo, amount: amountOf(row) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// 한 거래처에 매입이 쏠려 있는지. 가장 큰 거래처의 비중
export function concentration(list) {
  const grand = list.reduce((a, v) => a + v.total, 0)
  if (!grand || !list.length) return 0
  return list[0].total / grand
}

export function formatVendorTotals(list) {
  const table = renderTable(
    [
      { key: 'vendor', title: '거래처', max: 20 },
      { key: 'count', title: '건수', align: 'right' },
      { key: 'total', title: '금액', align: 'right', format: (v) => formatWon(v) },
    ],
    list,
  )
  return renderReport('거래처별 매입', [{ body: table }])
}
