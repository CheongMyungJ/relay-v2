import { FREE_SHIPPING_MIN, SHIPPING_FEE } from '../config.js'

/** 배송비. 쿠폰을 뺀 상품 금액으로 무료배송을 판단한다 */
export function shippingFee(goodsAfterCoupon) {
  return goodsAfterCoupon >= FREE_SHIPPING_MIN ? 0 : SHIPPING_FEE
}
