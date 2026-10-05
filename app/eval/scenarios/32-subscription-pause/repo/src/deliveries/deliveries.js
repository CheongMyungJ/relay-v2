import { getMember } from '../members/members.js'
import { getPlan } from '../plans/plans.js'
import { listSubscriptions } from '../subscriptions/store.js'
import { parseDate, weekday } from '../util/dates.js'
import { menuFor } from './menu.js'

/**
 * 오늘 보낼 배송. 배송 요일이 오늘인 구독마다 하나. 시작일 전이거나 해지된 구독은 보내지 않는다.
 * @returns {{ subscriptionId: string, memberId: string, address: string, dishes: string[] }[]}
 */
export function scheduleDeliveries(today) {
  const out = []
  for (const s of listSubscriptions()) {
    if (s.status === 'cancelled') continue
    if (parseDate(s.startedOn) > parseDate(today)) continue
    if (s.deliveryWeekday !== weekday(today)) continue
    const plan = getPlan(s.planId)
    out.push({
      subscriptionId: s.id,
      memberId: s.memberId,
      address: getMember(s.memberId).address,
      dishes: menuFor(today, plan.dishes),
    })
  }
  return out.sort((a, b) => a.subscriptionId.localeCompare(b.subscriptionId))
}
