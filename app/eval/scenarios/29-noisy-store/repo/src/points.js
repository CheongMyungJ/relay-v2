import { before, dateOf } from './dates.js'

/** 적립 기록 가운데 지금 쓸 수 있는 포인트 합 (유효기간이 지나지 않은 것) */
export function usablePoints(ledger, now) {
  const today = dateOf(now)
  return ledger
    .filter((e) => e.type === 'earn' && !before(e.expiresOn, today))
    .reduce((sum, e) => sum + e.remaining, 0)
}

/** 포인트 잔액 (유효기간과 관계없이 남은 것) */
export function balance(ledger) {
  return ledger.filter((e) => e.type === 'earn').reduce((sum, e) => sum + e.remaining, 0)
}
