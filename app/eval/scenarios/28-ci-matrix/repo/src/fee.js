// 주문 금액과 지역으로 배송비를 정한다
const BASE = { seoul: 3000, metro: 3000, island: 6000 }
const FREE_OVER = 50000

export function shippingFee(total, region) {
  if (total >= FREE_OVER) return 0
  return BASE[region] ?? 4000
}
