import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { clearLedger, ledger } from '../src/billing/payments.js'
import { runDaily } from '../src/jobs/daily.js'
import { clearOutbox, outbox } from '../src/notify/sms.js'
import { getSubscription, resetStore } from '../src/subscriptions/store.js'
import { sub } from './helpers.js'

beforeEach(() => {
  resetStore([])
  clearLedger()
  clearOutbox()
})

test('결제일에 결제하고 다음 결제일을 한 달 뒤로', () => {
  resetStore([sub()])
  const r = runDaily('2026-10-10')
  assert.deepEqual(r.charges, [{ subscriptionId: 'S-1', amount: 39000, ok: true }])
  assert.equal(getSubscription('S-1').nextBillingOn, '2026-11-10')
  assert.deepEqual(runDaily('2026-10-11').charges, [])
})

test('결제가 실패하면 다음 날 다시 시도', () => {
  resetStore([sub({ memberId: 'M-3' })])
  assert.equal(runDaily('2026-10-10').charges[0].ok, false)
  assert.equal(getSubscription('S-1').nextBillingOn, '2026-10-10')
  assert.equal(runDaily('2026-10-11').charges.length, 1)
  assert.equal(ledger.length, 2)
})

test('배송 요일에 배송', () => {
  resetStore([sub(), sub({ id: 'S-2', memberId: 'M-2', deliveryWeekday: 2 })])
  assert.deepEqual(
    runDaily('2026-10-01').deliveries.map((d) => d.subscriptionId),
    ['S-1'],
  )
  assert.deepEqual(runDaily('2026-10-01').deliveries[0].dishes.length, 4)
})

test('결제 사흘 전 안내', () => {
  resetStore([sub()])
  assert.deepEqual(runDaily('2026-10-07').reminders, ['S-1'])
  assert.match(outbox[0].text, /2026-10-10에 기본 반찬 \(월간\) 39,000원이 결제됩니다/)
})

test('해지된 구독은 결제·배송·안내가 없다', () => {
  resetStore([sub({ status: 'cancelled', cancelledOn: '2026-09-30' })])
  for (const d of ['2026-10-01', '2026-10-07', '2026-10-10']) {
    const r = runDaily(d)
    assert.equal(r.charges.length + r.deliveries.length + r.reminders.length, 0)
  }
})
