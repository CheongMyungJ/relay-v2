import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isQuiet, quietEnds } from '../src/notifications/quiet-hours.js'
import { atKst, cartOf, placePaid, setup } from './helpers.js'

test('주문을 받으면 메일과 문자를 보낸다', () => {
  const shop = setup('2026-03-02T05:00:00Z')
  shop.orders.placeOrder({ customerId: 'u-1', cart: cartOf(shop, [['MUG', 1]]) })
  const [mail] = shop.channels.email.sent
  assert.equal(mail.to, 'yuna@example.com')
  assert.equal(mail.subject, '주문 A-1001이 접수됐어요')
  assert.match(mail.body, /결제할 금액: 15,000원/)
  assert.equal(shop.channels.sms.sent[0].body, '[샵] 주문 A-1001 접수, 15,000원')
})

test('영어 사용자는 영어 문구', () => {
  const shop = setup('2026-03-02T05:00:00Z')
  shop.orders.placeOrder({ customerId: 'u-2', cart: cartOf(shop, [['MUG', 1]]) })
  assert.equal(shop.channels.email.sent[0].subject, 'Order A-1001 received')
})

test('전화번호가 없거나 받지 않기로 한 채널은 건너뛴다', () => {
  const shop = setup('2026-03-02T05:00:00Z')
  const r1 = shop.notifier.notify('u-3', 'order.cancelled', { number: 'A-1' })
  assert.deepEqual(r1[1], { channel: 'sms', status: 'skipped', reason: 'no-phone' })
  shop.preferences.set('u-1', { email: false })
  const r2 = shop.notifier.notify('u-1', 'order.cancelled', { number: 'A-2' })
  assert.deepEqual(r2.map((r) => r.status), ['skipped', 'sent'])
})

test('배송 시작 알림', () => {
  const shop = setup('2026-03-02T05:00:00Z')
  const order = placePaid(shop, 'u-1', [['TEA', 1]])
  shop.orders.ship(order.id, { carrier: 'cj', trackingNo: '5521' })
  assert.equal(shop.channels.sms.sent.at(-1).body, '[샵] 주문 A-1001 출발 (cj 5521)')
})

test('방해 금지 시간에는 문자를 아침으로 미룬다', () => {
  const shop = setup()
  atKst(shop, '2026-03-03 22:30')
  shop.orders.placeOrder({ customerId: 'u-1', cart: cartOf(shop, [['MUG', 1]]) })
  assert.equal(shop.channels.email.sent.length, 1)
  assert.equal(shop.channels.sms.sent.length, 0)
  const [pending] = shop.notifier.pending()
  assert.equal(pending.dueAt, '2026-03-03T23:00:00.000Z')
  atKst(shop, '2026-03-04 07:59')
  assert.equal(shop.notifier.flush(), 0)
  atKst(shop, '2026-03-04 08:00')
  assert.equal(shop.notifier.flush(), 1)
  assert.equal(shop.channels.sms.sent.length, 1)
  assert.equal(shop.notifier.pending().length, 0)
})

test('방해 금지 시간의 경계', () => {
  assert.equal(isQuiet('2026-03-03T11:59:00Z'), false) // 20:59
  assert.equal(isQuiet('2026-03-03T12:00:00Z'), true) // 21:00
  assert.equal(isQuiet('2026-03-03T22:59:00Z'), true) // 07:59
  assert.equal(quietEnds('2026-03-03T17:00:00Z').toISOString(), '2026-03-03T23:00:00.000Z') // 02:00 → 08:00
})

test('광고는 광고 수신을 끈 고객에게 가지 않는다', () => {
  const shop = setup('2026-03-02T05:00:00Z')
  shop.preferences.set('u-2', { marketing: false })
  const res = shop.notifier.sendPromo(['u-1', 'u-2'], { title: '봄맞이 할인', text: '차 세트 20%' })
  assert.deepEqual(res[1].results.map((r) => r.reason), ['opted-out', 'opted-out'])
  assert.equal(shop.channels.sms.sent[0].body, '(광고)[샵] 봄맞이 할인 수신거부 080-000-0000')
})

test('후불 송장과 독촉은 알림이 간다(카드 결제 송장은 가지 않는다)', () => {
  const shop = setup('2026-03-02T05:00:00Z')
  placePaid(shop, 'u-1', [['MUG', 1]])
  const before = shop.channels.email.sent.length
  const invoice = shop.billing.issueManualInvoice({ customerId: 'u-1', lines: [{ name: '납품', amount: 55000 }] })
  assert.equal(shop.channels.email.sent.length, before + 1)
  assert.match(shop.channels.email.sent.at(-1).body, /금액: 55,000원\n납부 기한: 2026-03-16/)
  shop.clock.set('2026-03-24T05:00:00Z')
  shop.billing.sendReminders()
  assert.equal(shop.channels.email.sent.at(-1).subject, `송장 ${invoice.number} 납부 안내`)
})

test('알림 기록', () => {
  const shop = setup('2026-03-02T05:00:00Z')
  shop.orders.placeOrder({ customerId: 'u-1', cart: cartOf(shop, [['MUG', 1]]) })
  assert.deepEqual(shop.notifier.log({ customerId: 'u-1' }).map((n) => n.type), ['order.placed'])
})

test('긴 문자는 장문으로 간다', () => {
  const shop = setup('2026-03-02T05:00:00Z')
  shop.notifier.sendPromo(['u-1'], { title: '봄맞이 '.repeat(20).trim(), text: 'x' })
  assert.equal(shop.channels.sms.sent[0].kind, 'lms')
})

test('영어 독촉 문구', () => {
  const shop = setup('2026-03-02T05:00:00Z')
  const invoice = shop.billing.issueManualInvoice({ customerId: 'u-2', lines: [{ name: 'Supply', amount: 55000 }] })
  shop.clock.set('2026-03-24T05:00:00Z')
  shop.billing.sendReminders()
  assert.equal(shop.channels.email.sent.at(-1).subject, `Invoice ${invoice.number} is overdue`)
  assert.match(shop.channels.email.sent.at(-1).body, /7 days overdue/)
})
