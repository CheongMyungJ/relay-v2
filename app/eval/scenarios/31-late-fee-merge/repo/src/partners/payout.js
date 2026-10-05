import { getTool } from '../catalog/tools.js'
import { config } from '../config.js'
import { listRentals } from '../rentals/store.js'
import { daysBetween, monthOf } from '../util/dates.js'
import { sum } from '../util/money.js'
import { getPartner } from './partners.js'

/** 파트너 정산: 한 달 동안 반납된 파트너 공구 대여의 대여료와 연체료 가운데 파트너 몫 */
export function partnerPayout(partnerId, month) {
  const partner = getPartner(partnerId)
  const items = []
  for (const r of listRentals()) {
    if (!r.returnedOn || monthOf(r.returnedOn) !== month) continue
    if (getTool(r.toolId).partnerId !== partnerId) continue
    const rent = sum(r.charges.filter((c) => c.kind === 'rent').map((c) => c.amount))
    const days = daysBetween(r.dueDate, r.returnedOn)
    const late = days > 1 ? Math.min(Math.floor((r.dailyRate * days) / 2), r.deposit) : 0
    items.push({
      rentalId: r.id,
      tool: r.toolName,
      rent: Math.floor(rent * config.partnerShare),
      late: Math.floor(late * config.partnerShare),
    })
  }
  items.sort((a, b) => a.rentalId.localeCompare(b.rentalId))
  return {
    partnerId,
    partner: partner.name,
    month,
    items,
    total: sum(items.map((i) => i.rent + i.late)),
  }
}
