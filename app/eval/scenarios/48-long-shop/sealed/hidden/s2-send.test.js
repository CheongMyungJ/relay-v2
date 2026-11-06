import assert from 'node:assert/strict'
import { test } from 'node:test'
import { atKst, paidOrder, placed, shop, to } from './shop-setup.js'

test('알림톡을 켠 고객에게는 문자 대신 알림톡으로, 본문은 문자와 같다', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  placed(s, 'c-2', [['MUG', 1]])
  const smsBody = to(s.channels.sms, '010-9876-4321').at(-1).body
  s.preferences.set('c-2', { kakao: true })
  placed(s, 'c-2', [['MUG', 1]])
  const [talk] = to(s.channels.kakao, '010-9876-4321')
  assert.equal(talk.body, smsBody.replace('A-1001', 'A-1002'))
  assert.equal(to(s.channels.sms, '010-9876-4321').length, 1)
  assert.equal(to(s.channels.email, 'alex@example.com').length, 2)
})

test('환불과 결제 실패도 알림톡으로', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  s.preferences.set('c-1', { kakao: true })
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  const p = placed(s, 'c-1', [['PEN', 1]])
  assert.throws(() => s.orders.pay(p.id, { cardToken: 'tok-declined' }))
  const talks = to(s.channels.kakao, '010-1234-5678').map((m) => m.body)
  assert.ok(talks.some((b) => b.includes(o.number) && b.includes('10,572원')))
  assert.ok(talks.some((b) => b.includes(p.number) && b.includes('5,000원')))
  assert.equal(to(s.channels.sms, '010-1234-5678').length, 0)
})

test('알림톡도 수신 거부와 광고 수신 거부를 따른다', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  s.preferences.set('c-1', { kakao: true, marketing: false })
  s.notifier.sendPromo(['c-1'], { title: '봄 세일', text: '10%' })
  assert.equal(to(s.channels.kakao, '010-1234-5678').length, 0)
  assert.equal(to(s.channels.sms, '010-1234-5678').length, 0)
  s.preferences.set('c-1', { sms: false })
  placed(s, 'c-1', [['MUG', 1]])
  assert.equal(to(s.channels.kakao, '010-1234-5678').length, 0)
  assert.equal(to(s.channels.sms, '010-1234-5678').length, 0)
})

test('전화번호가 없으면 알림톡도 없다, 알림톡을 끄면 다시 문자', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  s.customers.register({ id: 'c-9', name: '전화 없음', email: 'none@example.com' })
  s.preferences.set('c-9', { kakao: true })
  placed(s, 'c-9', [['MUG', 1]])
  assert.equal(s.channels.kakao.sent.length, 0)
  s.preferences.set('c-1', { kakao: true })
  s.preferences.set('c-1', { kakao: false })
  placed(s, 'c-1', [['MUG', 1]])
  assert.equal(to(s.channels.sms, '010-1234-5678').length, 1)
  assert.equal(s.channels.kakao.sent.length, 0)
})
