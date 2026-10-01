import { test } from 'node:test'
import assert from 'node:assert'
import { balance, listOrders, outbox, placeOrder } from '../src/app.js'

const items = [{ price: 12000, qty: 1 }]

test('주문하면 저장, 적립, 메일이 지금처럼 한 번씩 일어난다', () => {
  const before = listOrders().length
  const sent = outbox.length
  const order = placeOrder({ customer: 'lee', email: 'lee@example.com', items })
  assert.strictEqual(order.amount, 12000)
  assert.strictEqual(listOrders().length, before + 1)
  assert.strictEqual(balance('lee'), 120)
  assert.strictEqual(outbox.length, sent + 1)
  assert.deepStrictEqual(outbox.at(-1), { to: 'lee@example.com', subject: `주문 ${order.id} 확인` })
})

test('메일 주소가 틀리면 placeOrder가 지금처럼 바로 오류를 던지고, 주문과 적립은 남는다', () => {
  const before = listOrders().length
  assert.throws(() => placeOrder({ customer: 'park', email: 'park-at-example', items }), /email: invalid address/)
  assert.strictEqual(listOrders().length, before + 1)
  assert.strictEqual(balance('park'), 120)
})

test('품목이 없으면 아무 일도 없이 오류다', () => {
  const before = listOrders().length
  const sent = outbox.length
  assert.throws(() => placeOrder({ customer: 'choi', email: 'choi@example.com', items: [] }), /no items/)
  assert.strictEqual(listOrders().length, before)
  assert.strictEqual(outbox.length, sent)
  assert.strictEqual(balance('choi'), 0)
})
