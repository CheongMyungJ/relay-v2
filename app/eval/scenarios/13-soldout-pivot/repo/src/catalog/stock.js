// 재고 상태. stock이 null이면 재고를 관리하지 않는 상품(디지털 상품권 등)이다.

export const LOW_STOCK = 3

export function isSoldOut(product) {
  return product.stock != null && product.stock <= 0
}

export function isLowStock(product) {
  return product.stock != null && product.stock > 0 && product.stock <= LOW_STOCK
}

// 화면에 붙일 재고 표시
export function stockLabel(product) {
  if (isSoldOut(product)) return product.restockAt ? `품절 (${product.restockAt} 재입고)` : '품절'
  if (isLowStock(product)) return `${product.stock}개 남음`
  return ''
}
