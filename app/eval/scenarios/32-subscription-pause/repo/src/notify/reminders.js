import { config } from '../config.js'
import { getMember } from '../members/members.js'
import { getPlan } from '../plans/plans.js'
import { listSubscriptions } from '../subscriptions/store.js'
import { daysBetween } from '../util/dates.js'
import { formatWon } from '../util/money.js'
import { sendSms } from './sms.js'
import { render } from './templates.js'

/**
 * 결제 사흘 전 안내 문자. 보낸 구독 id 목록
 */
export function sendBillingReminders(today) {
  const sent = []
  for (const s of listSubscriptions()) {
    if (s.cancelledOn) continue
    if (daysBetween(today, s.nextBillingOn) !== config.reminderDaysBefore) continue
    const m = getMember(s.memberId)
    const plan = getPlan(s.planId)
    sendSms(m.phone, render('billing-soon', { name: m.name, date: s.nextBillingOn, plan: plan.name, amount: formatWon(plan.price) }))
    sent.push(s.id)
  }
  return sent.sort()
}
