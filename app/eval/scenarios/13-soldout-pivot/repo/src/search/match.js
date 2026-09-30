// 검색어에 맞는 상품 고르기. 단어는 모두 들어 있어야 한다(AND).
// 단어 하나는 그 동의어 가운데 하나만 들어 있어도 된다.

import { normalize } from '../text/normalize.js'
import { synonymsOf } from '../text/synonyms.js'
import { isBrowse } from './query.js'

function idsForTerm(index, term, useSynonyms) {
  const ids = new Set(index.postings.get(term)?.keys() ?? [])
  if (useSynonyms) {
    for (const syn of synonymsOf(term)) {
      for (const id of index.postings.get(syn)?.keys() ?? []) ids.add(id)
    }
  }
  return ids
}

function intersect(a, b) {
  const out = new Set()
  for (const x of a) if (b.has(x)) out.add(x)
  return out
}

// 색인에 들어온 순서를 지킨 상품 id 목록
export function matchDocs(index, parsed, { synonyms = true } = {}) {
  let candidates = isBrowse(parsed) ? new Set(index.docs.keys()) : null

  for (const term of parsed.terms) {
    const ids = idsForTerm(index, term, synonyms)
    candidates = candidates ? intersect(candidates, ids) : ids
  }
  for (const word of parsed.initials) {
    const ids = new Set([...index.docs.keys()].filter((id) => index.initials.get(id).includes(word)))
    candidates = candidates ? intersect(candidates, ids) : ids
  }
  for (const phrase of parsed.phrases ?? []) {
    for (const id of candidates) {
      const p = index.docs.get(id)
      if (!normalize(p.name).includes(phrase) && !normalize(p.description).includes(phrase)) candidates.delete(id)
    }
  }
  for (const term of parsed.excluded) {
    for (const id of index.postings.get(term)?.keys() ?? []) candidates.delete(id)
  }
  return [...index.docs.keys()].filter((id) => candidates.has(id))
}
