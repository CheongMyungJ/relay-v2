import { accountType } from '../ledger/accounts.js'
import { parseDate } from '../lib/dates.js'
import { renderTable } from '../lib/table.js'
import { formatSigned, formatWon } from '../format/number.js'
import { renderReport } from '../format/text.js'

const AMOUNT_RE = /-?\d[\d,]*(?:\.\d+)?/

function amountValue(s) {
  const m = AMOUNT_RE.exec(s || '')
  return m ? Number(m[0].replace(/,/g, '')) : 0
}

// year년의 달마다 수익, 비용, 순이익. 길이 12 배열
export function monthlyTotals(rows, year) {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, revenue: 0, expense: 0, net: 0 }))
  for (const row of rows) {
    const d = parseDate(row.date)
    if (!d || d.y !== Number(year)) continue
    const type = accountType(row.account)
    if (type !== 'revenue' && type !== 'expense') continue
    const slot = months[d.m - 1]
    const value = amountValue(row.amount)
    if (type === 'revenue') slot.revenue += value
    else slot.expense += value
    slot.net = slot.revenue - slot.expense
  }
  return months
}

// 전달 대비 순이익 변화. 첫 달은 null
export function monthOverMonth(totals) {
  return totals.map((m, i) => (i === 0 ? null : m.net - totals[i - 1].net))
}

// 분기별로 묶은 합계. 길이 4 배열
export function quarterTotals(totals) {
  const quarters = [1, 2, 3, 4].map((q) => ({ quarter: q, revenue: 0, expense: 0, net: 0 }))
  for (const m of totals) {
    const q = quarters[Math.floor((m.month - 1) / 3)]
    q.revenue += m.revenue
    q.expense += m.expense
    q.net += m.net
  }
  return quarters
}

// 순이익이 가장 큰 달. 모두 0이면 null
export function bestMonth(totals) {
  let best = null
  for (const m of totals) {
    if (m.revenue === 0 && m.expense === 0) continue
    if (!best || m.net > best.net) best = m
  }
  return best
}

export function formatMonthly(totals, year) {
  const change = monthOverMonth(totals)
  const table = renderTable(
    [
      { key: 'month', title: '월', align: 'right' },
      { key: 'revenue', title: '수익', align: 'right', format: (v) => formatWon(v) },
      { key: 'expense', title: '비용', align: 'right', format: (v) => formatWon(v) },
      { key: 'net', title: '순이익', align: 'right', format: (v) => formatWon(v) },
      { key: 'change', title: '전달 대비', align: 'right', format: (v) => (v === null ? '' : formatSigned(v)) },
    ],
    totals.map((m, i) => ({ ...m, change: change[i] })),
  )
  return renderReport(`${year}년 월별 합계`, [{ body: table }])
}
