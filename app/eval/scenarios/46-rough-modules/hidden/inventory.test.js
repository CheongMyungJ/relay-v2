import { test } from 'node:test'
import assert from 'node:assert'
import { lowStock } from '../src/inventory.js'

const items = [
  { sku: 'A', name: '사과', qty: 5 },
  { sku: 'B', name: '배', qty: 2 },
  { sku: 'C', name: '귤', qty: 9 },
  { sku: 'D', name: '감', qty: 2 },
]

test('기준 이하(같은 수량 포함), 수량 오름차순, 같으면 이름 차례', () => {
  assert.deepStrictEqual(lowStock(items).map((i) => i.sku), ['D', 'B', 'A'])
})

test('기준을 바꿀 수 있다', () => {
  assert.deepStrictEqual(lowStock(items, 2).map((i) => i.sku), ['D', 'B'])
})

test('입력 배열을 바꾸지 않는다', () => {
  const copy = items.map((i) => ({ ...i }))
  lowStock(items)
  assert.deepStrictEqual(items, copy)
})
