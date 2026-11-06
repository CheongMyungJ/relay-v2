import assert from 'node:assert/strict'
import { test } from 'node:test'
import { feeOf, settlementDate, settlementSchedule } from '../src/billing/settlement.js'
import { placePaid, setup } from './helpers.js'

test('수수료와 정산일', () => {
  assert.equal(feeOf(10000), 290)
  assert.equal(feeOf(12345), 359)
  assert.equal(settlementDate('2026-03-31T16:00:00Z'), '2026-05-10') // 한국 날짜로 4월 1일
  assert.equal(settlementDate('2026-12-02T01:00:00Z'), '2027-01-10')
})

test('정산 일정', () => {
  const shop = setup()
  const a = placePaid(shop, 'u-1', [['TEA', 2]])
  placePaid(shop, 'u-2', [['MUG', 1]])
  shop.orders.cancelOrder(a.id)
  const [row] = settlementSchedule(shop.store.payments)
  assert.deepEqual(row, { date: '2026-04-10', charged: 75000, refunded: 60000, fees: 1740 + 435, payout: 75000 - 60000 - 2175 })
})
