import { test } from 'node:test'
import assert from 'node:assert'
import { normalizeCatalog } from '../src/catalog/product.js'
import { resolveConfig } from '../src/config.js'
import { buildIndex, documentFrequency, indexStats, suggestTerms } from '../src/search/indexer.js'
import { matchDocs } from '../src/search/match.js'
import { parseQuery } from '../src/search/query.js'
import { explainScore, inverseDocFrequency, scoreHits } from '../src/search/score.js'

const products = normalizeCatalog([
  { id: 'a', name: '스탠리 텀블러', brand: '스탠리', category: 'kitchen/tumbler', tags: ['보온'], price: 1000, popularity: 10 },
  { id: 'b', name: '써모스 보온병', brand: '써모스', category: 'outdoor/bottle', tags: ['보온'], price: 2000, popularity: 10 },
  { id: 'c', name: '원목 도마', brand: '나무공방', category: 'kitchen/cookware', price: 3000, popularity: 10, description: '텀블러 받침 대용으로 쓴다' },
  { id: 'd', name: '스탠리 머그', brand: '스탠리', category: 'kitchen/mug', price: 4000, popularity: 10 },
])
const index = buildIndex(products)
const config = resolveConfig()

test('색인 통계와 문서 빈도', () => {
  assert.deepStrictEqual(indexStats(index).documents, 4)
  assert.strictEqual(documentFrequency(index, '스탠리'), 2)
  assert.strictEqual(documentFrequency(index, '주방'), 3)
  assert.strictEqual(documentFrequency(index, '없는말'), 0)
})

test('겹치는 id는 색인하지 않는다', () => {
  assert.throws(() => buildIndex([products[0], products[0]]), /겹친다/)
})

test('단어는 모두 들어 있어야 한다', () => {
  assert.deepStrictEqual(matchDocs(index, parseQuery('스탠리')), ['a', 'd'])
  assert.deepStrictEqual(matchDocs(index, parseQuery('스탠리 머그')), ['d'])
  assert.deepStrictEqual(matchDocs(index, parseQuery('스탠리 -머그')), ['a'])
})

test('동의어로도 찾는다', () => {
  assert.deepStrictEqual(matchDocs(index, parseQuery('텀블러')), ['a', 'b', 'c'])
  assert.deepStrictEqual(matchDocs(index, parseQuery('텀블러'), { synonyms: false }), ['a', 'c'])
})

test('초성과 따옴표 구절', () => {
  assert.deepStrictEqual(matchDocs(index, parseQuery('ㅅㅌㄹ')), ['a', 'd'])
  assert.deepStrictEqual(matchDocs(index, parseQuery('"텀블러 받침"')), ['c'])
})

test('이름에서 찾은 단어가 설명에서 찾은 단어보다 점수가 높다', () => {
  const hits = scoreHits(index, ['a', 'c'], parseQuery('텀블러'), config)
  assert.ok(hits[0].score > hits[1].score)
})

test('드문 단어일수록 idf가 크다', () => {
  assert.ok(inverseDocFrequency(100, 1) > inverseDocFrequency(100, 50))
  const explained = explainScore(index, 'b', parseQuery('텀블러'), config)
  assert.deepStrictEqual(explained.parts.map((p) => p.term), ['보온병'])
})

test('자동 완성', () => {
  assert.deepStrictEqual(suggestTerms(index, '스'), ['스탠리'])
  assert.deepStrictEqual(suggestTerms(index, ''), [])
})
