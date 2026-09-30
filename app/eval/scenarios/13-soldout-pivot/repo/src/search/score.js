// 점수 계산: 필드 가중치를 준 BM25에 인기도 가산점을 더한다.

import { expandTerms } from '../text/synonyms.js'
import { round } from '../util/number.js'
import { isBrowse } from './query.js'

export function inverseDocFrequency(total, df) {
  return Math.log(1 + (total - df + 0.5) / (df + 0.5))
}

function termScore(index, id, term, config) {
  const byDoc = index.postings.get(term)
  const tf = byDoc?.get(id)
  if (!tf) return 0
  const { k1, b } = config.bm25
  const idf = inverseDocFrequency(index.size, byDoc.size)
  const lengths = index.lengths.get(id)
  let sum = 0
  for (const [field, count] of Object.entries(tf)) {
    const avg = index.avgLength[field] || 1
    const norm = (count * (k1 + 1)) / (count + k1 * (1 - b + (b * lengths[field]) / avg))
    sum += (config.fieldWeights[field] ?? 0) * idf * norm
  }
  return sum
}

export function popularityBoost(product, config) {
  return config.popularityWeight * Math.log1p(product.popularity)
}

export function scoreDoc(index, id, parsed, config) {
  const product = index.docs.get(id)
  let text = 0
  if (!isBrowse(parsed)) {
    for (const { term, weight } of expandTerms(parsed.terms, { enabled: config.synonyms, weight: config.synonymWeight })) {
      text += weight * termScore(index, id, term, config)
    }
  }
  return round(text + popularityBoost(product, config))
}

// [{ id, product, score }]
export function scoreHits(index, ids, parsed, config) {
  return ids.map((id) => ({ id, product: index.docs.get(id), score: scoreDoc(index, id, parsed, config) }))
}

// 점수가 어떻게 나왔는지(디버깅용)
export function explainScore(index, id, parsed, config) {
  const parts = expandTerms(parsed.terms, { enabled: config.synonyms, weight: config.synonymWeight })
    .map(({ term, weight }) => ({ term, weight, score: round(weight * termScore(index, id, term, config)) }))
    .filter((p) => p.score > 0)
  return { id, parts, popularity: round(popularityBoost(index.docs.get(id), config)), total: scoreDoc(index, id, parsed, config) }
}
