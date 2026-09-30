import { test } from 'node:test'
import assert from 'node:assert'
import { categoryPath, categoryText, isInCategory } from '../src/catalog/categories.js'
import { normalizeProduct, validateCatalog } from '../src/catalog/product.js'
import { isLowStock, isSoldOut, stockLabel } from '../src/catalog/stock.js'
import { resolveConfig } from '../src/config.js'

test('상품 정리', () => {
  const p = normalizeProduct({ id: 7, name: '머그', price: '12,000원' })
  assert.deepStrictEqual([p.id, p.price, p.listPrice, p.stock, p.category, p.popularity], ['7', 12000, 12000, null, 'etc', 0])
  assert.throws(() => normalizeProduct({ name: 'x', price: 1 }), /id/)
  assert.throws(() => normalizeProduct({ id: 'x', price: '공짜' }), /가격/)
})

test('상품 목록 점검', () => {
  const problems = validateCatalog([
    { id: 'a', name: 'A', price: 1000 },
    { id: 'a', name: 'A2', price: 1000 },
    { id: 'b', name: ' ', price: 2000, listPrice: 1000 },
    { name: 'no id', price: 1 },
  ])
  assert.deepStrictEqual(problems.map((p) => p.problem), ['id가 겹친다', '이름이 없다', '판매가가 정가보다 비싸다', '상품 id가 없다'])
})

test('재고 상태', () => {
  assert.ok(isSoldOut({ stock: 0 }))
  assert.ok(isSoldOut({ stock: -2 }))
  assert.ok(!isSoldOut({ stock: null }))
  assert.ok(isLowStock({ stock: 3 }))
  assert.strictEqual(stockLabel({ stock: 0, restockAt: '10-15' }), '품절 (10-15 재입고)')
  assert.strictEqual(stockLabel({ stock: 50 }), '')
})

test('분류', () => {
  assert.deepStrictEqual(categoryPath('kitchen/tumbler'), ['kitchen', 'kitchen/tumbler'])
  assert.strictEqual(categoryText('kitchen/tumbler'), '주방 텀블러')
  assert.ok(isInCategory('kitchen/tumbler', 'kitchen'))
  assert.ok(!isInCategory('kitchenware', 'kitchen'))
})

test('설정 합치기', () => {
  const c = resolveConfig({ fieldWeights: { name: 5 }, pageSize: 500 })
  assert.strictEqual(c.fieldWeights.name, 5)
  assert.strictEqual(c.fieldWeights.brand, 2)
  assert.strictEqual(c.pageSize, 100)
  assert.throws(() => resolveConfig({ fieldWeights: { name: -1 } }), RangeError)
})
