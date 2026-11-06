import assert from 'node:assert/strict'
import { test } from 'node:test'
import { atKst, paidOrder, shop, to } from './shop-setup.js'

test('환불 문자는 방해 금지 시간에도 바로 보낸다', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  atKst(s, '2026-03-03 23:00')
  s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  assert.equal(to(s.channels.sms, '010-1234-5678').filter((m) => m.body.includes('10,572원')).length, 1)
  assert.equal(s.notifier.pending().filter((m) => m.body.includes('10,572원')).length, 0)
})

test('광고 문자는 그대로 아침으로 미룬다', () => {
  const s = shop()
  atKst(s, '2026-03-03 23:00')
  s.notifier.sendPromo(['c-1'], { title: '봄 세일', text: '10%' })
  assert.equal(to(s.channels.sms, '010-1234-5678').length, 0)
  assert.equal(s.notifier.pending().length, 1)
})
