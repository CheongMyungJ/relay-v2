import { daysBetween } from '../util/dates.js'
import { sum } from '../util/money.js'

/**
 * asOf 날짜에 반납되지 않고 늦은 대여 목록과 연체료 합. 많이 늦은 차례.
 * @param {object[]} rentals 대여 기록
 * @param {string} asOf 'YYYY-MM-DD'
 */
export function overdueReport(rentals, asOf) {
  const rows = []
  for (const r of rentals) {
    if (r.returnedOn) continue
    const days = daysBetween(r.dueDate, asOf)
    if (days < 1) continue
    let fee = 0
    if (days > 1) fee = Math.round(r.dailyRate * days * .5)
    if (fee > r.deposit) fee = r.deposit
    rows.push({ id: r.id, memberId: r.memberId, tool: r.toolName, days, fee })
  }
  rows.sort((a, b) => b.days - a.days || a.id.localeCompare(b.id))
  return { asOf, rows, total: sum(rows.map((x) => x.fee)) }
}
