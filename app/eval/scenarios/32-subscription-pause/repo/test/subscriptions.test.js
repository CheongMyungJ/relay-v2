import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { cancelSubscription, changeDeliveryDay, changePlan, subscribe } from '../src/subscriptions/service.js'
import { getSubscription, resetStore } from '../src/subscriptions/store.js'
import { sub } from './helpers.js'

beforeEach(() => resetStore([]))

test('구독 시작', () => {
  const s = subscribe({ memberId: 'M-1', planId: 'basic-m', today: '2026-10-05', deliveryWeekday: 2 })
  assert.equal(s.status, 'active')
  assert.equal(s.nextBillingOn, '2026-10-05')
  assert.throws(() => subscribe({ memberId: 'M-1', planId: 'family-m', today: '2026-10-05', deliveryWeekday: 2 }), /이미 구독/)
  assert.throws(() => subscribe({ memberId: 'M-2', planId: 'basic-m', today: '2026-10-05', deliveryWeekday: 6 }), /월~금/)
})

test('플랜 바꾸기는 같은 결제 주기 안에서만', () => {
  resetStore([sub()])
  assert.equal(changePlan('S-1', 'family-m', '2026-10-05').planId, 'family-m')
  assert.throws(() => changePlan('S-1', 'basic-y', '2026-10-05'), /결제 주기/)
})

test('배송 요일 바꾸기', () => {
  resetStore([sub()])
  assert.equal(changeDeliveryDay('S-1', 1).deliveryWeekday, 1)
})

test('해지', () => {
  resetStore([sub()])
  cancelSubscription('S-1', '2026-10-05', '이사')
  const s = getSubscription('S-1')
  assert.equal(s.status, 'cancelled')
  assert.equal(s.cancelledOn, '2026-10-05')
  assert.throws(() => cancelSubscription('S-1', '2026-10-06'), /이미 해지/)
})
