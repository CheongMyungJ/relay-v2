import { toCsv } from './csv.js'

const COLUMNS = [
  { key: 'id', title: '주문번호' },
  { key: 'customer', title: '고객' },
  { key: 'amount', title: '금액' },
  { key: 'memo', title: '메모' },
]

// 주문 목록을 내보낼 CSV 글
export function exportOrders(orders) {
  return toCsv(orders, COLUMNS)
}
