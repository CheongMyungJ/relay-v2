import { InvalidStateError, NotFoundError, assertPositiveInt } from '../util/errors.js'

/**
 * 주문 줄 하나의 예약을 푼다(주문 취소, 예약 실패 뒤 되돌리기).
 * line: { sku, allocations: [{ warehouse, qty }] }
 */
export function releaseLine({ reader, stockTable, stockCache, clock, log }, line) {
  const updated = []
  for (const part of line.allocations) {
    assertPositiveInt(part.qty, '해제 수량')
    const current = reader.get(line.sku, part.warehouse)
    if (!current) throw new NotFoundError(`재고 레코드 없음: ${line.sku}@${part.warehouse}`)
    if (current.reserved < part.qty) {
      throw new InvalidStateError(`예약보다 많이 풀 수 없음: ${line.sku}@${part.warehouse} 예약 ${current.reserved}, 해제 ${part.qty}`)
    }

    const next = { ...current, reserved: current.reserved - part.qty, updatedAt: clock.iso() }
    stockTable.put(next)
    updated.push(next)
    log.debug('예약 해제', { sku: line.sku, warehouse: part.warehouse, qty: part.qty, reserved: next.reserved })
  }
  stockCache.invalidate(line.sku)
  return updated
}
