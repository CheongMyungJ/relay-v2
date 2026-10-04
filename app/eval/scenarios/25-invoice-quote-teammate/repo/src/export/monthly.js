import { monthOf } from '../format/date.js'
import { invoiceTotals } from '../invoice/invoice.js'

// 월별 매출 요약. 취소와 초안은 뺀다
export function monthlySummary(invoices) {
  const byMonth = new Map()
  for (const inv of invoices) {
    if (inv.status === 'draft' || inv.status === 'void') continue
    const month = monthOf(inv.issueDate)
    const t = invoiceTotals(inv)
    const m = byMonth.get(month) ?? { month, count: 0, supply: 0, vat: 0, total: 0, paid: 0 }
    m.count += 1
    m.supply += t.supply
    m.vat += t.vat
    m.total += t.total
    if (inv.status === 'paid') m.paid += t.total
    byMonth.set(month, m)
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
}

// 미수금: 발행했지만 아직 입금되지 않은 금액
export function outstanding(invoices) {
  return invoices
    .filter((inv) => inv.status === 'issued')
    .reduce((s, inv) => s + invoiceTotals(inv).total, 0)
}
