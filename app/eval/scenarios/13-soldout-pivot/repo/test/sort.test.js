import { test } from 'node:test'
import assert from 'node:assert'
import { SORTS, isSort, sortHits } from '../src/search/sort.js'

const hit = (id, score, price, createdAt, popularity) => ({ id, score, product: { id, price, createdAt, popularity, stock: 10 } })
const hits = [
  hit('c', 3, 30000, '2026-01-01', 5),
  hit('a', 5, 10000, '2026-03-01', 1),
  hit('b', 5, 20000, '2025-12-01', 9),
  hit('d', 1, 20000, '2026-02-01', 9),
]
const ids = (list) => list.map((h) => h.id)

test('관련도: 점수 높은 순, 같으면 id 순', () => {
  assert.deepStrictEqual(ids(sortHits(hits)), ['a', 'b', 'c', 'd'])
})

test('가격, 최신, 인기', () => {
  assert.deepStrictEqual(ids(sortHits(hits, 'price_asc')), ['a', 'b', 'd', 'c'])
  assert.deepStrictEqual(ids(sortHits(hits, 'price_desc')), ['c', 'b', 'd', 'a'])
  assert.deepStrictEqual(ids(sortHits(hits, 'newest')), ['a', 'd', 'c', 'b'])
  assert.deepStrictEqual(ids(sortHits(hits, 'popular')), ['b', 'd', 'c', 'a'])
})

test('원본 배열은 바꾸지 않는다', () => {
  const before = ids(hits)
  sortHits(hits, 'price_asc')
  assert.deepStrictEqual(ids(hits), before)
})

test('모르는 정렬', () => {
  assert.throws(() => sortHits(hits, 'random'), RangeError)
  assert.ok(isSort('newest'))
  assert.ok(!isSort('toString'))
  assert.strictEqual(SORTS.length, 5)
})
