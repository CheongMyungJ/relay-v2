import assert from 'node:assert/strict'
import { test } from 'node:test'
import { atKst, placePaid, setup } from './helpers.js'

test('하루 매출은 결제한 주문만, 한국 날짜로', () => {
  const shop = setup()
  atKst(shop, '2026-03-03 10:00')
  placePaid(shop, 'u-1', [['MUG', 2]])
  shop.orders.placeOrder({ customerId: 'u-1', cart: shop.newCart().add('TEA') })
  atKst(shop, '2026-03-04 00:30')
  placePaid(shop, 'u-2', [['TEA', 1]])
  assert.deepEqual(shop.reports.dailySales('2026-03-03'), { date: '2026-03-03', orders: 1, items: 2, amount: 24000 })
  assert.equal(shop.reports.dailyText('2026-03-04'), '2026-03-04 주문 1건, 상품 1개, 30,000원')
})

test('취소한 주문은 빠진다', () => {
  const shop = setup()
  const order = placePaid(shop, 'u-1', [['MUG', 1]])
  shop.orders.cancelOrder(order.id)
  assert.equal(shop.reports.dailySales('2026-03-02').items, 0)
})

test('많이 팔린 상품과 분류별 매출', () => {
  const shop = setup()
  placePaid(shop, 'u-1', [['MUG', 3], ['TEA', 1]])
  placePaid(shop, 'u-2', [['MUG', 1], ['RICE', 1]])
  assert.deepEqual(shop.reports.topProducts('2026-03-01', '2026-03-31', 2).map((p) => [p.sku, p.qty]), [['MUG', 4], ['RICE', 1]])
  assert.deepEqual(shop.reports.salesByCategory('2026-03-01', '2026-03-31'), { food: 63000, kitchen: 48000 })
})
