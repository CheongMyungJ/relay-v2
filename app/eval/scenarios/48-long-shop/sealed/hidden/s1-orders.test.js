import assert from 'node:assert/strict'
import { test } from 'node:test'
import { quote, quoteText } from '../src/orders/pricing.js'
import { cart, paidOrder, shop } from './shop-setup.js'

test('장바구니 요약의 할인은 괄호', () => {
  const s = shop()
  const q = quote(cart(s, [['MUG', 1], ['TEA', 1]]).lines(), { coupon: { code: 'SPRING5', discount: 5000 } })
  const rows = quoteText(q).split('\n')
  assert.ok(rows.includes('할인(SPRING5)  (5,000원)'), rows.join('\n'))
  assert.ok(rows.includes('합계  40,000원'))
  assert.ok(!rows.some((r) => r.includes('-')))
})

test('상담 요약의 할인은 괄호, 양수와 0은 그대로', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  assert.equal(s.orders.supportSummary(o.id).split('\n')[2], '상품 42,000원 · 할인 (5,000원) · 배송비 3,000원 · 합계 40,000원')
  const v = paidOrder(s, 'c-1', [['TEA', 2]])
  assert.equal(s.orders.supportSummary(v.id).split('\n')[2], '상품 60,000원 · 배송비 0원 · 합계 60,000원')
})
