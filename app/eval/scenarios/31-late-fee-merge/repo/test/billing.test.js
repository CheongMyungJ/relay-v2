import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { lateFeeLine, monthlyInvoice } from '../src/billing/invoice.js'
import { receiptText } from '../src/billing/receipt.js'
import { vatOf } from '../src/billing/tax.js'
import { resetStore } from '../src/rentals/store.js'
import { rental } from './helpers.js'

beforeEach(() => resetStore([]))

test('부가세는 버림', () => {
  assert.equal(vatOf(12345), 1234)
})

test('연체료 줄', () => {
  assert.equal(lateFeeLine(rental(), '2026-09-05'), null)
  assert.deepEqual(lateFeeLine(rental(), '2026-09-08'), { label: '연체료 (4일)', amount: 16000 })
})

test('한 달 청구서', () => {
  resetStore([
    rental({ id: 'R-1', returnedOn: '2026-09-08' }),
    rental({ id: 'R-2', toolId: 'T-200', toolName: '사다리 3m', dailyRate: 5000, deposit: 30000, returnedOn: '2026-09-04', charges: [{ kind: 'rent', amount: 15000, on: '2026-09-01' }] }),
    rental({ id: 'R-3', returnedOn: '2026-10-01' }),
    rental({ id: 'R-4', memberId: 'M-2', returnedOn: '2026-09-08' }),
  ])
  const inv = monthlyInvoice('M-1', '2026-09')
  assert.deepEqual(
    inv.lines.map((l) => [l.label, l.amount]),
    [
      ['사다리 3m 대여 (R-2)', 15000],
      ['전동 드릴 대여 (R-1)', 24000],
      ['연체료 (4일)', 16000],
    ],
  )
  assert.equal(inv.supply, 55000)
  assert.equal(inv.vat, 5500)
  assert.equal(inv.total, 60500)
  assert.match(receiptText(inv, '김하나'), /합계 {2}60,500원/)
})
