import { test } from 'node:test'
import assert from 'node:assert'
import { getProduct, listProducts } from '../src/products.js'
import { priceText } from '../src/format.js'

test('첫 쪽은 등록 차례로 다섯 개', () => {
  const r = listProducts()
  assert.strictEqual(r.total, 12)
  assert.deepStrictEqual(
    r.items.map((p) => p.id),
    [7, 3, 12, 1, 9],
  )
})

test('잘못된 쪽 번호', () => {
  assert.throws(() => listProducts({ page: 0 }), RangeError)
})

test('상품 하나', () => {
  assert.strictEqual(getProduct(4)?.name, '컵받침')
  assert.strictEqual(getProduct(99), null)
})

test('가격 글', () => {
  assert.strictEqual(priceText(15000), '15,000원')
})
