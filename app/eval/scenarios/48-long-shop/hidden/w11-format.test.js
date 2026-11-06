import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paidOrder, placed, shop } from './shop-setup.js'

const rows = (s, id) => s.orders.supportSummary(id).split('\n')

test('상담 요약: 상태, 고객, 금액, 환불', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  const r = rows(s, o.id)
  assert.equal(r.length, 4)
  assert.equal(r[0], `주문 ${o.number} · 결제 완료`)
  assert.ok(r[1].startsWith('고객 김하나 · '))
  assert.equal(r[2], '상품 42,000원 · 할인 -5,000원 · 배송비 3,000원 · 합계 40,000원')
  assert.equal(r[3], '환불 10,572원')
})

test('할인이 없으면 할인 칸을 빼고, 환불이 없으면 마지막 줄을 뺀다', () => {
  const s = shop()
  const o = placed(s, 'c-1', [['TEA', 2]])
  const r = rows(s, o.id)
  assert.equal(r.length, 3)
  assert.equal(r[0], `주문 ${o.number} · 접수`)
  assert.equal(r[2], '상품 60,000원 · 배송비 0원 · 합계 60,000원')
})

test('상태 이름과 환불 합', () => {
  const s = shop()
  const a = paidOrder(s, 'c-1', [['MUG', 1]])
  s.orders.ship(a.id)
  assert.equal(rows(s, a.id)[0], `주문 ${a.number} · 배송 중`)
  s.orders.deliver(a.id)
  assert.equal(rows(s, a.id)[0], `주문 ${a.number} · 배송 완료`)
  const b = paidOrder(s, 'c-3', [['MUG', 1], ['PEN', 1]])
  s.orders.cancelLines(b.id, [{ sku: 'PEN', qty: 1 }])
  s.orders.cancelOrder(b.id)
  const r = rows(s, b.id)
  assert.equal(r[0], `주문 ${b.number} · 취소`)
  assert.equal(r[3], `환불 ${b.total.toLocaleString('en-US')}원`)
})
