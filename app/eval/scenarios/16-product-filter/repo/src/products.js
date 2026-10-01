import { PRODUCTS } from './data.js'

export const PAGE_SIZE = 5

// 상품 목록 한 쪽. total은 전체 개수다
export function listProducts({ page = 1 } = {}) {
  if (!Number.isInteger(page) || page < 1) throw new RangeError('page는 1 이상의 정수')
  const start = (page - 1) * PAGE_SIZE
  return { page, total: PRODUCTS.length, items: PRODUCTS.slice(start, start + PAGE_SIZE) }
}

export function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id) ?? null
}
