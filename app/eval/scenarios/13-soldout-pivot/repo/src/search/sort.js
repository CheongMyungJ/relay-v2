// 결과 정렬

function byId(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

const COMPARATORS = {
  // 관련도: 점수 높은 순, 같으면 id 순
  relevance: (a, b) => b.score - a.score || byId(a, b),
  price_asc: (a, b) => a.product.price - b.product.price || byId(a, b),
  price_desc: (a, b) => b.product.price - a.product.price || byId(a, b),
  newest: (a, b) => b.product.createdAt.localeCompare(a.product.createdAt) || byId(a, b),
  popular: (a, b) => b.product.popularity - a.product.popularity || byId(a, b),
}

export const SORTS = Object.keys(COMPARATORS)

export function isSort(name) {
  return Object.hasOwn(COMPARATORS, name)
}

// 새 배열을 돌려준다(원본은 그대로)
export function sortHits(hits, sort = 'relevance') {
  const compare = COMPARATORS[sort]
  if (!compare) throw new RangeError(`모르는 정렬: ${sort} (가능: ${SORTS.join(', ')})`)
  return [...hits].sort(compare)
}
