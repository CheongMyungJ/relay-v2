import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paidOrder, shop } from './shop-setup.js'

test('전표 번호는 CN-연도-다섯 자리, 해마다 00001부터', () => {
  const s = shop()
  const a = paidOrder(s, 'c-1', [['TEA', 1]])
  s.orders.cancelOrder(a.id)
  const b = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]])
  s.orders.cancelLines(b.id, [{ sku: 'MUG', qty: 1 }])
  s.clock.set('2027-01-12T01:00:00Z')
  const c = paidOrder(s, 'c-3', [['MUG', 1], ['PEN', 1]])
  s.orders.cancelLines(c.id, [{ sku: 'PEN', qty: 1 }])
  assert.deepEqual(
    s.billing.listCreditNotes().map((n) => n.number),
    ['CN-2026-00001', 'CN-2026-00002', 'CN-2027-00001'],
  )
})

test('전표 번호와 송장 번호는 따로 센다', () => {
  const s = shop()
  s.billing.issueManualInvoice({ customerId: 'c-1', lines: [{ name: '납품', amount: 11000 }] })
  const o = paidOrder(s, 'c-1', [['TEA', 1]])
  s.orders.cancelOrder(o.id)
  assert.equal(s.billing.invoiceForOrder(o.id).number, 'INV-2026-00002')
  assert.equal(s.billing.listCreditNotes()[0].number, 'CN-2026-00001')
})
