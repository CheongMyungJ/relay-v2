// 주문 하나가 세 영역을 지나는 길: 주문 → 결제 → 송장·적립·알림 → 배송 → 취소 불가
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { atKst, cartOf, errorCode, setup } from './helpers.js'

test('주문에서 배송 완료까지', () => {
  const shop = setup()
  atKst(shop, '2026-03-03 10:00')
  const cart = cartOf(shop, [['TEA', 1], ['MUG', 2]])
  const placed = shop.orders.placeOrder({ customerId: 'u-1', cart, couponCode: 'WELCOME' })
  assert.equal(placed.discount, 3000)
  assert.equal(placed.shipping, 0)
  assert.equal(placed.total, 51000)

  const paid = shop.orders.pay(placed.id, { cardToken: 'tok-visa' })
  assert.equal(paid.eta, '2026-03-04')
  const invoice = shop.billing.invoiceForOrder(paid.id)
  assert.equal(invoice.total, 51000)
  assert.equal(invoice.status, 'paid')
  assert.equal(shop.points.balance('u-1'), 510)

  shop.orders.ship(paid.id, { carrier: 'hanjin', trackingNo: '77' })
  assert.throws(() => shop.orders.cancelOrder(paid.id), errorCode('CANNOT_CANCEL'))
  shop.orders.deliver(paid.id)

  const types = shop.notifier.log({ customerId: 'u-1' }).map((n) => n.type)
  assert.deepEqual(types, ['order.placed', 'order.shipped'])
  assert.equal(shop.channels.sms.sent.length, 2)
})

test('취소하면 환불, 전표, 적립 회수, 취소 알림', () => {
  const shop = setup()
  atKst(shop, '2026-03-03 15:00')
  const order = shop.orders.placeOrder({ customerId: 'u-2', cart: cartOf(shop, [['TEA', 2]]) })
  shop.orders.pay(order.id, { cardToken: 'tok-visa' })
  const { refund } = shop.orders.cancelOrder(order.id, { reason: 'changed-mind' })
  assert.equal(refund, 60000)
  const invoice = shop.billing.invoiceForOrder(order.id)
  assert.deepEqual(shop.billing.creditNotesFor(invoice.id).map((c) => [c.amount, c.reason]), [[60000, '주문 취소(changed-mind)']])
  assert.equal(shop.points.balance('u-2'), 0)
  assert.equal(shop.channels.email.sent.at(-1).subject, 'Order A-1001 cancelled')
})
