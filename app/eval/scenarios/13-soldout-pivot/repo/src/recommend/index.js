// 추천: 상품 상세의 '함께 산 상품', '비슷한 상품', 장바구니 추천
// 추천은 바로 살 수 있는 상품만 보여 준다(품절 제외).

import { normalizeCatalog } from '../catalog/product.js'
import { isSoldOut } from '../catalog/stock.js'
import { buildCooccurrence, topCooccurring, trending } from './cooccur.js'
import { createRecentlyViewed } from './recent.js'
import { similarProducts } from './similar.js'

export function createRecommender({ products, orders = [], recentLimit = 10 }) {
  const catalog = normalizeCatalog(products)
  const byId = new Map(catalog.map((p) => [p.id, p]))
  const matrix = buildCooccurrence(orders)
  const recent = createRecentlyViewed(recentLimit)
  const available = (id) => byId.has(id) && !isSoldOut(byId.get(id))

  function forProduct(id, n = 4) {
    const out = []
    const seen = new Set([id])
    const push = (x) => {
      if (out.length < n && !seen.has(x) && available(x)) {
        seen.add(x)
        out.push(x)
      }
    }
    for (const x of topCooccurring(matrix, id, n * 2)) push(x.id)
    for (const x of similarProducts(catalog, id, n * 2)) push(x.id)
    return out
  }

  // 장바구니 상품들과 함께 산 횟수를 더해서 고른다
  function forCart(cartIds, n = 4) {
    const counts = new Map()
    for (const id of cartIds) {
      for (const x of topCooccurring(matrix, id, 20)) counts.set(x.id, (counts.get(x.id) ?? 0) + x.count)
    }
    return [...counts.entries()]
      .filter(([id]) => !cartIds.includes(id) && available(id))
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, n)
      .map(([id]) => id)
  }

  // 메인 화면 '요즘 많이 사는 상품'
  function popular(n = 4) {
    return trending(orders, { n: n * 2 })
      .map((x) => x.id)
      .filter(available)
      .slice(0, n)
  }

  return {
    forProduct,
    popular,
    forCart,
    viewed: (id) => recent.view(id),
    recent: () => recent.list().filter((id) => byId.has(id)),
  }
}
