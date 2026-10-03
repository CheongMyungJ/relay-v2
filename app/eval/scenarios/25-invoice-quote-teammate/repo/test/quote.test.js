import { test } from 'node:test'
import assert from 'node:assert'
import { createQuote, isQuoteExpired, quoteValidUntil } from '../src/invoice/quote.js'

const lines = [{ sku: 'TN-4800', name: '토너', unitPrice: 48000, qty: 2 }]

test('견적 번호와 유효 기간', () => {
  const q = createQuote({ number: 'Q-0400', customerId: 'C-0412', issueDate: '2026-10-01', lines })
  assert.strictEqual(q.validDays, 14)
  assert.strictEqual(quoteValidUntil(q), '2026-10-14')
  assert.strictEqual(isQuoteExpired(q, '2026-10-14'), false)
  assert.strictEqual(isQuoteExpired(q, '2026-10-15'), true)
  assert.throws(() => createQuote({ number: 'INV-0400', customerId: 'C-0412', issueDate: '2026-10-01', lines }), /Q-0000/)
})

test('견적 합계', () => {
  const q = createQuote({ number: 'Q-0401', customerId: 'C-0412', issueDate: '2026-10-01', lines })
  assert.deepStrictEqual(q.totals, { supply: 96000, taxable: 96000, exempt: 0, vat: 9600, total: 105600 })
})
