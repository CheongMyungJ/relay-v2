import { test } from 'node:test'
import assert from 'node:assert'
import { createInvoice } from '../src/invoice/invoice.js'
import { computeTotals } from '../src/invoice/total.js'

const draft = (lines, extra = {}) => createInvoice({ customerId: 'C-1', lines, ...extra })

test('과세 품목만 있는 청구서', () => {
  const inv = draft([
    { name: 'A4 복사용지', unitPrice: 5450, qty: 10 },
    { name: '파일 바인더', unitPrice: 2390, qty: 3 },
  ])
  assert.deepStrictEqual(computeTotals(inv), {
    subtotal: 61670,
    discount: 0,
    supply: 61670,
    taxable: 61670,
    exempt: 0,
    vat: 6167,
    total: 67837,
  })
})

test('면세 품목에는 부가세가 없다', () => {
  const inv = draft([
    { name: '형광펜 5색', unitPrice: 2150, qty: 2 },
    { name: '업무 실무 핸드북', unitPrice: 18000, qty: 1, taxType: 'exempt' },
  ])
  const t = computeTotals(inv)
  assert.strictEqual(t.taxable, 4300)
  assert.strictEqual(t.exempt, 18000)
  assert.strictEqual(t.vat, 430)
  assert.strictEqual(t.total, 22730)
})

test('영세율 청구서는 부가세 0', () => {
  const inv = draft([{ name: '토너 (흑)', unitPrice: 48000, qty: 2 }], { zeroRated: true })
  const t = computeTotals(inv)
  assert.strictEqual(t.vat, 0)
  assert.strictEqual(t.total, 96000)
})

test('할인은 공급가액에서 뺀다', () => {
  const inv = draft([
    { name: '커피믹스', unitPrice: 13400, qty: 5, discount: { percent: 10 } },
    { name: '종이컵', unitPrice: 18200, qty: 1, discount: { amount: 1200 } },
  ])
  const t = computeTotals(inv)
  assert.strictEqual(t.subtotal, 85200)
  assert.strictEqual(t.discount, 7900)
  assert.strictEqual(t.supply, 77300)
  assert.strictEqual(t.vat, 7730)
  assert.strictEqual(t.total, 85030)
})

test('단가 0원 품목(증정품)', () => {
  const inv = draft([
    { name: '마우스패드 증정', unitPrice: 0, qty: 3 },
    { name: '가위', unitPrice: 2780, qty: 5 },
  ])
  assert.strictEqual(computeTotals(inv).total, 15290)
})
