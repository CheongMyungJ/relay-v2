// 연간 플랜은 일시정지할 수 없다(연간 할인가라서)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pauseSubscription } from '../src/subscriptions/service.js'
import { reset, runDays, sub } from './days.js'

test('연간 플랜은 정지를 거절하고 그대로 배송한다', () => {
  reset([sub({ planId: 'basic-y', nextBillingOn: '2027-03-02' })])
  let refused = false
  const of = runDays('2026-10-02', '2026-10-16', {
    '2026-10-02': () => {
      try {
        pauseSubscription('S-1', '2026-10-02')
      } catch {
        refused = true
      }
    },
  })
  assert.ok(refused, '연간 플랜의 정지를 받아들였다')
  assert.deepEqual(of('S-1').deliveries, ['2026-10-08', '2026-10-15'])
})
