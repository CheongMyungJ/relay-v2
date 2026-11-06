import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paidOrder, shop } from './shop-setup.js'

const lines = (text) => text.split('\n').map((l) => l.trim())

test('송장 글과 전표 글의 음수는 괄호', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  const invoice = s.billing.invoiceForOrder(o.id)
  const inv = lines(s.billing.renderInvoice(invoice.id))
  assert.ok(inv.includes('할인(SPRING5)  (5,000원)'), inv.join('\n'))
  const [note] = s.billing.creditNotesFor(invoice.id)
  const cn = lines(s.billing.renderCreditNote(note.id))
  assert.ok(cn.includes(`금액  (${note.amount.toLocaleString('en-US')}원)`), cn.join('\n'))
  assert.ok(cn.includes(`부가세  (${note.vat.toLocaleString('en-US')}원)`), cn.join('\n'))
  assert.ok(inv.includes(`전표  (${note.amount.toLocaleString('en-US')}원)`), inv.join('\n'))
  assert.ok(inv.includes('합계  40,000원'))
})

test('명세서의 전표, 입금, 음수 잔액은 괄호', () => {
  const s = shop()
  const a = s.billing.issueManualInvoice({ customerId: 'c-1', lines: [{ name: '납품', amount: 50000 }] })
  s.billing.recordReceipt(a.id, 50000)
  s.billing.issueCreditNote({ invoiceId: a.id, amount: 5000, reason: '불량' })
  const st = s.billing.statementFor('c-1', { from: '2026-03-01T00:00:00Z', to: '2026-04-01T00:00:00Z' })
  const text = s.billing.renderStatement(st)
  assert.match(text, /입금 \S+ {2}\(50,000원\)/)
  assert.match(text, /전표 \S+ {2}\(5,000원\)/)
  assert.match(text, /기말 잔액 {2}\(5,000원\)/)
  assert.match(text, /송장 \S+ {2}50,000원/)
  assert.doesNotMatch(text, /-[\d,]+원/)
})

test('월간 매출 글의 전표와 음수 순매출은 괄호', () => {
  const s = shop('2026-03-10T03:00:00Z')
  const o = paidOrder(s, 'c-1', [['TEA', 1]])
  s.clock.set('2026-04-02T03:00:00Z')
  s.orders.cancelOrder(o.id)
  s.billing.issueManualInvoice({ customerId: 'c-1', lines: [{ name: '납품', amount: 11000 }] })
  const rows = s.billing.monthlyReportText('2026-04').split('\n')
  assert.deepEqual(rows.slice(1, 4), ['송장 1건 11,000원', '전표 1건 (33,000원)', '순매출 (22,000원)'])
  assert.equal(s.billing.monthlyReportText('2026-03').split('\n')[2], '전표 0건 0원')
})
