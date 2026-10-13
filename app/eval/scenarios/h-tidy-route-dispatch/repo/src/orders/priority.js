/** 배정 우선순위: 작을수록 먼저. 냉장·냉동 0, 도착 창이 있는 주문 1, 나머지 2 */
export function priorityOf(order) {
  if (order.cold) return 0
  if (order.window) return 1
  return 2
}
