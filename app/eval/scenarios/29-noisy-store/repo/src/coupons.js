import { before, dateOf } from './dates.js'

/** 쿠폰을 지금 쓸 수 있는가: 시작일 이후이고 만료일이 지나지 않았다 */
export function isCouponValid(coupon, now) {
  const today = dateOf(now)
  if (coupon.used) return false
  if (before(today, coupon.startsOn)) return false
  return !before(coupon.expiresOn, today)
}
