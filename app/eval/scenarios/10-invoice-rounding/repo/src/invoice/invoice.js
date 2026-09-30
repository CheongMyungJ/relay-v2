import { assertDate } from '../format/date.js'
import { normalizeLine } from './line.js'
import { assertTransition } from './status.js'
import { computeTotals } from './total.js'

// 새 청구서(초안)를 만든다
// data: { customerId, lines, number?, issueDate?, zeroRated?, memo? }
export function createInvoice(data) {
  if (!data || typeof data !== 'object') throw new TypeError('청구서 데이터가 없다')
  if (!data.customerId) throw new Error('고객 ID가 없다')
  if (!Array.isArray(data.lines) || data.lines.length === 0) throw new Error('품목이 하나도 없다')
  return {
    number: data.number ?? null,
    customerId: String(data.customerId),
    issueDate: data.issueDate ? assertDate(data.issueDate) : null,
    dueDate: data.dueDate ? assertDate(data.dueDate) : null,
    zeroRated: Boolean(data.zeroRated),
    memo: data.memo ? String(data.memo) : '',
    lines: data.lines.map((raw, i) => normalizeLine(raw, i)),
    status: 'draft',
    totals: null,
  }
}

// 청구서를 발행한다. 발행할 때 합계를 계산해 저장하고, 그 뒤로는 저장된 합계를 쓴다
export function issueInvoice(invoice, { number, issueDate, dueDate }) {
  assertTransition(invoice.status, 'issued')
  if (!number) throw new Error('발행하려면 청구서 번호가 필요하다')
  return {
    ...invoice,
    number,
    issueDate: assertDate(issueDate),
    dueDate: dueDate ? assertDate(dueDate) : invoice.dueDate,
    status: 'issued',
    totals: computeTotals(invoice),
  }
}

// 청구서의 합계. 발행된 청구서는 저장된 합계를 그대로 쓴다(다시 계산하지 않는다)
export function invoiceTotals(invoice) {
  if (invoice.status !== 'draft' && invoice.totals) return invoice.totals
  return computeTotals(invoice)
}

// 입금 처리. 부분 입금은 받지 않는다
export function markPaid(invoice, { paidAt, amount }) {
  assertTransition(invoice.status, 'paid')
  const { total } = invoiceTotals(invoice)
  if (amount !== total) throw new Error(`입금액 ${amount}이 청구 합계 ${total}와 다르다`)
  return { ...invoice, status: 'paid', paidAt: assertDate(paidAt) }
}

export function voidInvoice(invoice, reason) {
  assertTransition(invoice.status, 'void')
  if (!reason) throw new Error('취소 사유가 필요하다')
  return { ...invoice, status: 'void', voidReason: String(reason) }
}
