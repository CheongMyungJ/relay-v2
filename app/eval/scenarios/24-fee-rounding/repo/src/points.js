import { percentOf, won } from './money.js'

/** 회원 등급별 적립률(%) */
export const POINT_RATES = { basic: 1, silver: 1, gold: 1.5, vip: 2 }

/** 결제 금액에서 배송비를 뺀 금액에 등급 적립률을 곱해 포인트를 적립한다 */
export function earnPoints(amounts, member) {
  const rate = POINT_RATES[member.grade] ?? 0
  const base = amounts.paid - amounts.shipping
  if (base <= 0) return 0
  return won(percentOf(base, rate))
}
