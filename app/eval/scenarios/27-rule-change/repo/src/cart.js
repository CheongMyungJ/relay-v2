/** 상품 합계 (할인 전) */
export function itemsTotal(cart) {
  return cart.items.reduce((sum, i) => sum + i.price * i.qty, 0)
}

/** 쿠폰 할인액. 정액 쿠폰은 그대로, 정률 쿠폰은 원 단위 버림. 상품 합계를 넘지 않는다 */
export function couponDiscount(cart) {
  const c = cart.coupon
  if (!c) return 0
  const total = itemsTotal(cart)
  if (c.minTotal && total < c.minTotal) return 0
  const amount = c.type === 'percent' ? Math.floor((total * c.value) / 100) : c.value
  return Math.min(amount, total)
}
