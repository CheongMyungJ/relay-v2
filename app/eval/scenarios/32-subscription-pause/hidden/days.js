// 숨긴 시험의 도움: from부터 to까지 날마다 하루 작업을 돌려, 구독마다 결제·배송·안내가 나간 날을 모은다
import { clearLedger } from '../src/billing/payments.js'
import { runDaily } from '../src/jobs/daily.js'
import { clearOutbox } from '../src/notify/sms.js'
import { resetStore } from '../src/subscriptions/store.js'

const DAY = 86400000
const next = (d) => new Date(Date.parse(`${d}T00:00:00Z`) + DAY).toISOString().slice(0, 10)

export function sub(over = {}) {
  return {
    id: 'S-1',
    memberId: 'M-1',
    planId: 'basic-m',
    status: 'active',
    startedOn: '2026-09-10',
    nextBillingOn: '2026-10-10',
    deliveryWeekday: 4, // 목요일: 10-01, 10-08, 10-15, 10-22, 10-29, 11-05
    cancelledOn: null,
    cancelReason: null,
    ...over,
  }
}

export function reset(list) {
  resetStore(list)
  clearLedger()
  clearOutbox()
}

/** actions: { 'YYYY-MM-DD': () => void } 그날 하루 작업 전에 할 일(정지, 재개) */
export function runDays(from, to, actions = {}) {
  const seen = {}
  const add = (id, kind, d) => {
    seen[id] ??= { charges: [], deliveries: [], reminders: [] }
    seen[id][kind].push(d)
  }
  for (let d = from; d <= to; d = next(d)) {
    actions[d]?.()
    const r = runDaily(d)
    for (const c of r.charges) if (c.ok) add(c.subscriptionId, 'charges', d)
    for (const x of r.deliveries) add(x.subscriptionId, 'deliveries', d)
    for (const id of r.reminders) add(id, 'reminders', d)
  }
  return (id) => seen[id] ?? { charges: [], deliveries: [], reminders: [] }
}
