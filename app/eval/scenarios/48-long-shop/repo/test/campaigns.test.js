import assert from 'node:assert/strict'
import { test } from 'node:test'
import { atKst, errorCode, placePaid, setup } from './helpers.js'

test('대상 고르기', () => {
  const shop = setup()
  placePaid(shop, 'u-1', [['MUG', 1]])
  shop.customers.update('u-2', { tier: 'vip' })
  shop.clock.set('2026-04-20T01:00:00Z')
  placePaid(shop, 'u-2', [['MUG', 1]])
  assert.deepEqual(shop.segments.select({ kind: 'recent', days: 30 }), ['u-2'])
  assert.deepEqual(shop.segments.select({ kind: 'dormant', days: 30 }), ['u-1'])
  assert.deepEqual(shop.segments.select({ kind: 'vip' }), ['u-2'])
  assert.deepEqual(shop.segments.select({ kind: 'region', region: 'jeju' }), ['u-3'])
  assert.throws(() => shop.segments.select({ kind: 'rich' }), errorCode('BAD_SEGMENT'))
})

test('때가 된 캠페인을 보내고 센다', () => {
  const shop = setup()
  atKst(shop, '2026-03-03 10:00')
  shop.campaigns.create({ title: '봄 세일', text: '전 품목 10%', segment: { kind: 'all' }, sendAt: '2026-03-03T03:00:00Z' })
  assert.deepEqual(shop.campaigns.runDue(), [])
  atKst(shop, '2026-03-03 12:00')
  const [ran] = shop.campaigns.runDue()
  assert.deepEqual(ran.counts, { 'email.sent': 3, 'sms.sent': 2, 'sms.skipped': 1 })
  assert.deepEqual(shop.campaigns.runDue(), [])
})

test('밤에 보낸 캠페인의 문자는 아침으로 미뤄진다', () => {
  const shop = setup()
  atKst(shop, '2026-03-03 23:00')
  shop.campaigns.create({ title: '야간 특가', text: '오늘만', segment: { kind: 'all' }, sendAt: '2026-03-03T14:00:00Z' })
  const [ran] = shop.campaigns.runDue()
  assert.equal(ran.counts['sms.deferred'], 2)
})

test('캠페인 취소', () => {
  const shop = setup()
  const c = shop.campaigns.create({ title: 't', text: 'x', segment: { kind: 'vip' }, sendAt: '2026-03-03T00:00:00Z' })
  shop.campaigns.cancel(c.id)
  assert.throws(() => shop.campaigns.cancel(c.id), errorCode('BAD_CAMPAIGN'))
  assert.throws(() => shop.campaigns.create({ title: 't', text: 'x', segment: { kind: 'all' }, sendAt: 'soon' }), errorCode('BAD_CAMPAIGN'))
})
