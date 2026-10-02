import { percentOf } from '../money.js'
import { formatNumber } from '../format/won.js'
import { lineGross } from './line.js'

// 품목 줄의 할인 금액(원)
export function lineDiscount(line) {
  const d = line.discount
  if (!d) return 0
  const gross = lineGross(line)
  const amount = d.percent != null ? percentOf(gross, d.percent) : d.amount
  if (amount > gross) {
    throw new RangeError(`${line.name}: 할인(${amount})이 품목 금액(${gross})보다 크다`)
  }
  return amount
}

// 서식에 쓰는 할인 설명. '할인 10%', '할인 500원'
export function describeDiscount(discount) {
  if (!discount) return ''
  if (discount.percent != null) return `할인 ${discount.percent}%`
  return `할인 ${formatNumber(discount.amount)}원`
}
