// 필터: 브랜드, 분류, 가격, 태그, 재고
// 검색어의 필터 표기(brand:스탠리)와 search()의 filters 옵션을 합쳐서 쓴다.

import { isInCategory } from '../catalog/categories.js'
import { isSoldOut } from '../catalog/stock.js'
import { normalize } from '../text/normalize.js'

function buildChecks(filters) {
  const checks = []
  if (filters.brand) {
    const brand = normalize(filters.brand)
    checks.push((p) => normalize(p.brand) === brand)
  }
  if (filters.category) {
    checks.push((p) => isInCategory(p.category, filters.category))
  }
  if (filters.minPrice != null) {
    checks.push((p) => p.price >= filters.minPrice)
  }
  if (filters.maxPrice != null) {
    checks.push((p) => p.price <= filters.maxPrice)
  }
  if (filters.tag) {
    const tag = normalize(filters.tag)
    checks.push((p) => p.tags.some((t) => normalize(t) === tag))
  }
  // 목록 화면의 '재고 있는 상품만' 체크박스
  if (filters.inStock) {
    checks.push((p) => !isSoldOut(p))
  }
  return checks
}

export function applyFilters(hits, filters = {}) {
  const checks = buildChecks(filters)
  if (checks.length === 0) return hits
  return hits.filter((hit) => checks.every((check) => check(hit.product)))
}

// 로그와 화면에 쓸 필터 설명
export function describeFilters(filters = {}) {
  const out = []
  if (filters.brand) out.push(`브랜드 ${filters.brand}`)
  if (filters.category) out.push(`분류 ${filters.category}`)
  if (filters.minPrice != null || filters.maxPrice != null) {
    out.push(`가격 ${filters.minPrice ?? ''}~${filters.maxPrice ?? ''}`)
  }
  if (filters.tag) out.push(`태그 ${filters.tag}`)
  if (filters.inStock) out.push('재고 있음')
  return out
}

// 검색어 필터와 옵션 필터를 합친다. 옵션이 이긴다.
export function mergeFilters(fromQuery = {}, fromOptions = {}) {
  const out = { ...fromQuery }
  for (const [k, v] of Object.entries(fromOptions)) if (v !== undefined) out[k] = v
  return out
}

// 분면(facet) 개수: 필터를 건 결과 안에서 브랜드, 분류, 가격대별 상품 수
const PRICE_BANDS = [
  { label: '1만원 미만', max: 9999 },
  { label: '1만~3만원', min: 10000, max: 29999 },
  { label: '3만~10만원', min: 30000, max: 99999 },
  { label: '10만원 이상', min: 100000 },
]

function countBy(hits, keyOf) {
  const counts = new Map()
  for (const hit of hits) {
    const key = keyOf(hit.product)
    if (key == null || key === '') continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1))
}

export function facetCounts(hits) {
  return {
    brand: countBy(hits, (p) => p.brand),
    category: countBy(hits, (p) => p.category.split('/')[0]),
    price: PRICE_BANDS.map((band) => ({
      value: band.label,
      count: hits.filter((h) => h.product.price >= (band.min ?? 0) && h.product.price <= (band.max ?? Infinity)).length,
    })).filter((b) => b.count > 0),
  }
}
