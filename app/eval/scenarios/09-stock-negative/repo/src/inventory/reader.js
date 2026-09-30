import { HOME_WAREHOUSE } from '../warehouses/registry.js'

/**
 * 재고 레코드 읽기. 캐시에 있으면 캐시에서, 없으면 테이블에서 읽고 캐시에 넣는다.
 */
export function createReader({ stockTable, stockCache }) {
  return {
    get(sku, warehouse = HOME_WAREHOUSE) {
      const cached = stockCache.get(sku, warehouse)
      if (cached) return cached
      const record = stockTable.get(sku, warehouse)
      if (record) stockCache.set(sku, warehouse, record)
      return record
    },
  }
}

export function available(record) {
  return record ? record.onHand - record.reserved : 0
}

/** 밖으로 내보내는 모양 */
export function toView(record) {
  return {
    sku: record.sku,
    warehouse: record.warehouse,
    onHand: record.onHand,
    reserved: record.reserved,
    available: available(record),
  }
}
