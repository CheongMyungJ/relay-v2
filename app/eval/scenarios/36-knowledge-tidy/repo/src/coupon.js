// 쿠폰 계산

export const MAX_DISCOUNT_RATE = 0.5
export const MIN_ORDER_AMOUNT = 10000

// 주문 금액(배송비 제외)에 대한 할인 금액. 원 단위 버림, 상한은 주문 금액의 50%
export function discountAmount(order, coupon) {
  const base = order.items.reduce((a, i) => a + i.price * i.qty, 0)
  if (base < MIN_ORDER_AMOUNT) return 0
  const raw = coupon.type === 'rate' ? base * coupon.value : coupon.value
  return Math.floor(Math.min(raw, base * MAX_DISCOUNT_RATE))
}

// 한 주문에 쿠폰은 하나만 쓴다
export function canStack(applied) {
  return applied.length === 0
}

// 만료: KST(UTC+9) 자정 기준. expiresOn은 'YYYY-MM-DD'(그날 23:59:59 KST까지 쓸 수 있음)
export function couponExpired(coupon, now) {
  const end = Date.parse(`${coupon.expiresOn}T23:59:59+09:00`)
  return now.getTime() > end
}

// 환불하면 쓴 쿠폰을 되돌려 준다(만료되지 않았을 때)
export function refundCoupon(coupon, now) {
  return couponExpired(coupon, now) ? null : { ...coupon, used: false }
}
