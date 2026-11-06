import assert from 'node:assert/strict'
import { test } from 'node:test'
import { errorCode, setup } from './helpers.js'

test('상품을 더하고 읽는다', () => {
  const shop = setup()
  assert.equal(shop.catalog.get('MUG').price, 12000)
  assert.equal(shop.catalog.find('NOPE'), null)
  assert.throws(() => shop.catalog.get('NOPE'), errorCode('NOT_FOUND'))
  assert.throws(() => shop.catalog.add({ sku: 'MUG', name: 'x', price: 1 }), errorCode('DUPLICATE_SKU'))
  assert.throws(() => shop.catalog.add({ sku: 'X', name: 'x', price: -1 }), errorCode('BAD_PRODUCT'))
  assert.throws(() => shop.catalog.add({ sku: 'Y', name: 'y', price: 1, taxClass: 'zero' }), errorCode('BAD_PRODUCT'))
})

test('분류와 판매 중지', () => {
  const shop = setup()
  assert.deepEqual(shop.catalog.list({ category: 'food' }).map((p) => p.sku), ['TEA', 'RICE'])
  shop.catalog.discontinue('TEA')
  assert.deepEqual(shop.catalog.list({ category: 'food' }).map((p) => p.sku), ['RICE'])
  assert.equal(shop.catalog.list({ activeOnly: false }).length, 4)
})

test('재고 잡기와 풀기', () => {
  const shop = setup()
  shop.catalog.reserve('BAG', 2)
  assert.equal(shop.catalog.get('BAG').stock, 1)
  assert.throws(() => shop.catalog.reserve('BAG', 2), errorCode('OUT_OF_STOCK'))
  shop.catalog.release('BAG', 2)
  shop.catalog.restock('BAG', 4)
  assert.equal(shop.catalog.get('BAG').stock, 7)
  assert.throws(() => shop.catalog.restock('BAG', 0), errorCode('BAD_QTY'))
})

test('가격 바꾸기', () => {
  const shop = setup()
  shop.catalog.setPrice('MUG', 13000)
  assert.equal(shop.catalog.get('MUG').price, 13000)
  assert.throws(() => shop.catalog.setPrice('MUG', 1.5), errorCode('BAD_PRODUCT'))
})

test('쿠폰 할인', () => {
  const shop = setup()
  assert.deepEqual(shop.coupons.discountFor('WELCOME', 2000), { code: 'WELCOME', discount: 2000 })
  assert.deepEqual(shop.coupons.discountFor('PCT10', 33333), { code: 'PCT10', discount: 3333 })
  assert.throws(() => shop.coupons.discountFor('PCT10', 19999), errorCode('COUPON_MIN'))
  assert.throws(() => shop.coupons.discountFor('NONE', 10000), errorCode('COUPON_NOT_FOUND'))
  shop.coupons.add({ code: 'OLD', kind: 'fixed', value: 1000, expiresAt: '2026-03-01T00:00:00Z' })
  assert.throws(() => shop.coupons.discountFor('OLD', 10000), errorCode('COUPON_EXPIRED'))
})
