import { itemsTotal } from './cart.js'
import { FREE_SHIPPING_MIN } from './shipping.js'

/** 무료배송까지 남은 금액. 이미 무료면 0 */
export function freeShippingRemaining(cart) {
  return Math.max(FREE_SHIPPING_MIN - itemsTotal(cart), 0)
}

/** 장바구니 화면 상단 안내 문구 */
export function cartBanner(cart) {
  const left = freeShippingRemaining(cart)
  if (left === 0) return '무료배송 대상입니다'
  return `무료배송까지 ${left.toLocaleString('ko-KR')}원 남았습니다`
}
