import { test } from 'node:test'
import assert from 'node:assert'
import { createRecommender, SAMPLE_ORDERS, SAMPLE_PRODUCTS } from '../src/index.js'
import { buildCooccurrence, topCooccurring, trending } from '../src/recommend/cooccur.js'
import { createRecentlyViewed } from '../src/recommend/recent.js'
import { jaccard } from '../src/recommend/similar.js'

test('함께 산 횟수', () => {
  const m = buildCooccurrence([['a', 'b'], ['a', 'b', 'c'], ['a', 'a', 'c']])
  assert.deepStrictEqual(topCooccurring(m, 'a'), [{ id: 'b', count: 2 }, { id: 'c', count: 2 }])
  assert.deepStrictEqual(topCooccurring(m, 'z'), [])
})

test('자카드 유사도', () => {
  assert.strictEqual(jaccard(['a', 'b'], ['b', 'c']), 1 / 3)
  assert.strictEqual(jaccard([], []), 0)
})

test('상품 추천은 품절을 뺀다', () => {
  const rec = createRecommender({ products: SAMPLE_PRODUCTS, orders: SAMPLE_ORDERS })
  const out = rec.forProduct('cp-001')
  assert.ok(!out.includes('cp-002'))
  assert.ok(!out.includes('mg-002'))
  assert.strictEqual(out[0], 'bt-001')
  assert.strictEqual(out.length, 4)
})

test('장바구니 추천', () => {
  const rec = createRecommender({ products: SAMPLE_PRODUCTS, orders: SAMPLE_ORDERS })
  assert.deepStrictEqual(rec.forCart(['sh-001', 'sh-002']), ['tp-001'])
})

test('많이 팔린 상품', () => {
  assert.deepStrictEqual(trending(SAMPLE_ORDERS, { n: 2 }), [{ id: 'cp-001', count: 3 }, { id: 'cp-002', count: 2 }])
  const rec = createRecommender({ products: SAMPLE_PRODUCTS, orders: SAMPLE_ORDERS })
  assert.deepStrictEqual(rec.popular(2), ['cp-001', 'tb-002'])
})

test('최근 본 상품', () => {
  const r = createRecentlyViewed(3)
  for (const id of ['a', 'b', 'c', 'a', 'd']) r.view(id)
  assert.deepStrictEqual(r.list(), ['d', 'a', 'c'])
  assert.throws(() => createRecentlyViewed(0), RangeError)
})
