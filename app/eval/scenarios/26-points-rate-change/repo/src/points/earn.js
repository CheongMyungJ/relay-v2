import { POINT_RATE_PERCENT } from '../config.js'
import { percentOf } from '../money.js'

/** 주문의 적립 포인트. 결제 금액의 POINT_RATE_PERCENT% */
export function earnPoints(order) {
  return percentOf(order.amounts.total, POINT_RATE_PERCENT)
}
