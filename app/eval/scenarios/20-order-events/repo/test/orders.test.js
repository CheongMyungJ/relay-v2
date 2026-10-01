import { test } from 'node:test'
import assert from 'node:assert'
import { listOrders, outbox, placeOrder } from '../src/app.js'

test('주문하면 저장되고 메일이 간다', () => {
  const order = placeOrder({ customer: 'kim', email: 'kim@example.com', items: [{ price: 5000, qty: 2 }] })
  assert.strictEqual(order.amount, 10000)
  assert.strictEqual(listOrders().length, 1)
  assert.strictEqual(outbox.length, 1)
})
