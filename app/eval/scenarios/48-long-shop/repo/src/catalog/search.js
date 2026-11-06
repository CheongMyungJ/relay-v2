// 상품 찾기: 이름의 낱말, 분류, 가격 범위, 차례, 쪽 나누기.
import { fail } from '../shared/errors.js'

const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name, 'ko'),
  price: (a, b) => a.price - b.price || a.sku.localeCompare(b.sku),
  '-price': (a, b) => b.price - a.price || a.sku.localeCompare(b.sku),
}

/**
 * @param {ReturnType<import('./products.js').createCatalog>} catalog
 * @param {{ text?: string, category?: string, minPrice?: number, maxPrice?: number, inStock?: boolean, sort?: string, page?: number, perPage?: number }} q
 */
export function searchProducts(catalog, q = {}) {
  const { text = '', category, minPrice = 0, maxPrice = Infinity, inStock = false, sort = 'name', page = 1, perPage = 20 } = q
  if (!SORTS[sort]) fail('BAD_REQUEST', `차례: ${sort}`)
  if (minPrice > maxPrice) fail('BAD_REQUEST', `가격 범위: ${minPrice} > ${maxPrice}`)
  if (!Number.isInteger(page) || page < 1) fail('BAD_REQUEST', `쪽: ${page}`)
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const all = catalog
    .list({ category })
    .filter((p) => p.price >= minPrice && p.price <= maxPrice)
    .filter((p) => !inStock || p.stock > 0)
    .filter((p) => words.every((w) => p.name.toLowerCase().includes(w) || p.sku.toLowerCase() === w))
    .sort(SORTS[sort])
  const start = (page - 1) * perPage
  return {
    total: all.length,
    page,
    pages: Math.max(1, Math.ceil(all.length / perPage)),
    items: all.slice(start, start + perPage),
  }
}

/** 재고가 threshold 이하인 판매 중 상품(입고 담당자가 본다) */
export function lowStock(catalog, threshold = 5) {
  return catalog
    .list()
    .filter((p) => p.stock <= threshold)
    .sort((a, b) => a.stock - b.stock || a.sku.localeCompare(b.sku))
    .map((p) => ({ sku: p.sku, name: p.name, stock: p.stock }))
}
