import { test } from 'node:test'
import assert from 'node:assert'
import { createSearch } from '../src/search/engine.js'
import { SAMPLE_PRODUCTS } from '../src/catalog/sample.js'
import { allPages, IN_STOCK, LANTERNS, SOLD_OUT } from './fixture.js'

test('품절은 결과에 남고, 모든 쪽에 걸쳐 재고 상품 뒤에 온다', () => {
  const engine = createSearch(LANTERNS)
  for (const pageSize of [4, 3]) {
    const ids = allPages(engine, '랜턴', pageSize)
    assert.strictEqual(ids.length, 10, `pageSize=${pageSize}: 품절도 결과에 있어야 한다`)
    for (const id of SOLD_OUT) assert.ok(ids.includes(id), `품절 ${id}가 결과에 없다`)
    assert.deepStrictEqual(ids.slice(0, IN_STOCK.length).sort(), [...IN_STOCK].sort(), `pageSize=${pageSize}: ${ids.join(' ')}`)
  }
  const page1 = engine.search('랜턴', { page: 1, pageSize: 4 })
  assert.strictEqual(page1.total, 10)
  assert.deepStrictEqual(page1.items.map((i) => i.id), ['L01', 'L03', 'L04', 'L05'])
  const page2 = engine.search('랜턴', { page: 2, pageSize: 4 })
  assert.deepStrictEqual(page2.items.map((i) => i.id).slice(0, 3), ['L07', 'L08', 'L10'])
})

test('예제 상품: 텀블러 검색에서 품절이 쪽을 넘겨도 앞에 섞이지 않는다', () => {
  const engine = createSearch(SAMPLE_PRODUCTS)
  const ids = allPages(engine, '텀블러', 3)
  assert.strictEqual(ids.length, 7)
  assert.deepStrictEqual(ids.slice(-2).sort(), ['tb-001', 'tb-005'])
  const first = engine.search('텀블러', { page: 1, pageSize: 3 })
  assert.ok(first.items.every((i) => !i.soldOut), first.items.map((i) => i.id).join(' '))
})
