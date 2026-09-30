import { DEFAULT_PAYMENT_DAYS } from '../config.js'

// 고객 등급별 결제 조건(납부 기한, 일)
export const PAYMENT_TERMS = {
  A: 45,
  B: 30,
  C: 15,
}

export function paymentDays(customer) {
  return PAYMENT_TERMS[customer?.grade] ?? DEFAULT_PAYMENT_DAYS
}

// 연체가 이 일수를 넘으면 새 주문을 막는다
export const CREDIT_HOLD_DAYS = {
  A: 60,
  B: 30,
  C: 0,
}

export function isOnCreditHold(customer, maxDaysOverdue) {
  const limit = CREDIT_HOLD_DAYS[customer?.grade] ?? 30
  return maxDaysOverdue > limit
}
