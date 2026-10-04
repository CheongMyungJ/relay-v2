import { formatWon, roundWon } from '#money'

const VAT_RATE = 0.1

/** 공급가액의 부가세 */
export function vat(supply) {
  return roundWon(supply * VAT_RATE)
}

/** 청구서의 금액 줄 */
export function invoiceLines(supply) {
  const tax = vat(supply)
  return [
    `공급가액 ${formatWon(supply)}`,
    `부가세 ${formatWon(tax)}`,
    `합계 ${formatWon(supply + tax)}`,
  ]
}
