import { test } from 'node:test'
import assert from 'node:assert'
import { pageCount, paginate } from '../src/page.js'

const items = Array.from({ length: 25 }, (_, i) => i + 1)

test('쪽 나누기', () => {
  assert.deepStrictEqual(paginate(items, 1, 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.deepStrictEqual(paginate(items, 3, 10), [21, 22, 23, 24, 25])
  assert.deepStrictEqual(paginate(items, 4, 10), [])
})

test('쪽 수', () => {
  assert.strictEqual(pageCount(25, 10), 3)
  assert.strictEqual(pageCount(20, 10), 2)
  assert.strictEqual(pageCount(0, 10), 0)
  assert.strictEqual(pageCount(1, 10), 1)
})
