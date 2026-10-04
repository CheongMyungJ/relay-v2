import { test } from 'node:test'
import assert from 'node:assert'
import { creditNoteEntries, ledger } from '../src/export/ledger.js'
import { createCreditNote, creditNoteTotals } from '../src/invoice/credit-note.js'
import { createInvoice, issueInvoice, markPaid, voidInvoice } from '../src/invoice/invoice.js'
import { issued } from './credit-helpers.js'

// 지키기: 부가세가 없는 반품, 끝자리가 0인 반품, 이미 만든 반품 전표의 저장된 금액, 반품 확인 규칙은 그대로여야 한다

test('영세율 청구서의 반품: 부가세 0', () => {
  const inv = issued({
    number: 'INV-2045',
    customerId: 'C-0520',
    issueDate: '2026-09-22',
    zeroRated: true,
    lines: [
      { sku: 'OF-1675', name: '수정테이프', unitPrice: 1675, qty: 9 },
      { sku: 'EL-1237', name: '전선 몰드 1m', unitPrice: 1237, qty: 4 },
      { sku: 'OF-7365', name: 'A4 라벨지', unitPrice: 7365, qty: 3, discount: { percent: 20 } },
    ],
  })
  const note = createCreditNote(inv, {
    number: 'CN-0113',
    issueDate: '2026-10-07',
    reason: '수출 선적 취소',
    returns: [
      { sku: 'OF-1675', qty: 5 },
      { sku: 'OF-7365', qty: 1 },
    ],
  })
  assert.deepStrictEqual(note.totals, { supply: 14267, taxable: 14267, exempt: 0, vat: 0, total: 14267 })
  assert.deepStrictEqual(
    creditNoteEntries(note).map((e) => [e.account, e.debit, e.credit]),
    [
      ['매출환입', 14267, 0],
      ['외상매출금', 0, 14267],
    ],
  )
})

test('면세 품목만 돌려받으면 부가세 0', () => {
  const inv = issued({
    number: 'INV-2049',
    customerId: 'C-0412',
    issueDate: '2026-09-25',
    lines: [
      { sku: 'BK-1680', name: '세무 실무 가이드', unitPrice: 16800, qty: 3, taxType: 'exempt', discount: { amount: 1285 } },
      { sku: 'OF-1342', name: '박스테이프', unitPrice: 1342, qty: 4 },
    ],
  })
  const note = createCreditNote(inv, {
    number: 'CN-0114',
    issueDate: '2026-10-07',
    reason: '개정판으로 교환',
    returns: [{ sku: 'BK-1680', qty: 3 }],
  })
  assert.deepStrictEqual(note.totals, { supply: 49115, taxable: 0, exempt: 49115, vat: 0, total: 49115 })
})

test('줄 금액 끝자리가 0이면 계산 방식과 상관없이 같은 금액', () => {
  const inv = issued({
    number: 'INV-2050',
    customerId: 'C-0388',
    issueDate: '2026-09-26',
    lines: [
      { sku: 'OF-2763', name: 'A4 복사용지 박스', unitPrice: 27630, qty: 3 },
      { sku: 'FD-1347', name: '커피믹스 100입', unitPrice: 13470, qty: 4, discount: { amount: 1940 } },
      { sku: 'OF-1450', name: '포스트잇', unitPrice: 1450, qty: 10, discount: { percent: 10 } },
    ],
  })
  const note = createCreditNote(inv, {
    number: 'CN-0116',
    issueDate: '2026-10-09',
    reason: '유통기한 임박',
    returns: [
      { sku: 'FD-1347', qty: 4 },
      { sku: 'OF-1450', qty: 2 },
      { sku: 'OF-2763', qty: 1 },
    ],
  })
  assert.deepStrictEqual(note.totals, { supply: 82180, taxable: 82180, exempt: 0, vat: 8218, total: 90398 })
  assert.strictEqual(note.invoiceNumber, 'INV-2050')
  assert.strictEqual(note.customerId, 'C-0388')
})

// 9월에 만들어 금액이 저장된 반품 전표. 저장된 금액을 다시 계산하지 않는다
const CN_0098 = {
  number: 'CN-0098',
  invoiceNumber: 'INV-1987',
  customerId: 'C-0412',
  issueDate: '2026-09-03',
  reason: '파손',
  zeroRated: false,
  lines: [
    { sku: 'OF-1342', name: '박스테이프', unitPrice: 1342, qty: 3, origQty: 4, taxType: 'taxable' },
    { sku: 'OF-0905', name: '네임펜 흑', unitPrice: 905, qty: 5, origQty: 7, taxType: 'taxable' },
  ],
  totals: { supply: 8551, taxable: 8551, exempt: 0, vat: 855, total: 9406 },
}

test('저장된 반품 전표는 저장된 금액 그대로', () => {
  assert.strictEqual(creditNoteTotals(CN_0098), CN_0098.totals)
  assert.deepStrictEqual(
    creditNoteEntries(CN_0098).map((e) => [e.account, e.debit, e.credit]),
    [
      ['매출환입', 8551, 0],
      ['부가세예수금', 855, 0],
      ['외상매출금', 0, 9406],
    ],
  )
})

test('청구서와 반품 전표를 함께 분개', () => {
  const inv = issueInvoice(createInvoice({ customerId: 'C-0412', lines: [{ sku: 'TN-4800', name: '토너', unitPrice: 48000, qty: 2 }] }), {
    number: 'INV-2055',
    issueDate: '2026-10-01',
  })
  const note = createCreditNote(inv, { number: 'CN-0117', issueDate: '2026-10-09', reason: '불량', returns: [{ sku: 'TN-4800', qty: 1 }] })
  assert.deepStrictEqual(note.totals, { supply: 48000, taxable: 48000, exempt: 0, vat: 4800, total: 52800 })
  const rows = ledger([inv], [note, CN_0098])
  assert.deepStrictEqual(
    rows.map((e) => [e.date, e.ref, e.account, e.debit, e.credit]),
    [
      ['2026-09-03', 'CN-0098', '매출환입', 8551, 0],
      ['2026-09-03', 'CN-0098', '부가세예수금', 855, 0],
      ['2026-09-03', 'CN-0098', '외상매출금', 0, 9406],
      ['2026-10-01', 'INV-2055', '외상매출금', 105600, 0],
      ['2026-10-01', 'INV-2055', '상품매출', 0, 96000],
      ['2026-10-01', 'INV-2055', '부가세예수금', 0, 9600],
      ['2026-10-09', 'CN-0117', '매출환입', 48000, 0],
      ['2026-10-09', 'CN-0117', '부가세예수금', 4800, 0],
      ['2026-10-09', 'CN-0117', '외상매출금', 0, 52800],
    ],
  )
})

test('반품 확인 규칙', () => {
  const lines = [
    { sku: 'OF-1342', name: '박스테이프', unitPrice: 1342, qty: 4 },
    { sku: 'OF-0905', name: '네임펜 흑', unitPrice: 905, qty: 7 },
  ]
  const draft = createInvoice({ customerId: 'C-0412', lines })
  const inv = issueInvoice(draft, { number: 'INV-2060', issueDate: '2026-10-02' })
  const ok = { number: 'CN-0120', issueDate: '2026-10-12', reason: '파손', returns: [{ sku: 'OF-1342', qty: 1 }] }
  assert.throws(() => createCreditNote(draft, ok), /발행/)
  assert.throws(() => createCreditNote(voidInvoice(inv, '중복'), ok), /발행/)
  assert.throws(() => createCreditNote(inv, { ...ok, number: 'INV-0120' }), /CN-/)
  assert.throws(() => createCreditNote(inv, { ...ok, reason: '' }), /사유/)
  assert.throws(() => createCreditNote(inv, { ...ok, issueDate: '2026-09-30' }), /앞선다/)
  assert.throws(() => createCreditNote(inv, { ...ok, returns: [{ sku: 'OF-9999', qty: 1 }] }), /없는 품목/)
  assert.throws(() => createCreditNote(inv, { ...ok, returns: [{ sku: 'OF-0905', qty: 8 }] }), /많다/)
  assert.throws(
    () => createCreditNote(inv, { ...ok, returns: [{ sku: 'OF-0905', qty: 4 }, { sku: 'OF-0905', qty: 4 }] }),
    /많다/,
  )
  assert.throws(() => createCreditNote(inv, { ...ok, returns: [{ sku: 'OF-0905', qty: 0 }] }), /수량/)
  const paid = markPaid(inv, { paidAt: '2026-10-05', amount: inv.totals.total })
  assert.strictEqual(createCreditNote(paid, ok).lines[0].qty, 1)
})
