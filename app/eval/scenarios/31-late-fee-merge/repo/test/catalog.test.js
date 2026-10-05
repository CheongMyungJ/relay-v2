import { test } from 'node:test'
import assert from 'node:assert/strict'
import { searchTools } from '../src/catalog/search.js'
import { getTool, listTools } from '../src/catalog/tools.js'

test('공구 찾기', () => {
  assert.equal(getTool('T-100').name, '전동 드릴')
  assert.throws(() => getTool('T-999'), /찾지 못함/)
  assert.equal(listTools({ category: 'ladder' }).length, 2)
})

test('이름이나 분류로 검색', () => {
  assert.deepEqual(
    searchTools('사다리', { sort: 'price' }).map((t) => t.id),
    ['T-201', 'T-200'],
  )
  assert.ok(searchTools('정원').some((t) => t.id === 'T-301'))
})
