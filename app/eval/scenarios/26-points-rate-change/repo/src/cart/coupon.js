import { floorTen } from '../money.js'

// 쿠폰: 주문 하나에 하나. { code, amount } 금액 할인 또는 { code, percent, max } 비율 할인(10원 단위 버림).
// minGoods가 있으면 상품 금액이 그 이상일 때만 쓸 수 있다

export function couponDiscount(goods, coupon) {
  if (!coupon) return 0
  if (coupon.minGoods && goods < coupon.minGoods) throw new Error(`쿠폰 ${coupon.code}: 최소 주문 금액 ${coupon.minGoods}원`)
  let d
  if (coupon.amount != null) d = coupon.amount
  else if (coupon.percent != null) {
    d = floorTen((goods * coupon.percent) / 100)
    if (coupon.max != null) d = Math.min(d, coupon.max)
  } else throw new Error(`쿠폰 ${coupon.code}: 할인 방식이 없다`)
  return Math.min(d, goods)
}
