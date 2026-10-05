import { log } from '../log.js'
import { getPlan } from '../plans/plans.js'
import { listSubscriptions, saveSubscription } from '../subscriptions/store.js'
import { addMonths, parseDate } from '../util/dates.js'
import { charge } from './payments.js'

function advance(date, period) {
  return period === 'annual' ? addMonths(date, 12) : addMonths(date, 1)
}

/**
 * 결제일이 된(지난) 구독을 결제하고 다음 결제일을 한 주기 뒤로 민다. 결제가 실패하면 다음 결제일을 그대로 두어
 * 다음 날 다시 시도한다.
 * @returns {{ subscriptionId: string, amount: number, ok: boolean }[]}
 */
export function runBilling(today) {
  const out = []
  for (const s of listSubscriptions()) {
    if (s.cancelledOn) continue
    if (parseDate(s.nextBillingOn) > parseDate(today)) continue
    const plan = getPlan(s.planId)
    const ok = charge(s.memberId, plan.price, `${plan.name} ${s.nextBillingOn}`)
    out.push({ subscriptionId: s.id, amount: plan.price, ok })
    if (ok) {
      s.lastBilledOn = today
      s.nextBillingOn = advance(s.nextBillingOn, plan.period)
      saveSubscription(s)
    } else {
      log.warn('billing failed', { id: s.id })
    }
  }
  return out
}
