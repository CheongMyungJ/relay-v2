import { InvalidStateError, NotFoundError, ValidationError, assertPositiveInt } from '../util/errors.js'
import { warehouse as lookupWarehouse } from '../warehouses/registry.js'

// 주문과 관계없는 재고 이동: 입고, 실사 조정, 출고, 창고 간 이동

/**
 * 입고. 창고에 레코드가 없으면 새로 만든다.
 */
export function receive({ reader, stockTable, stockCache, clock, log }, { sku, warehouse, qty }) {
  assertPositiveInt(qty, '입고 수량')
  lookupWarehouse(warehouse)
  const current = reader.get(sku, warehouse) ?? { sku, warehouse, onHand: 0, reserved: 0 }
  const next = { ...current, onHand: current.onHand + qty, updatedAt: clock.iso() }
  stockTable.put(next)
  stockCache.set(sku, warehouse, next)
  log.info('입고', { sku, warehouse, qty, onHand: next.onHand })
  return next
}

/**
 * 실사 조정. 실사 수량으로 실재고를 맞춘다. 예약은 건드리지 않는다.
 */
export function adjust({ reader, stockTable, stockCache, clock, log }, { sku, warehouse, counted, reason }) {
  if (!Number.isInteger(counted) || counted < 0) throw new ValidationError(`실사 수량이 잘못됨: ${counted}`)
  const current = reader.get(sku, warehouse) ?? { sku, warehouse, onHand: 0, reserved: 0 }
  const next = { ...current, onHand: counted, updatedAt: clock.iso() }
  stockTable.put(next)
  stockCache.set(sku, warehouse, next)
  log.warn('실사 조정', { sku, warehouse, from: current.onHand, to: counted, reason })
  return next
}

/**
 * 출고. 예약했던 수량만큼 실재고와 예약을 함께 줄인다.
 * line: { sku, allocations: [{ warehouse, qty }] }
 */
export function shipLine({ reader, stockTable, stockCache, clock, log }, line) {
  const updated = []
  for (const part of line.allocations) {
    const current = reader.get(line.sku, part.warehouse)
    if (!current) throw new NotFoundError(`재고 레코드 없음: ${line.sku}@${part.warehouse}`)
    if (current.reserved < part.qty || current.onHand < part.qty) {
      throw new InvalidStateError(`출고할 수 없음: ${line.sku}@${part.warehouse} 실재고 ${current.onHand}, 예약 ${current.reserved}, 출고 ${part.qty}`)
    }
    const next = {
      ...current,
      onHand: current.onHand - part.qty,
      reserved: current.reserved - part.qty,
      updatedAt: clock.iso(),
    }
    stockTable.put(next)
    stockCache.set(line.sku, part.warehouse, next)
    updated.push(next)
    log.debug('출고', { sku: line.sku, warehouse: part.warehouse, qty: part.qty })
  }
  return updated
}

/**
 * 창고 간 이동. 보내는 창고의 가용 재고 안에서만 옮긴다.
 */
export function transfer({ reader, stockTable, stockCache, clock, log }, { sku, from, to, qty }) {
  assertPositiveInt(qty, '이동 수량')
  if (from === to) throw new ValidationError(`같은 창고로 옮길 수 없음: ${from}`)
  lookupWarehouse(to)
  const source = reader.get(sku, from)
  if (!source) throw new NotFoundError(`재고 레코드 없음: ${sku}@${from}`)
  if (source.onHand - source.reserved < qty) {
    throw new InvalidStateError(`옮길 가용 재고 부족: ${sku}@${from} 가용 ${source.onHand - source.reserved}, 이동 ${qty}`)
  }
  const target = reader.get(sku, to) ?? { sku, warehouse: to, onHand: 0, reserved: 0 }
  const at = clock.iso()
  const nextSource = { ...source, onHand: source.onHand - qty, updatedAt: at }
  const nextTarget = { ...target, onHand: target.onHand + qty, updatedAt: at }
  stockTable.put(nextSource)
  stockTable.put(nextTarget)
  stockCache.set(sku, from, nextSource)
  stockCache.set(sku, to, nextTarget)
  log.info('창고 이동', { sku, from, to, qty })
  return { from: nextSource, to: nextTarget }
}
