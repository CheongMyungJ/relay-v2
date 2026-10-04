import { VAT_RATE_PERCENT } from '../config.js'
import { sumWon } from '../money.js'
import { lineDiscount } from './discount.js'
import { lineGross } from './line.js'
import { isTaxableLine } from './tax-type.js'

// 품목 줄마다 할인 전 금액, 할인, 공급가액
export function lineAmounts(invoice) {
  return invoice.lines.map((line) => {
    const gross = lineGross(line)
    const discount = lineDiscount(line)
    return { line, gross, discount, net: gross - discount, taxable: isTaxableLine(line) }
  })
}

// 청구서 합계
//   subtotal: 할인 전 금액 합, discount: 할인 합, supply: 공급가액 합
//   taxable / exempt: 공급가액 중 과세분 / 면세분, vat: 부가세, total: 청구 합계
export function computeTotals(invoice) {
  const rows = lineAmounts(invoice)
  const subtotal = sumWon(rows.map((r) => r.gross))
  const discount = sumWon(rows.map((r) => r.discount))
  const taxable = sumWon(rows.filter((r) => r.taxable).map((r) => r.net))
  const exempt = sumWon(rows.filter((r) => !r.taxable).map((r) => r.net))
  const supply = taxable + exempt
  const vat = invoice.zeroRated ? 0 : Math.round((taxable * VAT_RATE_PERCENT) / 100)
  return { subtotal, discount, supply, taxable, exempt, vat, total: supply + vat }
}
