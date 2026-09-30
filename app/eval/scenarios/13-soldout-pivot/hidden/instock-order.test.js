import { test } from 'node:test'
import assert from 'node:assert'
import { createSearch } from '../src/search/engine.js'
import { SAMPLE_PRODUCTS } from '../src/catalog/sample.js'
import { allPages, IN_STOCK, LANTERNS } from './fixture.js'

const SAMPLE_SOLD_OUT = new Set(SAMPLE_PRODUCTS.filter((p) => p.stock === 0).map((p) => p.id))
const inStockOnly = (ids) => ids.filter((id) => !SAMPLE_SOLD_OUT.has(id))

test('재고 있는 상품끼리의 순서는 그대로', () => {
  const engine = createSearch(LANTERNS)
  for (const pageSize of [4, 10]) {
    const ids = allPages(engine, '랜턴', pageSize)
    assert.deepStrictEqual(ids.filter((id) => IN_STOCK.includes(id)), IN_STOCK)
  }
})

test('예제 상품: 재고 있는 상품 순서와 품절이 없는 검색 결과는 그대로', () => {
  const engine = createSearch(SAMPLE_PRODUCTS)
  assert.deepStrictEqual(inStockOnly(allPages(engine, '텀블러', 3)), ['tb-003', 'tb-004', 'tb-002', 'bt-002', 'bt-001'])
  assert.deepStrictEqual(allPages(engine, '스니커즈', 1), ['sh-002', 'sh-001'])
  assert.deepStrictEqual(inStockOnly(allPages(engine, '', 5, { sort: 'price_asc' })).slice(0, 6), ['tb-003', 'au-002', 'bt-001', 'mg-001', 'tb-002', 'gc-001'])
})
