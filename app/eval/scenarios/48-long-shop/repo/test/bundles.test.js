import assert from 'node:assert/strict'
import { test } from 'node:test'
import { errorCode, setup } from './helpers.js'

test('묶음 가격은 할인 뒤 100원 단위 내림, 재고는 만들 수 있는 수', () => {
  const shop = setup()
  const gift = shop.bundles.define({ sku: 'GIFT', name: '선물 세트', items: [{ sku: 'MUG', qty: 2 }, { sku: 'TEA', qty: 1 }], discountPct: 7 })
  assert.equal(gift.price, 50200) // 54,000 × 0.93 = 50,220
  assert.equal(shop.catalog.get('GIFT').stock, 10)
  assert.equal(shop.catalog.get('GIFT').weightG, 1600)
})

test('면세 상품은 묶지 않는다', () => {
  const shop = setup()
  assert.throws(
    () => shop.bundles.define({ sku: 'X', name: 'x', items: [{ sku: 'MUG', qty: 1 }, { sku: 'RICE', qty: 1 }] }),
    errorCode('BAD_BUNDLE'),
  )
  assert.throws(() => shop.bundles.define({ sku: 'Y', name: 'y', items: [{ sku: 'MUG', qty: 1 }] }), errorCode('BAD_BUNDLE'))
})

test('구성 상품이 바뀌면 다시 셈', () => {
  const shop = setup()
  shop.bundles.define({ sku: 'GIFT', name: '선물 세트', items: [{ sku: 'MUG', qty: 1 }, { sku: 'BAG', qty: 1 }] })
  shop.catalog.setPrice('BAG', 9000)
  shop.catalog.discontinue('MUG')
  const p = shop.bundles.refresh('GIFT')
  assert.equal(p.price, 18900)
  assert.equal(p.active, false)
})

test('묶음 만들기', () => {
  const shop = setup()
  shop.bundles.define({ sku: 'GIFT', name: '선물 세트', items: [{ sku: 'MUG', qty: 1 }, { sku: 'BAG', qty: 1 }] })
  shop.bundles.assemble('GIFT', 2)
  assert.equal(shop.catalog.get('BAG').stock, 1)
  assert.equal(shop.catalog.get('GIFT').stock, 3)
})
