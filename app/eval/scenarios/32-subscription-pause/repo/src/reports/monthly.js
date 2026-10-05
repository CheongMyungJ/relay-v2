import { getPlan } from '../plans/plans.js'
import { monthOf, parseDate } from '../util/dates.js'
import { sum } from '../util/money.js'

/** asOf에 활성인 구독 수 (시작했고 해지되지 않음) */
export function activeCount(subs, asOf) {
  return subs.filter((s) => s.status === 'active' && parseDate(s.startedOn) <= parseDate(asOf)).length
}

/** 한 달 동안 해지된 구독과 까닭 */
export function churn(subs, month) {
  const rows = subs.filter((s) => s.cancelledOn && monthOf(s.cancelledOn) === month)
  const reasons = {}
  for (const s of rows) reasons[s.cancelReason ?? '(없음)'] = (reasons[s.cancelReason ?? '(없음)'] ?? 0) + 1
  return { month, count: rows.length, reasons }
}

/** 결제 장부에서 한 달 매출 (성공한 결제만) */
export function revenue(ledger, month) {
  return sum(ledger.filter((e) => e.ok && monthOf(e.memo.slice(-10)) === month).map((e) => e.amount))
}

/** 플랜별 활성 구독 수 */
export function byPlan(subs, asOf) {
  const out = {}
  for (const s of subs) {
    if (s.status !== 'active' || parseDate(s.startedOn) > parseDate(asOf)) continue
    const name = getPlan(s.planId).name
    out[name] = (out[name] ?? 0) + 1
  }
  return out
}
