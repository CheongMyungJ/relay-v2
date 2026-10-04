import { test } from 'node:test'
import assert from 'node:assert'
import { createCustomerStore } from '../src/customers/store.js'
import { escapeCsv, parseCsvLine, toCsv } from '../src/export/csv.js'
import { invoicesToCsv } from '../src/export/invoices-csv.js'
import { journalEntries, ledger } from '../src/export/ledger.js'
import { monthlySummary, outstanding } from '../src/export/monthly.js'
import { buildReminders, reminderStage } from '../src/export/reminders.js'
import { createInvoice, issueInvoice, markPaid, voidInvoice } from '../src/invoice/invoice.js'

const customers = createCustomerStore([
  { id: 'C-0412', name: '(주)세림건축', bizNo: '214-86-12341', email: 'account@serim-arch.co.kr' },
  { id: 'C-0388', name: '누리테크, 주식회사', bizNo: '105-87-11900' },
])

function make(number, customerId, issueDate, lines, dueDate) {
  return issueInvoice(createInvoice({ customerId, lines }), { number, issueDate, dueDate })
}

const a = make('INV-2001', 'C-0412', '2026-08-28', [{ name: '가위', unitPrice: 2780, qty: 5 }], '2026-09-27')
const b = make('INV-2002', 'C-0388', '2026-09-03', [
  { name: '복사용지', unitPrice: 5450, qty: 20 },
  { name: '핸드북', unitPrice: 18000, qty: 1, taxType: 'exempt' },
])
const c = make('INV-2003', 'C-0412', '2026-09-10', [{ name: '토너', unitPrice: 48000, qty: 1 }], '2026-10-10')
const draft = createInvoice({ customerId: 'C-0412', lines: [{ name: '볼펜', unitPrice: 300 }] })

test('CSV 칸 이스케이프', () => {
  assert.strictEqual(escapeCsv('보통'), '보통')
  assert.strictEqual(escapeCsv('a,b'), '"a,b"')
  assert.strictEqual(escapeCsv('그는 "네"라고'), '"그는 ""네""라고"')
  assert.strictEqual(escapeCsv(null), '')
  assert.deepStrictEqual(parseCsvLine('"a,b",c,"d ""e"""'), ['a,b', 'c', 'd "e"'])
  assert.strictEqual(toCsv([{ x: 1 }], [{ key: 'x', header: 'X' }], { eol: '\n' }), 'X\n1\n')
})

test('청구서 CSV', () => {
  const csv = invoicesToCsv([c, draft, b, a], { customers, bom: false })
  assert.deepStrictEqual(csv.trimEnd().split('\r\n'), [
    '청구서 번호,발행일,거래처,사업자등록번호,공급가액,부가세,합계,상태',
    'INV-2001,2026-08-28,(주)세림건축,2148612341,13900,1390,15290,발행',
    'INV-2002,2026-09-03,"누리테크, 주식회사",1058711900,127000,10900,137900,발행',
    'INV-2003,2026-09-10,(주)세림건축,2148612341,48000,4800,52800,발행',
  ])
  assert.ok(invoicesToCsv([a]).startsWith('﻿'))
})

test('매출 분개', () => {
  const entries = journalEntries(b)
  assert.deepStrictEqual(
    entries.map((e) => [e.account, e.debit, e.credit]),
    [
      ['외상매출금', 137900, 0],
      ['상품매출', 0, 127000],
      ['부가세예수금', 0, 10900],
    ],
  )
  const voided = journalEntries(voidInvoice(a, '주문 취소'))
  assert.strictEqual(voided.length, 6)
  assert.throws(() => journalEntries(draft), /초안/)
  assert.deepStrictEqual(ledger([c, a, draft]).map((e) => e.ref), ['INV-2001', 'INV-2001', 'INV-2001', 'INV-2003', 'INV-2003', 'INV-2003'])
})

test('월별 요약과 미수금', () => {
  const paid = markPaid(c, { paidAt: '2026-09-20', amount: 52800 })
  assert.deepStrictEqual(monthlySummary([a, b, paid, draft]), [
    { month: '2026-08', count: 1, supply: 13900, vat: 1390, total: 15290, paid: 0 },
    { month: '2026-09', count: 2, supply: 175000, vat: 15700, total: 190700, paid: 52800 },
  ])
  assert.strictEqual(outstanding([a, b, paid, draft]), 153190)
})

test('연체 안내 메일', () => {
  assert.strictEqual(reminderStage(0), null)
  assert.strictEqual(reminderStage(20).stage, 'second')
  const mails = buildReminders([a, b, c], customers, '2026-10-20')
  assert.strictEqual(mails.length, 1)
  assert.strictEqual(mails[0].to, 'account@serim-arch.co.kr')
  assert.strictEqual(mails[0].stage, 'second')
  assert.match(mails[0].body, /청구서 2건, 합계 68,090원/)
  assert.match(mails[0].body, /- INV-2001: 15,290원 \(납부 기한 2026년 9월 27일, 23일 지남\)/)
})
