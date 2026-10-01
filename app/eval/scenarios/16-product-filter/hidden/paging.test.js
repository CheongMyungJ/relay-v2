import { test } from 'node:test'
import assert from 'node:assert'
import { listProducts } from '../src/products.js'

test('page만 넘기면 결과가 지금과 같다', () => {
  assert.deepStrictEqual(listProducts({ page: 1 }), {
    page: 1,
    total: 12,
    items: [
      { id: 7, name: '머그컵', price: 12000, category: 'kitchen' },
      { id: 3, name: '텀블러', price: 18000, category: 'kitchen' },
      { id: 12, name: '수건', price: 9000, category: 'bath' },
      { id: 1, name: '에코백', price: 15000, category: 'bag' },
      { id: 9, name: '양말', price: 5000, category: 'wear' },
    ],
  })
  assert.deepStrictEqual(
    listProducts({ page: 3 }).items.map((p) => p.id),
    [10, 5],
  )
  assert.throws(() => listProducts({ page: 0 }), RangeError)
})
