import { isExpense, isRevenue } from '../ledger/accounts.js'
import { inRange, quarterRange } from '../lib/dates.js'
import { parseAmount } from '../lib/money.js'
import { isTaxFree, vatFor } from '../tax/rates.js'
import { formatWon } from '../format/number.js'
import { keyValueLines, renderReport } from '../format/text.js'

// 한 행의 공급가액과 세액. 부가세 칸이 비어 있으면 공급가액에서 계산한다
function supplyAndVat(row) {
  const supply = parseAmount(row.amount)
  const vat = String(row.vat ?? '').trim() === '' ? vatFor(supply) : parseAmount(row.vat)
  return { supply, vat }
}

// 분기 부가세 요약. period: { year, quarter } 또는 { from, to }. 없으면 전체
export function vatSummary(rows, period = {}) {
  const range = period.quarter ? quarterRange(period.year, period.quarter) : period
  const out = { salesSupply: 0, salesVat: 0, purchaseSupply: 0, purchaseVat: 0, payable: 0 }
  for (const row of rows) {
    if ((range.from || range.to) && !inRange(row.date, range.from, range.to)) continue
    if (isTaxFree(row.category)) continue
    if (isRevenue(row.account)) {
      const { supply, vat } = supplyAndVat(row)
      out.salesSupply += supply
      out.salesVat += vat
    } else if (isExpense(row.account)) {
      const { supply, vat } = supplyAndVat(row)
      out.purchaseSupply += supply
      out.purchaseVat += vat
    }
  }
  out.payable = out.salesVat - out.purchaseVat
  return out
}

// 달별 매출 세액과 매입 세액. 신고 전에 달마다 맞춰 보는 데 쓴다
export function vatByMonth(rows, year) {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, salesVat: 0, purchaseVat: 0 }))
  for (const row of rows) {
    if (!String(row.date).startsWith(`${year}-`) || isTaxFree(row.category)) continue
    const m = Number(String(row.date).slice(5, 7))
    if (!(m >= 1 && m <= 12)) continue
    if (isRevenue(row.account)) months[m - 1].salesVat += supplyAndVat(row).vat
    else if (isExpense(row.account)) months[m - 1].purchaseVat += supplyAndVat(row).vat
  }
  return months
}

export function formatVatSummary(summary, period = {}) {
  const title = period.quarter ? `${period.year}년 ${period.quarter}분기 부가세` : '부가세'
  return renderReport(title, [
    {
      body: keyValueLines([
        ['매출 공급가액', formatWon(summary.salesSupply)],
        ['매출 세액', formatWon(summary.salesVat)],
        ['매입 공급가액', formatWon(summary.purchaseSupply)],
        ['매입 세액', formatWon(summary.purchaseVat)],
        ['낼 세액', formatWon(summary.payable)],
      ]),
    },
  ])
}
