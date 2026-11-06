import assert from 'node:assert/strict'
import { test } from 'node:test'
import { atKst, paidOrder, placed, shop, to } from './shop-setup.js'

test('영어 메일과 문자의 금액은 KRW 12,300 꼴', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  placed(s, 'c-2', [['MUG', 1], ['TEA', 1]]) // 42,000 + 배송비 3,000
  const [mail] = to(s.channels.email, 'alex@example.com')
  const [sms] = to(s.channels.sms, '010-9876-4321')
  assert.match(mail.body, /KRW 45,000/)
  assert.match(sms.body, /KRW 45,000/)
})

test('영어 환불 알림과 후불 송장', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  const o = paidOrder(s, 'c-2', [['MUG', 2], ['TEA', 1]])
  s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  assert.ok(to(s.channels.sms, '010-9876-4321').some((m) => m.body.includes('KRW 12,000')))
  s.billing.issueManualInvoice({ customerId: 'c-2', lines: [{ name: 'Supply', amount: 1234567 }] })
  assert.match(to(s.channels.email, 'alex@example.com').at(-1).body, /KRW 1,234,567/)
})

test('영어 알림에는 "원"이 없고, 한국어 알림은 그대로', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  const en = paidOrder(s, 'c-2', [['TEA', 1]])
  s.orders.cancelOrder(en.id)
  const ko = paidOrder(s, 'c-1', [['TEA', 1]])
  s.orders.cancelOrder(ko.id)
  const english = [...to(s.channels.email, 'alex@example.com'), ...to(s.channels.sms, '010-9876-4321')]
  assert.ok(english.length >= 3)
  for (const m of english) assert.doesNotMatch(m.body, /원/)
  assert.ok(to(s.channels.sms, '010-1234-5678').some((m) => m.body.includes('33,000원')))
})
