// 들어온 상품 데이터를 검색 엔진이 쓰는 모양으로 맞춘다.

import { parseKRW } from '../util/money.js'

export function normalizeProduct(raw) {
  if (!raw || typeof raw !== 'object') throw new TypeError('상품은 객체여야 한다')
  if (raw.id == null || raw.id === '') throw new TypeError('상품 id가 없다')
  const price = parseKRW(raw.price)
  if (!Number.isFinite(price) || price < 0) throw new TypeError(`가격을 읽을 수 없다: ${raw.id} ${raw.price}`)
  const listPrice = raw.listPrice != null ? parseKRW(raw.listPrice) : price
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    brand: String(raw.brand ?? ''),
    category: String(raw.category ?? 'etc'),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    description: String(raw.description ?? ''),
    price,
    listPrice: Number.isFinite(listPrice) ? listPrice : price,
    stock: raw.stock == null ? null : Number(raw.stock),
    restockAt: raw.restockAt ?? null,
    popularity: Math.max(0, Number(raw.popularity ?? 0) || 0),
    createdAt: String(raw.createdAt ?? '1970-01-01'),
  }
}

export function normalizeCatalog(rawList) {
  if (!Array.isArray(rawList)) throw new TypeError('상품 목록은 배열이어야 한다')
  return rawList.map(normalizeProduct)
}

// 상품 목록 점검: 겹치는 id, 이름 없는 상품, 정가보다 비싼 판매가를 찾는다.
// 색인 전에 관리 도구에서 돌린다. [{ id, problem }]
export function validateCatalog(rawList) {
  const problems = []
  const seen = new Set()
  for (const raw of rawList) {
    let p
    try {
      p = normalizeProduct(raw)
    } catch (e) {
      problems.push({ id: raw?.id ?? null, problem: e.message })
      continue
    }
    if (seen.has(p.id)) problems.push({ id: p.id, problem: 'id가 겹친다' })
    seen.add(p.id)
    if (!p.name.trim()) problems.push({ id: p.id, problem: '이름이 없다' })
    if (p.listPrice < p.price) problems.push({ id: p.id, problem: '판매가가 정가보다 비싸다' })
    if (p.stock != null && !Number.isFinite(p.stock)) problems.push({ id: p.id, problem: '재고 수가 숫자가 아니다' })
  }
  return problems
}
