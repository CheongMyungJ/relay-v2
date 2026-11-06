import assert from 'node:assert/strict'
import { test } from 'node:test'
import { atKst, hasCode, placed, shop, to } from './shop-setup.js'

test('방해 금지 시간의 결제 실패 알림은 메일만', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  const o = placed(s, 'c-1', [['MUG', 1], ['TEA', 1]])
  atKst(s, '2026-03-03 23:30')
  const smsBefore = to(s.channels.sms, '010-1234-5678').length
  const mailBefore = to(s.channels.email, 'hana@example.com').length
  assert.throws(() => s.orders.pay(o.id, { cardToken: 'tok-declined' }), hasCode('PAYMENT_FAILED'))
  assert.equal(to(s.channels.email, 'hana@example.com').length, mailBefore + 1)
  assert.equal(to(s.channels.sms, '010-1234-5678').length, smsBefore)
  assert.equal(s.notifier.pending().length, 0)
})
