import { test } from 'node:test'
import assert from 'node:assert'
import { placeOrder } from '../src/orders/service.js'
import { clear, find } from '../src/orders/store.js'
import { size } from '../src/payments/queue.js'
import { runOnce } from '../src/payments/worker.js'
import { ship } from '../src/shipping/ship.js'

test('주문을 확정하면 결제 작업이 큐에 들어가고 워커가 paid로 바꾼다', async () => {
  clear()
  const order = placeOrder(1, [{ sku: 'tea', price: 4500, qty: 2 }])
  assert.strictEqual(order.status, 'pending_payment')
  assert.strictEqual(order.total, 9000)
  assert.strictEqual(size(), 1)
  await runOnce()
  assert.strictEqual(find(order.id).status, 'paid')
})

test('결제 전 주문은 출고하지 않는다', () => {
  clear()
  const order = placeOrder(2, [{ sku: 'cup', price: 12000, qty: 1 }])
  assert.throws(() => ship(order.id))
})
