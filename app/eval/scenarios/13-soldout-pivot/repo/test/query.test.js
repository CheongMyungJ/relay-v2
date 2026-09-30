import { test } from 'node:test'
import assert from 'node:assert'
import { isBrowse, parsePriceRange, parseQuery } from '../src/search/query.js'

test('일반 단어와 필터 표기', () => {
  const q = parseQuery('텀블러 brand:스탠리 category:kitchen')
  assert.deepStrictEqual(q.terms, ['텀블러'])
  assert.deepStrictEqual(q.filters, { brand: '스탠리', category: 'kitchen' })
})

test('한글 필터 이름', () => {
  assert.deepStrictEqual(parseQuery('브랜드:킨토 태그:보온').filters, { brand: '킨토', tag: '보온' })
})

test('가격 범위', () => {
  assert.deepStrictEqual(parsePriceRange('10000-30000'), { minPrice: 10000, maxPrice: 30000 })
  assert.deepStrictEqual(parsePriceRange('1만-3만'), { minPrice: 10000, maxPrice: 30000 })
  assert.deepStrictEqual(parsePriceRange('<30000'), { maxPrice: 30000 })
  assert.deepStrictEqual(parsePriceRange('>1만'), { minPrice: 10000 })
  assert.deepStrictEqual(parsePriceRange('10000-'), { minPrice: 10000 })
  assert.strictEqual(parsePriceRange('싸게'), null)
  assert.deepStrictEqual(parseQuery('머그 price:<30000').filters, { maxPrice: 30000 })
})

test('뺄 단어, 초성, 따옴표 구절', () => {
  const q = parseQuery('스탠리 -캠핑 ㅌㅂㄹ "클래식 텀블러"')
  assert.deepStrictEqual(q.excluded, ['캠핑'])
  assert.deepStrictEqual(q.initials, ['ㅌㅂㄹ'])
  assert.deepStrictEqual(q.phrases, ['클래식 텀블러'])
  assert.deepStrictEqual(q.terms, ['스탠리', '클래식', '텀블러'])
})

test('빈 검색어는 둘러보기', () => {
  assert.ok(isBrowse(parseQuery('')))
  assert.ok(isBrowse(parseQuery('brand:스탠리')))
  assert.ok(!isBrowse(parseQuery('머그')))
})
