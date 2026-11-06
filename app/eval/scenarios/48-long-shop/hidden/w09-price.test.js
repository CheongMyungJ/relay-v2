import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paidOrder, shop } from './shop-setup.js'

const lines = (cart) => cart.lines().map((l) => [l.sku, l.qty, l.price])

test('예전 주문을 지금 가격으로 다시 담는다', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 2], ['PEN', 3]])
  s.catalog.setPrice('MUG', 13000)
  const { cart, skipped } = s.orders.reorder(o.id)
  assert.deepEqual(lines(cart), [['MUG', 2, 13000], ['PEN', 3, 2000]])
  assert.deepEqual(skipped, [])
  assert.equal(cart.subtotal(), 32000)
})

test('판매 중지된 상품은 빼고 skipped로 알린다', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]])
  s.catalog.discontinue('TEA')
  const { cart, skipped } = s.orders.reorder(o.id)
  assert.deepEqual(lines(cart), [['MUG', 1, 12000]])
  assert.deepEqual(skipped.map((x) => x.sku), ['TEA'])
})

test('담은 카트로 바로 주문할 수 있고, 다시 담기는 재고를 잡지 않는다', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['PEN', 1]])
  const { cart } = s.orders.reorder(o.id)
  assert.equal(s.catalog.get('MUG').stock, 49)
  const again = s.orders.placeOrder({ customerId: 'c-1', cart })
  assert.equal(again.itemsTotal, 14000)
})
