import { config } from '../config.js'

/** 첫 결제(시작일의 결제)에만 쓰는 쿠폰 할인 */
export function firstChargeAmount(price, coupon) {
  if (!coupon || coupon !== config.firstMonthCoupon.code) return price
  return Math.round(price * (1 - config.firstMonthCoupon.rate))
}
