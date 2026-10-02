import { test } from 'node:test'
import assert from 'node:assert'
import { creditNoteEntries, ledger } from '../src/export/ledger.js'
import { createCreditNote, creditNoteTotals, returnedDiscount } from '../src/invoice/credit-note.js'
import { createInvoice, issueInvoice } from '../src/invoice/invoice.js'

const inv = issueInvoice(
  createInvoice({
    customerId: 'C-0412',
    lines: [
      { sku: 'OF-1450', name: '포스트잇', unitPrice: 1450, qty: 10 },
      { sku: 'OF-1990', name: '물티슈', unitPrice: 1990, qty: 5, discount: { amount: 500 } },
      { sku: 'BK-1800', name: '실무 핸드북', unitPrice: 18000, qty: 2, taxType: 'exempt' },
    ],
  }),
  { number: 'INV-0100', issueDate: '2026-09-01' },
)

const note = (returns, extra = {}) =>
  createCreditNote(inv, { number: 'CN-0001', issueDate: '2026-09-10', reason: '파손', returns, ...extra })

test('반품 전표 만들기', () => {
  const cn = note([
    { sku: 'OF-1450', qty: 4 },
    { sku: 'BK-1800', qty: 1 },
  ])
  assert.strictEqual(cn.invoiceNumber, 'INV-0100')
  assert.strictEqual(cn.customerId, 'C-0412')
  assert.deepStrictEqual(
    cn.lines.map((l) => [l.sku, l.qty, l.origQty]),
    [
      ['OF-1450', 4, 10],
      ['BK-1800', 1, 2],
    ],
  )
  assert.deepStrictEqual(cn.totals, { supply: 23800, taxable: 5800, exempt: 18000, vat: 580, total: 24380 })
})

test('같은 품목을 두 번 적으면 수량을 더한다', () => {
  const cn = note([
    { sku: 'OF-1450', qty: 2 },
    { sku: 'OF-1450', qty: 3 },
  ])
  assert.strictEqual(cn.lines.length, 1)
  assert.strictEqual(cn.lines[0].qty, 5)
  assert.strictEqual(cn.totals.total, 7975)
})

test('돌려받는 줄의 할인', () => {
  const line = { unitPrice: 1990, qty: 2, origQty: 5, discount: { amount: 500 } }
  assert.strictEqual(returnedDiscount(line), 200)
  assert.strictEqual(returnedDiscount({ ...line, qty: 5 }), 500)
  assert.strictEqual(returnedDiscount({ unitPrice: 1450, qty: 3, origQty: 10, discount: { percent: 10 } }), 435)
  assert.strictEqual(returnedDiscount({ unitPrice: 1450, qty: 3, origQty: 10 }), 0)
  assert.strictEqual(note([{ sku: 'OF-1990', qty: 5 }]).totals.supply, 9450)
})

test('반품 확인', () => {
  assert.throws(() => note([{ sku: 'OF-1450', qty: 11 }]), /많다/)
  assert.throws(() => note([{ sku: 'NO-0000', qty: 1 }]), /없는 품목/)
  assert.throws(() => note([]), /품목이 없다/)
  assert.throws(() => note([{ sku: 'OF-1450', qty: 1 }], { reason: '' }), /사유/)
  assert.throws(() => note([{ sku: 'OF-1450', qty: 1 }], { number: '0001' }), /CN-/)
  assert.throws(() => createCreditNote(createInvoice({ customerId: 'C-1', lines: [{ name: '볼펜', unitPrice: 300 }] }), {}), /발행/)
})

test('반품 전표 분개', () => {
  const cn = note([{ sku: 'OF-1450', qty: 2 }])
  assert.deepStrictEqual(
    creditNoteEntries(cn).map((e) => [e.account, e.debit, e.credit]),
    [
      ['매출환입', 2900, 0],
      ['부가세예수금', 290, 0],
      ['외상매출금', 0, 3190],
    ],
  )
  const stored = { ...cn, totals: { ...cn.totals, vat: 289, total: 3189 } }
  assert.strictEqual(creditNoteTotals(stored).total, 3189)
  assert.deepStrictEqual(
    ledger([inv], [cn]).map((e) => e.ref),
    ['INV-0100', 'INV-0100', 'INV-0100', 'CN-0001', 'CN-0001', 'CN-0001'],
  )
})
