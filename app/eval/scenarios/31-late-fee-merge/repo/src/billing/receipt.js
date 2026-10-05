import { config } from '../config.js'
import { formatWon } from '../util/money.js'

/** 청구서(monthlyInvoice의 결과)를 문자나 메일로 보낼 글로 바꾼다 */
export function receiptText(invoice, memberName) {
  const lines = [
    `${config.storeName} ${invoice.month} 청구서`,
    `${memberName}님`,
    '',
    ...invoice.lines.map((l) => `${l.label}  ${formatWon(l.amount)}`),
    '',
    `공급가액  ${formatWon(invoice.supply)}`,
    `부가세  ${formatWon(invoice.vat)}`,
    `합계  ${formatWon(invoice.total)}`,
  ]
  return lines.join('\n')
}
