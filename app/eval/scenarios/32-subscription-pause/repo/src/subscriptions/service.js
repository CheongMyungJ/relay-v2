import { log } from '../log.js'
import { getMember } from '../members/members.js'
import { getPlan } from '../plans/plans.js'
import { RuleError } from '../util/errors.js'
import { getSubscription, listSubscriptions, nextSubscriptionId, saveSubscription } from './store.js'

/** 구독 시작. 첫 결제는 시작일의 하루 작업에서 한다 */
export function subscribe({ memberId, planId, today, deliveryWeekday }) {
  getMember(memberId)
  getPlan(planId)
  if (!Number.isInteger(deliveryWeekday) || deliveryWeekday < 1 || deliveryWeekday > 5)
    throw new RuleError('배송 요일은 월~금(1~5)')
  if (listSubscriptions().some((s) => s.memberId === memberId && s.status !== 'cancelled'))
    throw new RuleError('이미 구독 중인 회원')
  const sub = {
    id: nextSubscriptionId(),
    memberId,
    planId,
    status: 'active',
    startedOn: today,
    nextBillingOn: today,
    deliveryWeekday,
    cancelledOn: null,
    cancelReason: null,
  }
  saveSubscription(sub)
  log.info('subscribed', { id: sub.id, memberId, planId })
  return sub
}

/** 플랜 바꾸기. 다음 결제부터 새 플랜 값으로 받는다. 월간과 연간 사이는 바꿀 수 없다 */
export function changePlan(id, planId, today) {
  const sub = getSubscription(id)
  if (sub.status === 'cancelled') throw new RuleError('해지된 구독')
  const from = getPlan(sub.planId)
  const to = getPlan(planId)
  if (from.period !== to.period) throw new RuleError('결제 주기가 다른 플랜으로는 바꿀 수 없음')
  sub.planId = planId
  saveSubscription(sub)
  log.info('plan changed', { id, from: from.id, to: to.id, on: today })
  return sub
}

/** 배송 요일 바꾸기 */
export function changeDeliveryDay(id, deliveryWeekday) {
  const sub = getSubscription(id)
  if (!Number.isInteger(deliveryWeekday) || deliveryWeekday < 1 || deliveryWeekday > 5)
    throw new RuleError('배송 요일은 월~금(1~5)')
  sub.deliveryWeekday = deliveryWeekday
  return saveSubscription(sub)
}

/** 해지. 이미 낸 기간은 돌려주지 않고, 해지일부터 배송과 결제가 멈춘다 */
export function cancelSubscription(id, today, reason = '') {
  const sub = getSubscription(id)
  if (sub.status === 'cancelled') throw new RuleError('이미 해지됨')
  sub.status = 'cancelled'
  sub.cancelledOn = today
  sub.cancelReason = reason || null
  saveSubscription(sub)
  log.info('cancelled', { id, reason })
  return sub
}
