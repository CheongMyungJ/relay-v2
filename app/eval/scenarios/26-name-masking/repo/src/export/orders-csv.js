/** 주문 내역 CSV: 주문번호, 날짜, 고객 이름, 이메일, 금액 */
export function ordersCsv(orders, customers) {
  const byId = new Map(customers.map((c) => [c.id, c]))
  const rows = orders.map((o) => {
    const c = byId.get(o.customerId)
    return [o.id, o.date, c.name, c.email, o.total]
  })
  return [['주문번호', '날짜', '고객', '이메일', '금액'], ...rows].map((r) => r.join(',')).join('\n')
}
