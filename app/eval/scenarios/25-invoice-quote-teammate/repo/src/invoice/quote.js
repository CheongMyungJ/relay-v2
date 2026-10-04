import { VAT_RATE_PERCENT } from '../config.js'
import { addDays, assertDate } from '../format/date.js'
import { percentOf, sumWon } from '../money.js'
import { lineDiscount } from './discount.js'
import { lineGross, normalizeLine } from './line.js'
import { isTaxableLine } from './tax-type.js'

// 견적서. 거래처가 주문하기 전에 받아 보는 예상 금액이다. 품목 줄은 청구서와 같은 형식이고,
// 견적 번호(Q-0000)와 유효 기간(일)이 있다. 주문이 들어오면 같은 품목으로 청구서를 만든다.
export const DEFAULT_VALID_DAYS = 14

export function createQuote(input) {
  if (!/^Q-\d{4}$/.test(String(input.number ?? ''))) throw new Error(`견적 번호는 Q-0000 형식이다: ${input.number}`)
  if (!input.customerId) throw new Error('거래처가 없다')
  if (!Array.isArray(input.lines) || input.lines.length === 0) throw new Error('품목이 없다')
  const validDays = input.validDays ?? DEFAULT_VALID_DAYS
  if (!Number.isInteger(validDays) || validDays < 1) throw new RangeError(`유효 기간(일): ${validDays}`)
  const quote = {
    number: input.number,
    customerId: input.customerId,
    issueDate: assertDate(input.issueDate),
    validDays,
    zeroRated: !!input.zeroRated,
    lines: input.lines.map((l, i) => normalizeLine(l, i)),
  }
  quote.totals = quoteTotals(quote)
  return quote
}

// 견적 합계. 과세 품목의 부가세는 할인 전 금액에 매기고, 할인한 만큼의 부가세를 뺀다
export function quoteTotals(quote) {
  const rows = quote.lines.map((line) => {
    const gross = lineGross(line)
    const discount = lineDiscount(line)
    return { gross, discount, net: gross - discount, taxable: isTaxableLine(line) }
  })
  const taxableRows = rows.filter((r) => r.taxable)
  const supply = sumWon(rows.map((r) => r.net))
  const taxable = sumWon(taxableRows.map((r) => r.net))
  const vat = quote.zeroRated
    ? 0
    : percentOf(sumWon(taxableRows.map((r) => r.gross)), VAT_RATE_PERCENT) -
      percentOf(sumWon(taxableRows.map((r) => r.discount)), VAT_RATE_PERCENT)
  return { supply, taxable, exempt: supply - taxable, vat, total: supply + vat }
}

// 견적 유효 기간의 마지막 날. 발행일을 1일째로 센다
export function quoteValidUntil(quote) {
  return addDays(quote.issueDate, quote.validDays - 1)
}

export function isQuoteExpired(quote, today) {
  return assertDate(today) > quoteValidUntil(quote)
}
