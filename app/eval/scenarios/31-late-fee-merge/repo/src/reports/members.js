import { listMembers } from '../members/members.js'
import { sum } from '../util/money.js'

/** 회원마다 대여 수, 낸 대여료, 낸 연체료(charges 기준) */
export function memberStats(rentals) {
  const stats = new Map(listMembers().map((m) => [m.id, { memberId: m.id, name: m.name, rentals: 0, rent: 0, late: 0 }]))
  for (const r of rentals) {
    const s = stats.get(r.memberId)
    if (!s) continue
    s.rentals += 1
    s.rent += sum(r.charges.filter((c) => c.kind === 'rent').map((c) => c.amount))
    s.late += sum(r.charges.filter((c) => c.kind === 'late').map((c) => c.amount))
  }
  return [...stats.values()].sort((a, b) => b.rent + b.late - (a.rent + a.late) || a.memberId.localeCompare(b.memberId))
}
