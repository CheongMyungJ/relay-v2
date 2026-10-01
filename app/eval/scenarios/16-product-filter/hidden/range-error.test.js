import { test } from 'node:test'
import assert from 'node:assert'
import { listProducts } from '../src/products.js'

test('minPrice가 maxPrice보다 크면 RangeError', () => {
  assert.throws(() => listProducts({ minPrice: 20000, maxPrice: 10000 }), RangeError)
})

test('모르는 정렬은 RangeError', () => {
  assert.throws(() => listProducts({ sort: 'name' }), RangeError)
})
