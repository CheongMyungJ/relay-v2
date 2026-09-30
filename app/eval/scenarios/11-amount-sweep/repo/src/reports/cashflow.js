import { isCash } from '../ledger/accounts.js'
import { monthKey } from '../lib/dates.js'
import { renderTable } from '../lib/table.js'
import { formatWon } from '../format/number.js'
import { keyValueLines, renderReport } from '../format/text.js'

// 현금 금액 읽기. CLI가 기초 잔액을 읽을 때도 쓴다
export function parseCashAmount(text) {
  let s = String(text ?? '').trim()
  if (!s) return 0
  s = s.replace('₩', '').replace(/,/g, '').replace(/[()]/g, '').trim()
  const value = parseFloat(s)
  return Number.isNaN(value) ? 0 : value
}

// 현금 계정(현금, 보통예금)의 들고 난 돈. opening은 기초 잔액(숫자나 금액 문자열)
export function cashflow(rows, opening = 0) {
  const start = typeof opening === 'number' ? opening : parseCashAmount(opening)
  let inflow = 0
  let outflow = 0
  const byMonth = {}
  for (const row of rows) {
    if (!isCash(row.account)) continue
    const value = parseCashAmount(row.amount)
    const key = monthKey(row.date)
    const month = (byMonth[key] ??= { inflow: 0, outflow: 0 })
    if (value >= 0) {
      inflow += value
      month.inflow += value
    } else {
      outflow -= value
      month.outflow -= value
    }
  }
  return { opening: start, inflow, outflow, closing: start + inflow - outflow, byMonth }
}

// 잔액이 가장 낮았던 달. 자금 계획에 쓴다
export function lowestMonth(result) {
  let balance = result.opening
  let lowest = null
  for (const key of Object.keys(result.byMonth).sort()) {
    const m = result.byMonth[key]
    balance += m.inflow - m.outflow
    if (!lowest || balance < lowest.balance) lowest = { month: key, balance }
  }
  return lowest
}

// 지금 잔액으로 몇 달을 버틸 수 있는지. 달마다 평균으로 나간 돈 기준, 나간 돈이 없으면 null
export function runwayMonths(result) {
  const months = Object.keys(result.byMonth).length
  if (!months || !result.outflow) return null
  const burn = result.outflow / months
  return Math.floor(result.closing / burn)
}

export function formatCashflow(result) {
  const months = Object.keys(result.byMonth)
    .sort()
    .map((month) => ({ month, ...result.byMonth[month] }))
  const table = renderTable(
    [
      { key: 'month', title: '월' },
      { key: 'inflow', title: '들어온 돈', align: 'right', format: (v) => formatWon(v) },
      { key: 'outflow', title: '나간 돈', align: 'right', format: (v) => formatWon(v) },
    ],
    months,
  )
  return renderReport('현금흐름', [
    { heading: '월별', body: table },
    {
      heading: '합계',
      body: keyValueLines([
        ['기초', formatWon(result.opening)],
        ['들어온 돈', formatWon(result.inflow)],
        ['나간 돈', formatWon(result.outflow)],
        ['기말', formatWon(result.closing)],
      ]),
    },
  ])
}
