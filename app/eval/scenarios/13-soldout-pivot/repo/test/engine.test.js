import { test } from 'node:test'
import assert from 'node:assert'
import { createSearch, SAMPLE_PRODUCTS } from '../src/index.js'
import { createLogger } from '../src/log/logger.js'
import { memorySink } from '../src/log/sinks.js'

const engine = createSearch(SAMPLE_PRODUCTS)
const ids = (result) => result.items.map((i) => i.id)

test('결과 모양', () => {
  const r = engine.search('이어폰 price:<100000')
  assert.deepStrictEqual(ids(r), ['au-002'])
  const [item] = r.items
  assert.strictEqual(item.priceText, '19,900원')
  assert.strictEqual(item.nameHtml, 'QCY 무선 <em>이어폰</em> T13')
  assert.strictEqual(item.soldOut, false)
  assert.deepStrictEqual([r.page, r.total, r.totalPages, r.hasNext], [1, 1, 1, false])
})

test('동의어로 찾은 상품도 결과에 든다', () => {
  const r = engine.search('텀블러', { pageSize: 50 })
  assert.strictEqual(r.total, 7)
  assert.ok(ids(r).includes('bt-002'))
})

test('재고 있는 상품만', () => {
  const r = engine.search('캠핑', { filters: { inStock: true } })
  assert.deepStrictEqual(ids(r), ['cp-001', 'tb-004', 'bt-001'])
  assert.ok(r.items.every((i) => !i.soldOut))
})

test('페이지 나누기', () => {
  const r = engine.search('', { page: 4, pageSize: 5 })
  assert.deepStrictEqual([r.total, r.totalPages, r.items.length, r.hasPrev, r.hasNext], [19, 4, 4, true, false])
  assert.deepStrictEqual(r.items.map((i) => i.position), [16, 17, 18, 19])
})

test('설정의 pageSize가 기본 쪽 크기', () => {
  const small = createSearch(SAMPLE_PRODUCTS, { pageSize: 3 })
  assert.strictEqual(small.search('').items.length, 3)
  assert.throws(() => createSearch(SAMPLE_PRODUCTS, { pageSize: 0 }), RangeError)
})

test('가격 순 정렬', () => {
  const r = engine.search('category:kitchen/tumbler', { sort: 'price_asc', filters: { inStock: true } })
  assert.deepStrictEqual(ids(r), ['tb-003', 'tb-002', 'tb-004'])
})

test('배지', () => {
  const [classic] = engine.search('"클래식 텀블러"').items
  assert.deepStrictEqual(classic.badges, ['품절 (10-15 재입고)', '13% 할인'])
  assert.strictEqual(classic.soldOut, true)
  const [slim] = engine.search('원터치').items
  assert.deepStrictEqual(slim.badges, ['2개 남음'])
})

test('쪽 훅 더하기', () => {
  const e = createSearch(SAMPLE_PRODUCTS)
  e.use('page', (items) => items.map((i) => ({ ...i, badges: [...i.badges, '무료배송'] })))
  const [item] = e.search('도마').items
  assert.deepStrictEqual(item.badges, ['무료배송'])
  assert.throws(() => e.use('index', () => {}), RangeError)
})

test('분면과 자동 완성', () => {
  const r = engine.search('캠핑', { facets: true })
  assert.deepStrictEqual(r.facets.category, [{ value: 'outdoor', count: 3 }, { value: 'kitchen', count: 2 }])
  assert.deepStrictEqual(engine.suggest('머'), ['머그', '머그컵'])
})

test('검색 로그', () => {
  const sink = memorySink()
  const e = createSearch(SAMPLE_PRODUCTS, { logger: createLogger({ scope: 'search', level: 'debug', sink, now: () => 0 }) })
  e.search('도마 brand:나무공방')
  const lines = sink.lines()
  assert.match(lines[0], /INFO search\.engine: 색인 완료 documents=19/)
  assert.match(lines[1], /DEBUG search\.engine: 검색 query="도마 brand:나무공방" matched=1 filtered=1 filters="브랜드 나무공방" page=1/)
})
