// 청구서를 PDF 생성기에 넘기는 고정폭 글로 만든다.
// 생성기는 이 글을 줄 단위로 그대로 찍으므로, 줄 수와 칸 위치가 바뀌면 인쇄 양식이 어긋난다.
import { COMPANY, INVOICE_TEXT_WIDTH } from '../config.js'
import { formatBizNo } from '../customers/customer.js'
import { describeDiscount } from '../invoice/discount.js'
import { invoiceTotals } from '../invoice/invoice.js'
import { lineAmounts } from '../invoice/total.js'
import { formatDateKo } from './date.js'
import { formatNumber, wonInWords } from './won.js'
import { centerW, padEndW, padStartW, truncateW } from './width.js'

const W = INVOICE_TEXT_WIDTH
const COL = { name: 18, qty: 6, price: 11, amount: 13 }

const rule = (ch) => ch.repeat(W)

function field(label, value) {
  return `${padEndW(label, 14)}${value}`
}

function row(name, qty, price, amount) {
  return (
    padEndW(truncateW(name, COL.name), COL.name) +
    padStartW(qty, COL.qty) +
    padStartW(price, COL.price) +
    padStartW(amount, COL.amount)
  )
}

function summary(label, amount) {
  return padEndW(label, W - COL.amount) + padStartW(formatNumber(amount), COL.amount)
}

function partyLine(name, bizNo) {
  return bizNo ? `${name} (${formatBizNo(bizNo)})` : name
}

// invoice: createInvoice나 issueInvoice의 결과, customer: 고객(없으면 고객 ID만 적는다)
export function renderInvoice(invoice, { customer } = {}) {
  const totals = invoiceTotals(invoice)
  const title = invoice.status === 'draft' ? '청 구 서 (초안)' : '청 구 서'
  const out = [rule('='), centerW(title, W).trimEnd(), rule('=')]

  out.push(field('청구서 번호', invoice.number ?? '(미발행)'))
  if (invoice.issueDate) out.push(field('발행일', formatDateKo(invoice.issueDate)))
  if (invoice.dueDate) out.push(field('납부 기한', formatDateKo(invoice.dueDate)))
  out.push(field('공급자', partyLine(COMPANY.name, COMPANY.bizNo)))
  out.push(field('공급받는자', customer ? partyLine(customer.name, customer.bizNo) : invoice.customerId))

  out.push(rule('-'), row('품목', '수량', '단가', '금액'), rule('-'))
  for (const r of lineAmounts(invoice)) {
    const name = r.taxable ? r.line.name : `${r.line.name}(면세)`
    out.push(row(name, formatNumber(r.line.qty), formatNumber(r.line.unitPrice), formatNumber(r.gross)))
    if (r.discount) out.push(row(`  ${describeDiscount(r.line.discount)}`, '', '', formatNumber(-r.discount)))
  }

  out.push(rule('-'))
  out.push(summary('공급가액', totals.supply))
  if (totals.exempt) out.push(summary('  면세분', totals.exempt))
  out.push(summary(invoice.zeroRated ? '부가세(영세율)' : '부가세', totals.vat))
  out.push(summary('합계', totals.total))
  out.push(rule('='))
  out.push(wonInWords(totals.total))
  if (invoice.memo) out.push(`비고: ${invoice.memo}`)
  out.push(`입금 계좌: ${COMPANY.bank}`)
  return out.join('\n')
}
