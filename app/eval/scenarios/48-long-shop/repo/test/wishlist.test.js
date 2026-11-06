import assert from 'node:assert/strict'
import { test } from 'node:test'
import { errorCode, setup } from './helpers.js'

test('찜하고 빼기', () => {
  const shop = setup()
  assert.equal(shop.wishlist.add('u-1', 'TEA'), true)
  assert.equal(shop.wishlist.add('u-1', 'TEA'), false)
  shop.wishlist.add('u-1', 'BAG')
  assert.equal(shop.wishlist.remove('u-1', 'TEA'), true)
  assert.deepEqual(shop.wishlist.list('u-1').map((x) => x.sku), ['BAG'])
  assert.throws(() => shop.wishlist.add('u-1', 'NOPE'), errorCode('NOT_FOUND'))
})

test('판매 중지나 품절은 담을 수 없다고 보인다', () => {
  const shop = setup()
  shop.wishlist.add('u-1', 'TEA')
  shop.wishlist.add('u-1', 'BAG')
  shop.catalog.discontinue('TEA')
  shop.catalog.reserve('BAG', 3)
  assert.deepEqual(shop.wishlist.list('u-1').map((x) => x.available), [false, false])
})
