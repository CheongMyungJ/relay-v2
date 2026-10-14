// 주문 번호: ORD-<yyyyMMdd>-<4자리 일련번호>
export function orderNumber(date, seq) {
  const d = date.toISOString().slice(0, 10).replaceAll('-', '')
  return `ORD-${d}-${String(seq).padStart(4, '0')}`
}
