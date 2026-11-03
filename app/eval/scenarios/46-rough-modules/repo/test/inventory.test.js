import { test } from 'node:test'
import assert from 'node:assert'
import { find } from '../src/inventory.js'

test('찾기', () => {
  assert.deepStrictEqual(find([{ sku: 'A', name: '사과', qty: 3 }], 'A'), { sku: 'A', name: '사과', qty: 3 })
  assert.strictEqual(find([], 'A'), null)
})
