import { InvalidStateError } from '../util/errors.js'

/**
 * 주문 취소. 접수 상태(placed)의 주문만 취소할 수 있다. 줄마다 예약을 푼다.
 */
export function cancelOrder({ inventory, orderStore, notifier, clock, log }, orderId, reason = '') {
  const order = orderStore.get(orderId)
  if (order.status !== 'placed') {
    throw new InvalidStateError(`취소할 수 없는 주문: ${orderId} (${order.status})`)
  }

  for (const line of order.lines) inventory.releaseLine(line)

  const cancelled = orderStore.update(orderId, {
    status: 'cancelled',
    cancelledAt: clock.iso(),
    cancelReason: reason,
  })
  log.info('주문 취소', { orderId, reason })
  notifier.send('order.cancelled', { orderId, customerId: order.customer.id, reason })
  return cancelled
}
