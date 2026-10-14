// 반품
export const RETURN_DAYS = 7

const DAY = 24 * 60 * 60 * 1000

export function canReturn(deliveredAt, now) {
  return now.getTime() - deliveredAt.getTime() <= RETURN_DAYS * DAY
}

// 환불은 결제한 수단으로 돌려준다
export function refundTo(order) {
  return order.paidWith
}
