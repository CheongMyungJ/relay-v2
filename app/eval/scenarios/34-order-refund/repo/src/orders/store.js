// 주문 저장소 (메모리)
const orders = new Map()
let seq = 0

export function save(order) {
  const id = order.id ?? ++seq
  const saved = { ...order, id }
  orders.set(id, saved)
  return saved
}

export function find(id) {
  return orders.get(id) ?? null
}

export function clear() {
  orders.clear()
  seq = 0
}
