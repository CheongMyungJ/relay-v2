// 결제 워커: 큐에서 작업을 꺼내 결제사에 청구하고 주문을 paid로 바꾼다. 실패하면 pending_payment로 둔다
import { find, save } from '../orders/store.js'
import { charge } from './gateway.js'
import { take } from './queue.js'

export async function runOnce() {
  const job = take()
  if (!job) return false
  const order = find(job.orderId)
  if (!order) return true
  const r = await charge(order.id, order.total)
  if (r.ok) save({ ...order, status: 'paid', chargeId: r.chargeId })
  return true
}
