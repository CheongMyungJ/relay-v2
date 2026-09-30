// 쿠폰 할인. percent는 0~100, 원 단위로 반올림
export function applyCoupon(total, coupon) {
  if (!coupon) return total
  return Math.round((total * (100 - coupon.percent)) / 100)
}
