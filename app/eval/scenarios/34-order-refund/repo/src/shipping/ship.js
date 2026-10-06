// 출고: paid인 주문만 (docs/design.md D5)
import { find, save } from '../orders/store.js'

export function ship(orderId) {
  const order = find(orderId)
  if (!order || order.status !== 'paid') throw new Error('결제된 주문만 출고한다')
  return save({ ...order, status: 'shipped' })
}
