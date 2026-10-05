// 정지 중에는 결제, 배송, 결제 안내가 모두 없고, 재개하면 배송이 다시 나간다. 정지하지 않은 구독은 그대로다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pauseSubscription, resumeSubscription } from '../src/subscriptions/service.js'
import { reset, runDays, sub } from './days.js'

test('정지 중에는 아무것도 나가지 않는다', () => {
  reset([sub({ id: 'S-1' }), sub({ id: 'S-2', memberId: 'M-2' })])
  const of = runDays('2026-10-02', '2026-10-23', {
    '2026-10-02': () => pauseSubscription('S-1', '2026-10-02'), // 금요일
    '2026-10-19': () => resumeSubscription('S-1', '2026-10-19'), // 월요일, 17일 정지
  })
  assert.deepEqual(of('S-1').deliveries, ['2026-10-22'])
  assert.ok(!of('S-1').charges.some((d) => d < '2026-10-19'), `정지 중 결제: ${of('S-1').charges}`)
  assert.ok(!of('S-1').reminders.some((d) => d < '2026-10-19'), `정지 중 안내: ${of('S-1').reminders}`)
  assert.deepEqual(of('S-2'), {
    charges: ['2026-10-10'],
    deliveries: ['2026-10-08', '2026-10-15', '2026-10-22'],
    reminders: ['2026-10-07'],
  })
})
