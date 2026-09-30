// 비슷한 상품: 태그 자카드 유사도에 같은 분류, 같은 브랜드 가산점

import { categoryPath } from '../catalog/categories.js'

export function jaccard(a, b) {
  const A = new Set(a)
  const B = new Set(b)
  if (A.size === 0 && B.size === 0) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / (A.size + B.size - inter)
}

export function similarity(p, q) {
  let s = jaccard(p.tags, q.tags)
  if (p.category === q.category) s += 0.5
  else if (categoryPath(p.category)[0] === categoryPath(q.category)[0]) s += 0.2
  if (p.brand && p.brand === q.brand) s += 0.1
  return s
}

// [{ id, similarity }] 자기 자신과 유사도 0은 뺀다
export function similarProducts(products, id, n = 5) {
  const base = products.find((p) => p.id === id)
  if (!base) return []
  return products
    .filter((p) => p.id !== id)
    .map((p) => ({ id: p.id, similarity: Math.round(similarity(base, p) * 1000) / 1000 }))
    .filter((x) => x.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity || (a.id < b.id ? -1 : 1))
    .slice(0, n)
}
