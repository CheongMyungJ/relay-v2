import { test } from 'node:test'
import assert from 'node:assert'
import { draftInvoiceFor } from '../src/invoice/from-customer.js'
import { createInvoice, invoiceTotals, issueInvoice, markPaid, voidInvoice } from '../src/invoice/invoice.js'
import { canTransition } from '../src/invoice/status.js'

const lines = [
  { name: '포스트잇', unitPrice: 1450, qty: 10 },
  { name: '물티슈', unitPrice: 1990, qty: 5 },
]

test('초안 만들기', () => {
  const inv = createInvoice({ customerId: 'C-7', lines })
  assert.strictEqual(inv.status, 'draft')
  assert.strictEqual(inv.number, null)
  assert.strictEqual(inv.lines.length, 2)
  assert.throws(() => createInvoice({ customerId: 'C-7', lines: [] }), /품목/)
  assert.throws(() => createInvoice({ lines }), /고객/)
  assert.throws(() => createInvoice({ customerId: 'C-7', lines, issueDate: '2026-02-30' }), /날짜/)
})

test('발행하면 합계를 저장한다', () => {
  const inv = issueInvoice(createInvoice({ customerId: 'C-7', lines }), {
    number: 'INV-0100',
    issueDate: '2026-09-01',
  })
  assert.strictEqual(inv.status, 'issued')
  assert.strictEqual(inv.totals.total, 26895)
  assert.strictEqual(invoiceTotals(inv), inv.totals)
  assert.throws(() => issueInvoice(inv, { number: 'INV-0101', issueDate: '2026-09-02' }))
})

test('발행된 청구서는 저장된 합계를 쓴다', () => {
  const inv = issueInvoice(createInvoice({ customerId: 'C-7', lines }), {
    number: 'INV-0100',
    issueDate: '2026-09-01',
  })
  const stored = { ...inv, totals: { ...inv.totals, vat: 2444, total: 26894 } }
  assert.strictEqual(invoiceTotals(stored).total, 26894)
})

test('입금과 취소', () => {
  const issued = issueInvoice(createInvoice({ customerId: 'C-7', lines }), {
    number: 'INV-0100',
    issueDate: '2026-09-01',
  })
  assert.throws(() => markPaid(issued, { paidAt: '2026-09-10', amount: 20000 }), /입금액/)
  const paid = markPaid(issued, { paidAt: '2026-09-10', amount: 26895 })
  assert.strictEqual(paid.status, 'paid')
  assert.throws(() => voidInvoice(paid, '중복'))
  assert.strictEqual(voidInvoice(issued, '중복 발행').status, 'void')
  assert.strictEqual(canTransition('void', 'issued'), false)
})

test('고객 정보로 초안 만들기', () => {
  const customer = { id: 'C-0520', name: 'Pacific Trade', grade: 'C', zeroRated: true }
  const inv = draftInvoiceFor(customer, { lines, issueDate: '2026-09-20' })
  assert.strictEqual(inv.zeroRated, true)
  assert.strictEqual(inv.dueDate, '2026-10-05')
  assert.strictEqual(invoiceTotals(inv).vat, 0)
})
