import { compareWarehouse } from '../warehouses/registry.js'
import { createStockCache } from './stock-cache.js'
import { available, createReader, toView } from './reader.js'
import { reserveLine } from './reserve.js'
import { releaseLine } from './release.js'
import { adjust, receive, shipLine, transfer } from './movements.js'

/**
 * 재고 기능을 묶는다. 주문 쪽은 이것만 쓴다.
 */
export function createInventory({ stockTable, cache, clock, log }) {
  const stockCache = createStockCache(cache)
  const reader = createReader({ stockTable, stockCache })
  const deps = { reader, stockTable, stockCache, clock, log: log.child('inventory') }

  return {
    /** 창고 하나의 재고(캐시를 거친다). 없으면 null */
    getStock(sku, warehouse) {
      const r = reader.get(sku, warehouse)
      return r ? toView(r) : null
    },
    /** SKU의 창고별 레코드(테이블에서 바로) */
    records(sku) {
      return stockTable.listBySku(sku).sort((a, b) => compareWarehouse(a.warehouse, b.warehouse))
    },
    /** SKU의 창고 전체 가용 재고 */
    totalAvailable(sku) {
      return this.records(sku).reduce((sum, r) => sum + available(r), 0)
    },
    warehousesOf(sku) {
      return this.records(sku).map((r) => r.warehouse)
    },
    reserveLine: (line) => reserveLine(deps, line),
    releaseLine: (line) => releaseLine(deps, line),
    shipLine: (line) => shipLine(deps, line),
    receive: (input) => receive(deps, input),
    adjust: (input) => adjust(deps, input),
    transfer: (input) => transfer(deps, input),
  }
}
