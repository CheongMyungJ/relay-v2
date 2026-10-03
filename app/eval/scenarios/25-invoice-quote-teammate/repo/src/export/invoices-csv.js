import { invoiceTotals } from '../invoice/invoice.js'
import { statusLabel } from '../invoice/status.js'
import { toCsv } from './csv.js'

// 청구서 목록을 회계팀에 보내는 CSV로 만든다. 초안은 뺀다
export function invoicesToCsv(invoices, { customers, bom = true } = {}) {
  const rows = invoices
    .filter((inv) => inv.status !== 'draft')
    .sort((a, b) => (a.number ?? '').localeCompare(b.number ?? ''))
    .map((inv) => {
      const t = invoiceTotals(inv)
      const customer = customers?.get(inv.customerId)
      return {
        number: inv.number,
        issueDate: inv.issueDate,
        customer: customer?.name ?? inv.customerId,
        bizNo: customer?.bizNo ?? '',
        supply: t.supply,
        vat: t.vat,
        total: t.total,
        status: statusLabel(inv.status),
      }
    })
  return toCsv(
    rows,
    [
      { key: 'number', header: '청구서 번호' },
      { key: 'issueDate', header: '발행일' },
      { key: 'customer', header: '거래처' },
      { key: 'bizNo', header: '사업자등록번호' },
      { key: 'supply', header: '공급가액' },
      { key: 'vat', header: '부가세' },
      { key: 'total', header: '합계' },
      { key: 'status', header: '상태' },
    ],
    { bom },
  )
}
