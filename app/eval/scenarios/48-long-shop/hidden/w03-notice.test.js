import assert from 'node:assert/strict'
import { test } from 'node:test'
import { atKst, paidOrder, placed, shop, to } from './shop-setup.js'

const mentions = (list, ...words) => list.filter((m) => words.every((w) => (m.body ?? '').includes(w)))

/** fn을 부른 뒤 새로 보낸 메일과 문자 */
function after(s, fn) {
  const e = s.channels.email.sent.length
  const m = s.channels.sms.sent.length
  fn()
  return { email: s.channels.email.sent.slice(e), sms: s.channels.sms.sent.slice(m) }
}

test('일부 취소의 환불 금액을 메일과 문자로 알린다', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  const sent = after(s, () => s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }]))
  assert.ok(mentions(to(sent.email, 'hana@example.com'), o.number, '10,572원').length >= 1)
  assert.equal(mentions(to(sent.sms, '010-1234-5678'), o.number, '10,572원').length, 1)
})

test('주문 전체 취소도 환불 금액을 알린다', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  const o = paidOrder(s, 'c-1', [['TEA', 1], ['PEN', 1]])
  let refund
  const sent = after(s, () => ({ refund } = s.orders.cancelOrder(o.id)))
  const amount = `${refund.toLocaleString('en-US')}원`
  assert.ok(mentions(to(sent.email, 'hana@example.com'), o.number, amount).length >= 1)
  assert.equal(mentions(to(sent.sms, '010-1234-5678'), o.number, amount).length, 1)
})

test('일부 취소 뒤 나머지를 취소하면 그때의 환불 금액', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  const sent = after(s, () => s.orders.cancelOrder(o.id))
  const rest = `${(o.total - 10572).toLocaleString('en-US')}원`
  assert.equal(mentions(to(sent.sms, '010-1234-5678'), o.number, rest).length, 1)
})

test('문자를 받지 않기로 한 고객에게는 메일만', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  s.preferences.set('c-1', { sms: false })
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  const sent = after(s, () => s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }]))
  assert.ok(mentions(to(sent.email, 'hana@example.com'), '10,572원').length >= 1)
  assert.equal(sent.sms.length, 0)
  assert.equal(s.notifier.pending().length, 0)
})

test('결제 전 주문의 일부 취소는 환불 금액 알림이 없다', () => {
  const s = shop()
  atKst(s, '2026-03-03 14:00')
  const o = placed(s, 'c-1', [['MUG', 1], ['PEN', 1]])
  const sent = after(s, () => s.orders.cancelLines(o.id, [{ sku: 'PEN', qty: 1 }]))
  assert.equal(mentions([...sent.email, ...sent.sms], '원').length, 0)
})
