/** 주문이 속한 날 */
function dayKey(at) {
  return new Date(at).toISOString().slice(0, 10)
}

/** 날짜별 매출 { 'YYYY-MM-DD': 합계 } */
export function dailyTotals(orders) {
  const out = {}
  for (const o of orders) out[dayKey(o.at)] = (out[dayKey(o.at)] ?? 0) + o.amount
  return out
}

/** 그날 매출 */
export function salesOn(orders, day) {
  return dailyTotals(orders)[day] ?? 0
}
