// 주문 확정. 결제는 큐에 넣고 바로 돌아온다(주문은 pending_payment)
import { enqueue } from '../payments/queue.js'
import { save } from './store.js'

export function placeOrder(customerId, lines) {
  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0)
  const order = save({ customerId, lines, total, status: 'pending_payment' })
  enqueue({ orderId: order.id })
  return order
}
