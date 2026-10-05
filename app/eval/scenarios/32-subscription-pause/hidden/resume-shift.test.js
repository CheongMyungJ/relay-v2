// 재개하면 다음 결제일이 정지한 날 수만큼 뒤로 밀린다(이미 낸 기간을 다 쓰게)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getSubscription } from '../src/subscriptions/store.js'
import { pauseSubscription, resumeSubscription } from '../src/subscriptions/service.js'
import { reset, runDays, sub } from './days.js'

test('결제일 전에 재개하면 정지한 날 수만큼 밀린다', () => {
  reset([sub()])
  const of = runDays('2026-10-02', '2026-10-20', {
    '2026-10-02': () => pauseSubscription('S-1', '2026-10-02'),
    '2026-10-06': () => resumeSubscription('S-1', '2026-10-06'), // 4일 정지 → 10-14
  })
  assert.deepEqual(of('S-1').charges, ['2026-10-14'])
  assert.deepEqual(of('S-1').reminders, ['2026-10-11'])
  assert.equal(getSubscription('S-1').nextBillingOn, '2026-11-14')
})

test('결제일이 정지 중에 지나가도 재개 뒤 밀린 날에 결제한다', () => {
  reset([sub()])
  const of = runDays('2026-10-02', '2026-10-25', {
    '2026-10-02': () => pauseSubscription('S-1', '2026-10-02'),
    '2026-10-12': () => resumeSubscription('S-1', '2026-10-12'), // 10일 정지 → 10-20
  })
  assert.deepEqual(of('S-1').charges, ['2026-10-20'])
  assert.deepEqual(of('S-1').reminders, ['2026-10-17'])
})
