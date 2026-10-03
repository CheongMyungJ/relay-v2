import { itemsTotal } from './cart.js'

export const FREE_SHIPPING_MIN = 50000
export const SHIPPING_FEE = 3000

/** 배송비: 상품 합계가 기준을 넘으면 무료 */
export function shippingFee(cart) {
  return itemsTotal(cart) > FREE_SHIPPING_MIN ? 0 : SHIPPING_FEE
}
