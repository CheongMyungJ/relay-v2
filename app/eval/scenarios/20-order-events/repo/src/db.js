// 메모리 저장소
const orders = []

export function save(order) {
  orders.push(order)
}

export function all() {
  return orders.map((o) => ({ ...o }))
}

export function clear() {
  orders.length = 0
}
