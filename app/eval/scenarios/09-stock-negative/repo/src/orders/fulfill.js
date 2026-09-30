import { InvalidStateError } from '../util/errors.js'
import { compareWarehouse, warehouseName } from '../warehouses/registry.js'

/** 주문이 나가는 창고들(우선순위 순) */
export function warehousesOfOrder(order) {
  const codes = new Set(order.lines.flatMap((l) => l.allocations.map((a) => a.warehouse)))
  return [...codes].sort(compareWarehouse)
}

/**
 * 출고. 접수 상태의 주문을 창고별로 내보낸다.
 */
export function shipOrder({ inventory, orderStore, notifier, clock, log }, orderId) {
  const order = orderStore.get(orderId)
  if (order.status !== 'placed') {
    throw new InvalidStateError(`출고할 수 없는 주문: ${orderId} (${order.status})`)
  }

  for (const line of order.lines) inventory.shipLine(line)

  const warehouses = warehousesOfOrder(order)
  const shipped = orderStore.update(orderId, { status: 'shipped', shippedAt: clock.iso() })
  log.info('출고', { orderId, warehouses })
  notifier.send('order.shipped', {
    orderId,
    customerId: order.customer.id,
    warehouses: warehouses.map(warehouseName),
  })
  return shipped
}
