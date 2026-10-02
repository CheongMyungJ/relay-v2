import { paymentDays } from '../customers/terms.js'
import { dueDateFor } from './due.js'
import { createInvoice } from './invoice.js'

// 고객 정보로 청구서 초안을 만든다. 영세율 여부와 납부 기한을 고객에서 가져온다
export function draftInvoiceFor(customer, { lines, issueDate, memo }) {
  if (!customer) throw new Error('고객이 없다')
  return createInvoice({
    customerId: customer.id,
    lines,
    issueDate,
    dueDate: issueDate ? dueDateFor(issueDate, paymentDays(customer)) : null,
    zeroRated: customer.zeroRated,
    memo,
  })
}
