import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paidOrder, shop } from './shop-setup.js'

test('일부 취소의 쿠폰 몫도 반올림: 환불, 전표, 상담 요약, 월간 매출이 같은 금액', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  const { refund } = s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  // 5,000 × 12,000 / 42,000 = 1,428.57 → 1,429
  assert.equal(refund, 10571)
  const invoice = s.billing.invoiceForOrder(o.id)
  assert.deepEqual(s.billing.creditNotesFor(invoice.id).map((c) => c.amount), [10571])
  assert.equal(s.orders.supportSummary(o.id).split('\n')[3], '환불 10,571원')
  assert.equal(s.billing.monthlyReport('2026-03').credited, 10571)
  assert.equal(s.orders.cancelOrder(o.id).refund, o.total - 10571)
})

test('수량 일부와 퍼센트 쿠폰', () => {
  const s = shop()
  const a = paidOrder(s, 'c-1', [['MUG', 3], ['PEN', 1]], { coupon: 'SPRING5' })
  // 5,000 × 24,000 / 38,000 = 3,157.89 → 3,158
  assert.equal(s.orders.cancelLines(a.id, [{ sku: 'MUG', qty: 2 }]).refund, 20842)
  const b = paidOrder(s, 'c-1', [['SOAP', 1], ['PEN', 1]], { coupon: 'TEN' })
  // 할인 round(1,434.5) = 1,435. 몫 1,435 × 2,000 / 14,345 = 200.07 → 200
  assert.equal(b.discount, 1435)
  assert.equal(s.orders.cancelLines(b.id, [{ sku: 'PEN', qty: 1 }]).refund, 1800)
})
