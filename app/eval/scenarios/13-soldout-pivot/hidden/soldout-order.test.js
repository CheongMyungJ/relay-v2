import { test } from 'node:test'
import assert from 'node:assert'
import { createSearch } from '../src/search/engine.js'
import { SAMPLE_PRODUCTS } from '../src/catalog/sample.js'
import { allPages, LANTERNS, SOLD_OUT } from './fixture.js'

test('맨 뒤로 간 품절끼리는 점수 순서를 지킨다', () => {
  const engine = createSearch(LANTERNS)
  for (const pageSize of [4, 3, 10]) {
    const ids = allPages(engine, '랜턴', pageSize)
    assert.deepStrictEqual(ids.slice(-SOLD_OUT.length), SOLD_OUT, `pageSize=${pageSize}: ${ids.join(' ')}`)
  }
})

test('예제 상품: 품절 텀블러끼리 점수 순', () => {
  const engine = createSearch(SAMPLE_PRODUCTS)
  const ids = allPages(engine, '텀블러', 3)
  assert.deepStrictEqual(ids.slice(-2), ['tb-005', 'tb-001'])
})
