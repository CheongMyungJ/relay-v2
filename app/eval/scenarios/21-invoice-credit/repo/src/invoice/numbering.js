import { INVOICE_NUMBER_DIGITS, INVOICE_PREFIX } from '../config.js'

export function formatInvoiceNumber(n) {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError(`청구서 번호는 양의 정수: ${n}`)
  return `${INVOICE_PREFIX}${String(n).padStart(INVOICE_NUMBER_DIGITS, '0')}`
}

export function parseInvoiceNumber(text) {
  if (typeof text !== 'string' || !text.startsWith(INVOICE_PREFIX)) return null
  const digits = text.slice(INVOICE_PREFIX.length)
  if (!/^\d+$/.test(digits)) return null
  return Number(digits)
}

// 마지막으로 쓴 번호 다음부터 차례로 번호를 준다
export function createNumberer(lastIssued = null) {
  let current = lastIssued ? parseInvoiceNumber(lastIssued) : 0
  if (current === null) throw new Error(`청구서 번호 형식이 아니다: ${lastIssued}`)
  return {
    next() {
      current += 1
      return formatInvoiceNumber(current)
    },
    peek() {
      return formatInvoiceNumber(current + 1)
    },
  }
}

// 청구서 목록에서 가장 큰 번호
export function lastInvoiceNumber(invoices) {
  let max = 0
  for (const inv of invoices) {
    const n = parseInvoiceNumber(inv.number ?? '')
    if (n !== null && n > max) max = n
  }
  return max ? formatInvoiceNumber(max) : null
}
