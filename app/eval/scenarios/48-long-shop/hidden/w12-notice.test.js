import assert from 'node:assert/strict'
import { test } from 'node:test'
import { atKst, hasCode, placed, shop, to } from './shop-setup.js'

function failPay(s, o, card = 'tok-declined') {
  const e = s.channels.email.sent.length
  const m = s.channels.sms.sent.length
  assert.throws(() => s.orders.pay(o.id, { cardToken: card }), hasCode('PAYMENT_FAILED'))
  return { email: s.channels.email.sent.slice(e), sms: s.channels.sms.sent.slice(m) }
}

test('결제가 실패하면 주문번호와 금액을 메일과 문자로 알린다', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  const o = placed(s, 'c-1', [['MUG', 1], ['TEA', 1]])
  const sent = failPay(s, o)
  assert.equal(to(sent.email, 'hana@example.com').filter((m) => m.body.includes(o.number) && m.body.includes('45,000원')).length, 1)
  assert.equal(to(sent.sms, '010-1234-5678').filter((m) => m.body.includes(o.number) && m.body.includes('45,000원')).length, 1)
})

test('기한 지난 카드도, 영어 고객은 영어 금액으로', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  const o = placed(s, 'c-2', [['MUG', 1], ['TEA', 1]])
  const sent = failPay(s, o, 'tok-expired')
  assert.ok(to(sent.email, 'alex@example.com').some((m) => m.body.includes('KRW 45,000')))
  assert.ok(to(sent.sms, '010-9876-4321').some((m) => m.body.includes('KRW 45,000')))
})

test('결제가 되면 실패 알림은 없다', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  const o = placed(s, 'c-1', [['MUG', 1]])
  const e = s.channels.email.sent.length
  s.orders.pay(o.id, { cardToken: 'tok-ok' })
  assert.equal(s.channels.email.sent.length, e)
})
