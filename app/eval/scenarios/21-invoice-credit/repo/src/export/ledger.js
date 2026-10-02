import { creditNoteTotals } from '../invoice/credit-note.js'
import { invoiceTotals } from '../invoice/invoice.js'

// 청구서 한 장의 매출 분개. 차변과 대변의 합이 같아야 한다
//   차변 외상매출금 = 합계, 대변 상품매출 = 공급가액, 대변 부가세예수금 = 부가세
export function journalEntries(invoice) {
  if (invoice.status === 'draft') throw new Error('초안은 분개하지 않는다')
  const t = invoiceTotals(invoice)
  const ref = invoice.number
  const date = invoice.issueDate
  const entries = [
    { date, ref, account: '외상매출금', debit: t.total, credit: 0 },
    { date, ref, account: '상품매출', debit: 0, credit: t.supply },
  ]
  if (t.vat) entries.push({ date, ref, account: '부가세예수금', debit: 0, credit: t.vat })
  if (invoice.status === 'void') {
    // 취소된 청구서는 반대 분개를 더한다
    for (const e of [...entries]) entries.push({ ...e, debit: e.credit, credit: e.debit, reversal: true })
  }
  assertBalanced(entries, ref)
  return entries
}

export function assertBalanced(entries, ref = '') {
  const debit = entries.reduce((s, e) => s + e.debit, 0)
  const credit = entries.reduce((s, e) => s + e.credit, 0)
  if (debit !== credit) throw new Error(`분개 차대 불일치 ${ref}: 차변 ${debit}, 대변 ${credit}`)
}

// 반품 전표 한 장의 분개. 청구서 분개의 반대 방향이다
//   차변 매출환입 = 공급가액, 차변 부가세예수금 = 부가세, 대변 외상매출금 = 돌려주는 합계
export function creditNoteEntries(note) {
  const t = creditNoteTotals(note)
  const ref = note.number
  const date = note.issueDate
  const entries = [{ date, ref, account: '매출환입', debit: t.supply, credit: 0 }]
  if (t.vat) entries.push({ date, ref, account: '부가세예수금', debit: t.vat, credit: 0 })
  entries.push({ date, ref, account: '외상매출금', debit: 0, credit: t.total, invoice: note.invoiceNumber })
  assertBalanced(entries, ref)
  return entries
}

// 여러 청구서와 반품 전표의 분개를 날짜, 번호 순으로
export function ledger(invoices, creditNotes = []) {
  return [
    ...invoices.filter((inv) => inv.status !== 'draft').flatMap(journalEntries),
    ...creditNotes.flatMap(creditNoteEntries),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref))
}
