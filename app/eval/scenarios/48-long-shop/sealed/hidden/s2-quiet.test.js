import assert from 'node:assert/strict'
import { test } from 'node:test'
import { atKst, paidOrder, shop, to } from './shop-setup.js'

test('방해 금지 시간의 광고 알림톡은 아침 7시로 미뤘다가 알림톡으로 보낸다', () => {
  const s = shop()
  s.preferences.set('c-1', { kakao: true })
  atKst(s, '2026-03-03 23:00')
  s.notifier.sendPromo(['c-1'], { title: '봄 세일', text: '10%' })
  assert.equal(s.channels.kakao.sent.length, 0)
  assert.deepEqual(s.notifier.pending().map((m) => m.dueAt), ['2026-03-03T22:00:00.000Z'])
  atKst(s, '2026-03-04 07:00')
  s.notifier.flush()
  assert.equal(to(s.channels.kakao, '010-1234-5678').length, 1)
  assert.equal(to(s.channels.sms, '010-1234-5678').length, 0)
  assert.equal(s.notifier.pending().length, 0)
})

test('방해 금지 시간의 돈 알림은 메일만, 알림톡도 보내지 않는다', () => {
  const s = shop()
  s.preferences.set('c-1', { kakao: true })
  atKst(s, '2026-03-03 14:00')
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  atKst(s, '2026-03-03 23:30')
  const talks = s.channels.kakao.sent.length
  s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  assert.ok(to(s.channels.email, 'hana@example.com').some((m) => m.body.includes('10,572원')))
  assert.equal(s.channels.kakao.sent.length, talks)
  assert.equal(s.notifier.pending().length, 0)
})

test('미뤄 둔 문자는 그대로 문자로 간다', () => {
  const s = shop()
  atKst(s, '2026-03-03 23:00')
  s.notifier.sendPromo(['c-1', 'c-4'], { title: '봄 세일', text: '10%' })
  s.preferences.set('c-4', { kakao: true })
  s.notifier.sendPromo(['c-4'], { title: '두 번째', text: '20%' })
  atKst(s, '2026-03-04 07:00')
  s.notifier.flush()
  assert.equal(to(s.channels.sms, '010-1234-5678').length, 1)
  assert.equal(to(s.channels.sms, '010-3030-4040').length, 1)
  assert.equal(to(s.channels.kakao, '010-3030-4040').length, 1)
})
