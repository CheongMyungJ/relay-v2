import assert from 'node:assert/strict'
import { test } from 'node:test'
import { errorCode, placePaid, setup } from './helpers.js'

test('결제한 상품 금액의 1%(VIP 2%)를 쌓는다', () => {
  const shop = setup()
  placePaid(shop, 'u-1', [['TEA', 1]], { coupon: 'WELCOME' })
  assert.equal(shop.points.balance('u-1'), 270)
  shop.customers.update('u-2', { tier: 'vip' })
  placePaid(shop, 'u-2', [['TEA', 2]])
  assert.equal(shop.points.balance('u-2'), 1200)
})

test('취소하면 그 주문의 적립을 거둔다', () => {
  const shop = setup()
  const order = placePaid(shop, 'u-1', [['MUG', 2]])
  shop.orders.cancelOrder(order.id)
  assert.equal(shop.points.balance('u-1'), 0)
  assert.deepEqual(shop.points.history('u-1').map((p) => p.kind), ['earn', 'revoke'])
})

test('1년이 지나면 사라진다', () => {
  const shop = setup()
  placePaid(shop, 'u-1', [['TEA', 1]])
  assert.equal(shop.points.balance('u-1', '2027-03-01T00:00:00Z'), 300)
  assert.equal(shop.points.balance('u-1', '2027-03-03T00:00:00Z'), 0)
})

test('손으로 주는 적립', () => {
  const shop = setup()
  shop.points.grant('u-3', 1000, '배송 지연 사과')
  assert.equal(shop.points.balance('u-3'), 1000)
  assert.throws(() => shop.points.grant('u-3', 0, 'x'), errorCode('BAD_AMOUNT'))
  assert.throws(() => shop.points.grant('u-3', 10), errorCode('BAD_REQUEST'))
})
