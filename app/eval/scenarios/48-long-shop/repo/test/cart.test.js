import assert from 'node:assert/strict'
import { test } from 'node:test'
import { errorCode, setup } from './helpers.js'

test('같은 상품은 한 줄로 모은다', () => {
  const shop = setup()
  const cart = shop.newCart().add('MUG').add('MUG', 2).add('TEA')
  assert.deepEqual(cart.lines().map((l) => [l.sku, l.qty]), [['MUG', 3], ['TEA', 1]])
  assert.equal(cart.subtotal(), 66000)
})

test('담을 때의 가격을 적어 둔다', () => {
  const shop = setup()
  const cart = shop.newCart().add('MUG')
  shop.catalog.setPrice('MUG', 15000)
  assert.equal(cart.lines()[0].price, 12000)
})

test('수량 바꾸기와 빼기', () => {
  const shop = setup()
  const cart = shop.newCart().add('MUG', 2).add('BAG')
  cart.setQty('MUG', 5).remove('BAG')
  assert.deepEqual(cart.lines().map((l) => [l.sku, l.qty]), [['MUG', 5]])
  cart.setQty('MUG', 0)
  assert.equal(cart.isEmpty(), true)
  assert.throws(() => cart.setQty('TEA', 1), errorCode('NOT_IN_CART'))
  assert.throws(() => cart.add('MUG', 0), errorCode('BAD_QTY'))
})

test('판매 중지된 상품은 담을 수 없다', () => {
  const shop = setup()
  shop.catalog.discontinue('BAG')
  assert.throws(() => shop.newCart().add('BAG'), errorCode('DISCONTINUED'))
})
