import { InsufficientStockError, assertPositiveInt } from '../util/errors.js'
import { routeFor } from './route.js'

/**
 * 주문 수량을 창고별로 나눈다. 배송 지역에 가까운 창고부터 가용 재고만큼 채운다.
 * rows는 그 SKU의 창고별 재고 레코드(stockTable.listBySku)다.
 * 돌려주는 값: [{ warehouse, qty }]
 */
export function allocate(rows, { sku, qty, region }) {
  assertPositiveInt(qty, '수량')
  const byWarehouse = new Map(rows.map((r) => [r.warehouse, r]))
  const plan = []
  let remaining = qty

  for (const code of routeFor(region)) {
    if (remaining === 0) break
    const row = byWarehouse.get(code)
    if (!row) continue
    const available = row.onHand - row.reserved
    if (available <= 0) continue
    const take = Math.min(available, remaining)
    plan.push({ warehouse: code, qty: take })
    remaining -= take
  }

  if (remaining > 0) {
    const total = rows.reduce((sum, r) => sum + Math.max(0, r.onHand - r.reserved), 0)
    throw new InsufficientStockError(sku, qty, total)
  }
  return plan
}

/** 한 창고에서 다 채울 수 있으면 그 창고 하나로 */
export function isSingleWarehouse(plan) {
  return plan.length === 1
}
