import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paidOrder, placed, shop } from './shop-setup.js'

test('일부 취소에도 반품 전표가 나오고 금액은 환불과 같다', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  const invoice = s.billing.invoiceForOrder(o.id)
  const { refund } = s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  assert.deepEqual(s.billing.creditNotesFor(invoice.id).map((c) => c.amount), [refund])
  assert.equal(refund, 10572)
})

test('나머지를 취소하면 두 번째 전표, 전표 합은 환불 합', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 3], ['PEN', 1], ['TEA', 1]], { coupon: 'TEN' })
  const invoice = s.billing.invoiceForOrder(o.id)
  const a = s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 2 }]).refund
  const b = s.orders.cancelOrder(o.id).refund
  const notes = s.billing.creditNotesFor(invoice.id)
  assert.deepEqual(notes.map((c) => c.amount), [a, b])
  assert.equal(a + b, o.total)
  assert.equal(s.orders.getOrder(o.id).refunded, o.total)
})

test('결제 전 주문의 일부 취소는 전표가 없다', () => {
  const s = shop()
  const o = placed(s, 'c-1', [['MUG', 1], ['PEN', 1]])
  s.orders.cancelLines(o.id, [{ sku: 'PEN', qty: 1 }])
  assert.equal(s.billing.listCreditNotes().length, 0)
})
