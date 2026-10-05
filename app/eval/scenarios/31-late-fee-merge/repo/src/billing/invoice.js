import { listRentals } from '../rentals/store.js'
import { daysBetween, monthOf } from '../util/dates.js'
import { sum } from '../util/money.js'
import { vatOf } from './tax.js'

/** 반납된 대여의 연체료 줄. 연체료가 없으면 null */
export function lateFeeLine(rental, returnedOn) {
  const days = daysBetween(rental.dueDate, returnedOn)
  if (days <= 1) return null
  const amount = Math.min(Math.round(rental.dailyRate * days * 0.5), rental.deposit)
  return { label: `연체료 (${days}일)`, amount }
}

/** 회원의 한 달 청구서. 그 달에 반납된 대여의 대여료와 연체료 */
export function monthlyInvoice(memberId, month) {
  const rentals = listRentals()
    .filter((r) => r.memberId === memberId && r.returnedOn && monthOf(r.returnedOn) === month)
    .sort((a, b) => a.returnedOn.localeCompare(b.returnedOn) || a.id.localeCompare(b.id))
  const lines = []
  for (const r of rentals) {
    const rent = sum(r.charges.filter((c) => c.kind === 'rent').map((c) => c.amount))
    lines.push({ label: `${r.toolName} 대여 (${r.id})`, amount: rent })
    const late = lateFeeLine(r, r.returnedOn)
    if (late) lines.push(late)
  }
  const supply = sum(lines.map((l) => l.amount))
  const vat = vatOf(supply)
  return { memberId, month, lines, supply, vat, total: supply + vat }
}
