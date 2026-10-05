// 정지와 관계없는 구독은 지금처럼: 결제와 다음 결제일, 실패 재시도, 배송, 안내, 해지, 새 필드가 없는 옛 기록
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cancelSubscription, subscribe } from '../src/subscriptions/service.js'
import { getSubscription } from '../src/subscriptions/store.js'
import { activeCount } from '../src/reports/monthly.js'
import { listSubscriptions } from '../src/subscriptions/store.js'
import { reset, runDays, sub } from './days.js'

test('월간과 연간 구독의 하루 작업', () => {
  reset([
    sub({ id: 'S-1' }),
    sub({ id: 'S-2', memberId: 'M-2', planId: 'family-y', nextBillingOn: '2026-10-12', deliveryWeekday: 2 }),
    sub({ id: 'S-3', memberId: 'M-3' }), // 카드가 유효하지 않음
  ])
  const of = runDays('2026-10-01', '2026-10-14')
  assert.deepEqual(of('S-1'), {
    charges: ['2026-10-10'],
    deliveries: ['2026-10-01', '2026-10-08'],
    reminders: ['2026-10-07'],
  })
  assert.deepEqual(of('S-2').charges, ['2026-10-12'])
  assert.deepEqual(of('S-2').deliveries, ['2026-10-06', '2026-10-13'])
  assert.equal(getSubscription('S-1').nextBillingOn, '2026-11-10')
  assert.equal(getSubscription('S-2').nextBillingOn, '2027-10-12')
  assert.equal(getSubscription('S-3').nextBillingOn, '2026-10-10')
})

test('해지와 새로 구독', () => {
  reset([sub()])
  const of = runDays('2026-10-01', '2026-10-12', {
    '2026-10-05': () => cancelSubscription('S-1', '2026-10-05', '이사'),
    '2026-10-06': () => subscribe({ memberId: 'M-1', planId: 'family-m', today: '2026-10-06', deliveryWeekday: 4 }),
  })
  assert.deepEqual(of('S-1').deliveries, ['2026-10-01'])
  assert.deepEqual(of('S-1').charges, [])
  const fresh = listSubscriptions().find((s) => s.id !== 'S-1')
  assert.deepEqual(of(fresh.id).charges, ['2026-10-06'])
  assert.deepEqual(of(fresh.id).deliveries, ['2026-10-08'])
  assert.equal(activeCount(listSubscriptions(), '2026-10-12'), 1)
})

test('정지 필드가 없는 옛 기록도 그대로 돈다', () => {
  const old = { id: 'S-9', memberId: 'M-4', planId: 'basic-m', status: 'active', startedOn: '2025-01-10', nextBillingOn: '2026-10-10', deliveryWeekday: 4 }
  reset([old])
  const of = runDays('2026-10-07', '2026-10-10')
  assert.deepEqual(of('S-9'), { charges: ['2026-10-10'], deliveries: ['2026-10-08'], reminders: ['2026-10-07'] })
})
