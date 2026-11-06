import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paidOrder, shop } from './shop-setup.js'

const issue = (s, amount, taxClass = 'standard') =>
  s.billing.issueManualInvoice({ customerId: 'c-1', lines: [{ name: '납품', amount, taxClass }] })

test('월간 매출: 송장 합, 전표 합, 순매출, 부가세', () => {
  const s = shop('2026-03-10T03:00:00Z')
  issue(s, 55000)
  issue(s, 22000, 'exempt')
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  const invoices = s.billing.listInvoices()
  const notes = s.billing.listCreditNotes()
  const r = s.billing.monthlyReport('2026-03')
  assert.equal(r.month, '2026-03')
  assert.equal(r.invoices, 3)
  assert.equal(r.invoiced, 55000 + 22000 + o.total)
  assert.equal(r.creditNotes, 1)
  assert.equal(r.credited, 10572)
  assert.equal(r.net, r.invoiced - 10572)
  const vat = invoices.reduce((sum, i) => sum + i.vat, 0) - notes.reduce((sum, c) => sum + c.vat, 0)
  assert.equal(r.vat, vat)
})

test('무효 송장은 빼고, 대손 송장은 넣는다', () => {
  const s = shop('2026-03-10T03:00:00Z')
  const a = issue(s, 11000)
  const b = issue(s, 33000)
  issue(s, 44000)
  s.billing.voidInvoice(a.id, '중복')
  s.billing.writeOff(b.id, '폐업')
  const r = s.billing.monthlyReport('2026-03')
  assert.equal(r.invoices, 2)
  assert.equal(r.invoiced, 77000)
  assert.equal(r.vat, 7000)
})

test('다른 달의 것은 넣지 않는다', () => {
  const s = shop('2026-03-10T03:00:00Z')
  const o = paidOrder(s, 'c-1', [['TEA', 1]])
  s.clock.set('2026-04-02T03:00:00Z')
  s.orders.cancelOrder(o.id)
  issue(s, 11000)
  const march = s.billing.monthlyReport('2026-03')
  const april = s.billing.monthlyReport('2026-04')
  assert.deepEqual([march.invoices, march.creditNotes, march.invoiced], [1, 0, 33000])
  assert.deepEqual([april.invoices, april.creditNotes, april.invoiced, april.credited, april.net], [1, 1, 11000, 33000, -22000])
})
