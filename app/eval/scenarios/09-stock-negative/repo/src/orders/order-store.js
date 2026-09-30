import { createTable } from '../store/tables.js'
import { NotFoundError } from '../util/errors.js'
import { inRange } from '../util/clock.js'

export const STATUSES = ['placed', 'shipped', 'cancelled']

/**
 * 주문 저장소. 주문 번호는 ORD-00001부터 차례로 붙인다.
 * 주문: { id, customer, lines, subtotal, discount, tax, total, status, placedAt, ... }
 * 줄: { sku, qty, unitPrice, discount, amount, allocations: [{ warehouse, qty }] }
 */
export function createOrderStore() {
  const table = createTable('orders', (o) => o.id)
  let seq = 0

  return {
    create(order) {
      const id = `ORD-${String(++seq).padStart(5, '0')}`
      return table.put({ ...order, id })
    },
    get(id) {
      const order = table.get(id)
      if (!order) throw new NotFoundError(`없는 주문: ${id}`)
      return order
    },
    update(id, patch) {
      const order = this.get(id)
      return table.put({ ...order, ...patch, id })
    },
    list({ status, period } = {}) {
      return table
        .scan((o) => (!status || o.status === status) && (!period || inRange(o.placedAt, period)))
        .sort((a, b) => a.id.localeCompare(b.id))
    },
    count: () => table.count(),
  }
}
