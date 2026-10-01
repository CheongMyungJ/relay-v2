import { test } from 'node:test'
import assert from 'node:assert'
import { listProducts } from '../src/products.js'

const ids = (r) => r.items.map((p) => p.id)

test('가격 오름차순. 가격이 같으면 id 오름차순', () => {
  assert.deepStrictEqual(ids(listProducts({ sort: 'price_asc' })), [5, 8, 9, 4, 12])
  assert.deepStrictEqual(ids(listProducts({ sort: 'price_asc', page: 2 })), [7, 1, 6, 11, 3])
})

test('가격 내림차순. 가격이 같아도 id 오름차순', () => {
  assert.deepStrictEqual(ids(listProducts({ sort: 'price_desc' })), [10, 2, 3, 1, 6])
  assert.deepStrictEqual(ids(listProducts({ sort: 'price_desc', page: 2 })), [11, 7, 4, 12, 8])
})

test('필터와 정렬을 함께 쓴다', () => {
  assert.deepStrictEqual(
    ids(listProducts({ minPrice: 9000, maxPrice: 15000, sort: 'price_desc' })),
    [1, 6, 11, 7, 4],
  )
})
