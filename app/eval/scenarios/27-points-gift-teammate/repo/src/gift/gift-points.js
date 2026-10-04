import { POINT_RATE_PERCENT } from '../config.js'
import { percentOf } from '../money.js'

/** 선물하기 주문의 적립 포인트(보내는 사람에게 쌓인다) */
export function giftPoints(order) {
  return percentOf(order.amounts.total, POINT_RATE_PERCENT)
}
