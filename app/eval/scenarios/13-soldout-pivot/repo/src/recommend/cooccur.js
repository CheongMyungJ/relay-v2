// 함께 산 상품. 주문 목록([[id, id, ...], ...])에서 같이 담긴 횟수를 센다.

export function buildCooccurrence(orders) {
  const matrix = new Map()
  const bump = (a, b) => {
    let row = matrix.get(a)
    if (!row) matrix.set(a, (row = new Map()))
    row.set(b, (row.get(b) ?? 0) + 1)
  }
  for (const order of orders) {
    const ids = [...new Set(order)]
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        bump(ids[i], ids[j])
        bump(ids[j], ids[i])
      }
    }
  }
  return matrix
}

// id와 가장 자주 같이 산 상품 n개: [{ id, count }]
export function topCooccurring(matrix, id, n = 5) {
  const row = matrix.get(id)
  if (!row) return []
  return [...row.entries()]
    .map(([other, count]) => ({ id: other, count }))
    .sort((a, b) => b.count - a.count || (a.id < b.id ? -1 : 1))
    .slice(0, n)
}

// 요즘 많이 팔린 상품: 최근 주문 windowSize개에서 담긴 횟수
export function trending(orders, { windowSize = 100, n = 5 } = {}) {
  const counts = new Map()
  for (const order of orders.slice(-windowSize)) {
    for (const id of new Set(order)) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, n)
    .map(([id, count]) => ({ id, count }))
}
