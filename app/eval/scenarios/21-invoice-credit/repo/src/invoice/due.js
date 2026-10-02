import { DEFAULT_PAYMENT_DAYS } from '../config.js'
import { addDays, assertDate, daysBetween } from '../format/date.js'

// 발행일로부터 납부 기한을 정한다
export function dueDateFor(issueDate, paymentDays = DEFAULT_PAYMENT_DAYS) {
  if (!Number.isInteger(paymentDays) || paymentDays < 0) throw new RangeError(`납부 일수: ${paymentDays}`)
  return addDays(assertDate(issueDate), paymentDays)
}

// 납부 기한이 지났는지. 기한 당일은 연체가 아니다
export function isOverdue(invoice, today) {
  if (invoice.status !== 'issued' || !invoice.dueDate) return false
  return daysBetween(invoice.dueDate, today) > 0
}

export function daysOverdue(invoice, today) {
  return isOverdue(invoice, today) ? daysBetween(invoice.dueDate, today) : 0
}
