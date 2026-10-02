import { createCreditNote } from '../src/invoice/credit-note.js'
import { createInvoice, issueInvoice } from '../src/invoice/invoice.js'

// 예시 청구서를 발행하고 반품 전표를 만든다
export function issued(data) {
  return issueInvoice(createInvoice(data), { number: data.number, issueDate: data.issueDate })
}

export function creditNoteOf({ invoice, ...data }) {
  return createCreditNote(issued(invoice), data)
}
