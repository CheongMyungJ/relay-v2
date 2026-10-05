// 정지는 최대 28일이다. 정지한 날로부터 28일이 지나면 해지가 아니라 자동으로 재개되고, 결제일은 28일 밀린다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pauseSubscription } from '../src/subscriptions/service.js'
import { reset, runDays, sub } from './days.js'

test('재개하지 않으면 28일 뒤 자동으로 재개된다', () => {
  reset([sub()])
  const of = runDays('2026-10-02', '2026-11-12', {
    '2026-10-02': () => pauseSubscription('S-1', '2026-10-02'), // 10-30에 재개
  })
  assert.deepEqual(of('S-1').deliveries, ['2026-11-05', '2026-11-12'])
  assert.deepEqual(of('S-1').charges, ['2026-11-07'])
  assert.deepEqual(of('S-1').reminders, ['2026-11-04'])
})
