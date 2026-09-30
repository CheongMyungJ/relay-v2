// 역색인 만들기. 단어 → (상품 id → 필드별 등장 횟수)

import { categoryText } from '../catalog/categories.js'
import { toChoseong } from '../text/hangul.js'
import { tokenize } from '../text/tokenize.js'

export const FIELDS = ['name', 'brand', 'tags', 'category', 'description']

function fieldText(product, field) {
  if (field === 'tags') return product.tags.join(' ')
  if (field === 'category') return categoryText(product.category)
  return product[field] ?? ''
}

export function buildIndex(products) {
  const docs = new Map()
  const postings = new Map()
  const lengths = new Map()
  const initials = new Map()
  const totals = Object.fromEntries(FIELDS.map((f) => [f, 0]))

  for (const product of products) {
    if (docs.has(product.id)) throw new Error(`상품 id가 겹친다: ${product.id}`)
    docs.set(product.id, product)
    const len = {}
    for (const field of FIELDS) {
      const tokens = tokenize(fieldText(product, field))
      len[field] = tokens.length
      totals[field] += tokens.length
      for (const token of tokens) {
        let byDoc = postings.get(token)
        if (!byDoc) postings.set(token, (byDoc = new Map()))
        let tf = byDoc.get(product.id)
        if (!tf) byDoc.set(product.id, (tf = {}))
        tf[field] = (tf[field] ?? 0) + 1
      }
    }
    lengths.set(product.id, len)
    initials.set(product.id, toChoseong(product.name.replace(/\s+/g, '')))
  }

  const size = docs.size
  const avgLength = Object.fromEntries(FIELDS.map((f) => [f, size ? totals[f] / size : 0]))
  return { docs, postings, lengths, avgLength, initials, size }
}

// 단어가 든 상품 수
export function documentFrequency(index, term) {
  return index.postings.get(term)?.size ?? 0
}

// 단어가 든 상품 id 목록
export function docsWithTerm(index, term) {
  const byDoc = index.postings.get(term)
  return byDoc ? [...byDoc.keys()] : []
}

// 색인 통계(관리 화면용)
export function indexStats(index) {
  let postingCount = 0
  for (const byDoc of index.postings.values()) postingCount += byDoc.size
  return { documents: index.size, terms: index.postings.size, postings: postingCount }
}

// 자동 완성: prefix로 시작하는 단어를 많이 쓰인 순서로 n개
export function suggestTerms(index, prefix, n = 5) {
  const want = tokenize(prefix, { keepStopwords: true }).at(-1)
  if (!want) return []
  const out = []
  for (const [term, byDoc] of index.postings) {
    if (term.length > want.length && term.startsWith(want)) out.push({ term, docs: byDoc.size })
  }
  return out
    .sort((a, b) => b.docs - a.docs || (a.term < b.term ? -1 : 1))
    .slice(0, n)
    .map((x) => x.term)
}
