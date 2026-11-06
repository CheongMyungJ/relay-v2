import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lowStock, searchProducts } from '../src/catalog/search.js'
import { errorCode, setup } from './helpers.js'

test('낱말과 분류로 찾는다', () => {
  const { catalog } = setup()
  assert.deepEqual(searchProducts(catalog, { text: '세트' }).items.map((p) => p.sku), ['TEA'])
  assert.deepEqual(searchProducts(catalog, { category: 'food', sort: 'price' }).items.map((p) => p.sku), ['TEA', 'RICE'])
  assert.deepEqual(searchProducts(catalog, { text: 'mug' }).items.map((p) => p.sku), ['MUG'])
})

test('가격 범위, 재고, 차례', () => {
  const { catalog } = setup()
  catalog.reserve('BAG', 3)
  const r = searchProducts(catalog, { minPrice: 8000, maxPrice: 30000, sort: '-price' })
  assert.deepEqual(r.items.map((p) => p.sku), ['TEA', 'MUG', 'BAG'])
  assert.deepEqual(searchProducts(catalog, { inStock: true, sort: 'price' }).items.map((p) => p.sku), ['MUG', 'TEA', 'RICE'])
  assert.throws(() => searchProducts(catalog, { sort: 'weight' }), errorCode('BAD_REQUEST'))
  assert.throws(() => searchProducts(catalog, { minPrice: 10, maxPrice: 1 }), errorCode('BAD_REQUEST'))
})

test('쪽 나누기', () => {
  const { catalog } = setup()
  const r = searchProducts(catalog, { sort: 'price', perPage: 3, page: 2 })
  assert.equal(r.total, 4)
  assert.equal(r.pages, 2)
  assert.deepEqual(r.items.map((p) => p.sku), ['RICE'])
})

test('재고가 적은 상품', () => {
  const { catalog } = setup()
  catalog.reserve('MUG', 17)
  assert.deepEqual(lowStock(catalog).map((p) => [p.sku, p.stock]), [['MUG', 3], ['BAG', 3]].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])))
})
