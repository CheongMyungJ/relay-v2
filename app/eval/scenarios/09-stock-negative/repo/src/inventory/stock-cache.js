import { HOME_WAREHOUSE } from '../warehouses/registry.js'

export function stockKey(sku, warehouse) {
  return `${sku}:${warehouse}`
}

/**
 * 창고별 재고 레코드 캐시. LRU 위에 키 규칙만 얹는다.
 * 창고를 주지 않으면 본사 창고(서울)로 본다. 값은 복사해서 넣고 꺼낸다.
 */
export function createStockCache(lru) {
  return {
    get(sku, warehouse = HOME_WAREHOUSE) {
      const hit = lru.get(stockKey(sku, warehouse))
      return hit ? { ...hit } : undefined
    },
    set(sku, warehouse, record) {
      lru.set(stockKey(sku, warehouse), { ...record })
    },
    invalidate(sku, warehouse = HOME_WAREHOUSE) {
      lru.delete(stockKey(sku, warehouse))
    },
  }
}
