/** 주문이 속한 주의 월요일 'YYYY-MM-DD' */
export function weekStart(at) {
  const d = new Date(at)
  const back = (d.getUTCDay() + 6) % 7
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back))
  return monday.toISOString().slice(0, 10)
}

/** 주별 매출 { 월요일: 합계 } */
export function weeklyTotals(orders) {
  const out = {}
  for (const o of orders) out[weekStart(o.at)] = (out[weekStart(o.at)] ?? 0) + o.amount
  return out
}
