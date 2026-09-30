import { NotFoundError, assertPositiveInt } from '../util/errors.js'

/**
 * 주문 줄 하나의 창고별 수량을 예약한다.
 * line: { sku, allocations: [{ warehouse, qty }] } (allocate가 가용 재고 안에서 나눈 것)
 * 돌려주는 값: 예약 뒤의 창고별 레코드
 */
export function reserveLine({ reader, stockTable, stockCache, clock, log }, line) {
  const updated = []
  for (const part of line.allocations) {
    assertPositiveInt(part.qty, '예약 수량')
    const current = reader.get(line.sku, part.warehouse)
    if (!current) throw new NotFoundError(`재고 레코드 없음: ${line.sku}@${part.warehouse}`)

    const next = { ...current, reserved: current.reserved + part.qty, updatedAt: clock.iso() }
    stockTable.put(next)
    stockCache.set(line.sku, part.warehouse, next)
    updated.push(next)
    log.debug('예약', { sku: line.sku, warehouse: part.warehouse, qty: part.qty, reserved: next.reserved })
  }
  return updated
}
