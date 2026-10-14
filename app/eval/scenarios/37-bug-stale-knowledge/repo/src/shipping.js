// 배송비 계산
export const FREE_SHIPPING_MIN = 50000
export const BASE_FEE = 3000
// 도서산간(제주 포함) 추가 배송비
export const REMOTE_EXTRA = 4000
// 이 시각(시) 전 주문은 당일 출고
export const CUTOFF_HOUR = 14

export function shippingFee(order) {
  const extra = order.remote ? REMOTE_EXTRA : 0
  if (order.subtotal > FREE_SHIPPING_MIN) return extra
  return BASE_FEE + extra
}

export function shipsToday(orderedAt) {
  return orderedAt.getHours() < CUTOFF_HOUR
}
