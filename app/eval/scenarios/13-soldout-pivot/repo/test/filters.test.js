import { test } from 'node:test'
import assert from 'node:assert'
import { normalizeCatalog } from '../src/catalog/product.js'
import { applyFilters, describeFilters, facetCounts, mergeFilters } from '../src/search/filters.js'

const hits = normalizeCatalog([
  { id: 'a', name: 'A', brand: '스탠리', category: 'kitchen/tumbler', tags: ['보온'], price: 45000, stock: 3 },
  { id: 'b', name: 'B', brand: '써모스', category: 'kitchen/tumbler', tags: ['슬림'], price: 29000, stock: 0 },
  { id: 'c', name: 'C', brand: 'Stanley', category: 'outdoor/bottle', tags: ['보온'], price: 9000, stock: null },
]).map((product) => ({ id: product.id, product, score: 1 }))
const ids = (list) => list.map((h) => h.id)

test('브랜드와 분류', () => {
  assert.deepStrictEqual(ids(applyFilters(hits, { brand: '스탠리' })), ['a'])
  assert.deepStrictEqual(ids(applyFilters(hits, { brand: 'STANLEY' })), ['c'])
  assert.deepStrictEqual(ids(applyFilters(hits, { category: 'kitchen' })), ['a', 'b'])
  assert.deepStrictEqual(ids(applyFilters(hits, { category: 'kitchen/tumbler/' })), ['a', 'b'])
})

test('가격과 태그', () => {
  assert.deepStrictEqual(ids(applyFilters(hits, { minPrice: 10000, maxPrice: 30000 })), ['b'])
  assert.deepStrictEqual(ids(applyFilters(hits, { tag: '보온' })), ['a', 'c'])
})

test('재고 있는 상품만: 재고 관리 안 하는 상품은 남긴다', () => {
  assert.deepStrictEqual(ids(applyFilters(hits, { inStock: true })), ['a', 'c'])
})

test('필터가 없으면 그대로', () => {
  assert.strictEqual(applyFilters(hits, {}), hits)
})

test('필터 합치기와 설명', () => {
  assert.deepStrictEqual(mergeFilters({ brand: 'x', tag: 't' }, { brand: 'y', tag: undefined }), { brand: 'y', tag: 't' })
  assert.deepStrictEqual(describeFilters({ brand: '스탠리', maxPrice: 30000 }), ['브랜드 스탠리', '가격 ~30000'])
})

test('분면 개수', () => {
  const f = facetCounts(hits)
  assert.deepStrictEqual(f.category, [{ value: 'kitchen', count: 2 }, { value: 'outdoor', count: 1 }])
  assert.deepStrictEqual(f.price.map((b) => b.value), ['1만원 미만', '1만~3만원', '3만~10만원'])
})
