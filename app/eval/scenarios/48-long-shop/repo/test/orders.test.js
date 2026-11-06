import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cartOf, errorCode, placePaid, setup } from './helpers.js'

test('주문을 받으면 재고를 잡고 금액을 정한다', () => {
  const shop = setup()
  const order = shop.orders.placeOrder({ customerId: 'u-1', cart: cartOf(shop, [['MUG', 2], ['BAG', 1]]) })
  assert.equal(order.number, 'A-1001')
  assert.equal(order.status, 'placed')
  assert.equal(order.itemsTotal, 32000)
  assert.equal(order.total, 35000)
  assert.equal(shop.catalog.get('BAG').stock, 2)
  assert.equal(shop.orders.findByNumber('A-1001').id, order.id)
})

test('재고가 모자라면 아무것도 잡지 않는다', () => {
  const shop = setup()
  assert.throws(
    () => shop.orders.placeOrder({ customerId: 'u-1', cart: cartOf(shop, [['MUG', 1], ['BAG', 5]]) }),
    errorCode('OUT_OF_STOCK'),
  )
  assert.equal(shop.catalog.get('MUG').stock, 20)
  assert.equal(shop.orders.listOrders().length, 0)
})

test('빈 장바구니와 판매 중지 상품', () => {
  const shop = setup()
  assert.throws(() => shop.orders.placeOrder({ customerId: 'u-1', cart: shop.newCart() }), errorCode('EMPTY_CART'))
  const cart = cartOf(shop, [['TEA', 1]])
  shop.catalog.discontinue('TEA')
  assert.throws(() => shop.orders.placeOrder({ customerId: 'u-1', cart }), errorCode('DISCONTINUED'))
})

test('쿠폰을 쓴 주문', () => {
  const shop = setup()
  const order = shop.orders.placeOrder({ customerId: 'u-1', cart: cartOf(shop, [['TEA', 1]]), couponCode: 'PCT10' })
  assert.equal(order.discount, 3000)
  assert.equal(order.total, 30000)
  assert.throws(
    () => shop.orders.placeOrder({ customerId: 'u-1', cart: cartOf(shop, [['BAG', 1]]), couponCode: 'PCT10' }),
    errorCode('COUPON_MIN'),
  )
})

test('결제, 배송, 배송 완료', () => {
  const shop = setup()
  const paid = placePaid(shop, 'u-1', [['TEA', 2]])
  assert.equal(paid.status, 'paid')
  assert.equal(paid.paidAmount, 60000)
  const shipped = shop.orders.ship(paid.id, { carrier: 'cj', trackingNo: '1234' })
  assert.equal(shipped.status, 'shipped')
  const delivered = shop.orders.deliver(paid.id)
  assert.deepEqual(delivered.history.map((h) => h.status), ['placed', 'paid', 'shipped', 'delivered'])
})

test('결제 실패', () => {
  const shop = setup()
  const order = shop.orders.placeOrder({ customerId: 'u-1', cart: cartOf(shop, [['MUG', 1]]) })
  assert.throws(() => shop.orders.pay(order.id, { cardToken: 'tok-declined' }), errorCode('PAYMENT_FAILED'))
  assert.equal(shop.orders.getOrder(order.id).status, 'placed')
  assert.equal(shop.bus.history().filter((e) => e.type === 'payment.failed').length, 1)
})

test('결제하지 않은 주문은 보낼 수 없다', () => {
  const shop = setup()
  const order = shop.orders.placeOrder({ customerId: 'u-1', cart: cartOf(shop, [['MUG', 1]]) })
  assert.throws(() => shop.orders.ship(order.id), errorCode('NOT_PAID'))
  assert.throws(() => shop.orders.deliver(order.id), errorCode('NOT_SHIPPED'))
})

test('결제한 주문을 취소하면 모두 환불하고 재고를 푼다', () => {
  const shop = setup()
  const paid = placePaid(shop, 'u-1', [['MUG', 2], ['BAG', 1]])
  const { order, refund } = shop.orders.cancelOrder(paid.id, { reason: 'customer' })
  assert.equal(refund, 35000)
  assert.equal(order.status, 'cancelled')
  assert.equal(order.refunded, 35000)
  assert.equal(shop.catalog.get('BAG').stock, 3)
  assert.equal(shop.payments.listFor(order.number).filter((p) => p.kind === 'refund')[0].amount, 35000)
})

test('결제 전 취소는 환불이 없다', () => {
  const shop = setup()
  const order = shop.orders.placeOrder({ customerId: 'u-1', cart: cartOf(shop, [['MUG', 1]]) })
  assert.equal(shop.orders.cancelOrder(order.id).refund, 0)
})

test('보낸 주문은 취소할 수 없다', () => {
  const shop = setup()
  const paid = placePaid(shop, 'u-1', [['MUG', 1]])
  shop.orders.ship(paid.id)
  assert.throws(() => shop.orders.cancelOrder(paid.id), errorCode('CANNOT_CANCEL'))
})

test('고객별, 상태별 주문 목록', () => {
  const shop = setup()
  placePaid(shop, 'u-1', [['MUG', 1]])
  shop.clock.advance(1000)
  shop.orders.placeOrder({ customerId: 'u-1', cart: cartOf(shop, [['TEA', 1]]) })
  shop.clock.advance(1000)
  placePaid(shop, 'u-2', [['BAG', 1]])
  assert.equal(shop.orders.listOrders({ customerId: 'u-1' }).length, 2)
  assert.deepEqual(shop.orders.listOrders({ status: 'paid' }).map((o) => o.number), ['A-1001', 'A-1003'])
})
