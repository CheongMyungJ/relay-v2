import { test } from 'node:test'
import assert from 'node:assert'
import { listProducts } from '../src/products.js'

const ids = (r) => r.items.map((p) => p.id)

test('가격 범위는 양 끝을 포함한다', () => {
  const r = listProducts({ minPrice: 9000, maxPrice: 15000 })
  assert.strictEqual(r.total, 6)
  assert.deepStrictEqual(ids(r), [7, 12, 1, 4, 11])
  assert.deepStrictEqual(ids(listProducts({ minPrice: 9000, maxPrice: 15000, page: 2 })), [6])
})

test('한쪽 끝만 줄 수 있다', () => {
  assert.strictEqual(listProducts({ minPrice: 20000 }).total, 2)
  assert.deepStrictEqual(ids(listProducts({ maxPrice: 5000 })), [9, 8, 5])
})

test('맞는 상품이 없으면 빈 목록', () => {
  const r = listProducts({ minPrice: 100000 })
  assert.strictEqual(r.total, 0)
  assert.deepStrictEqual(r.items, [])
})
