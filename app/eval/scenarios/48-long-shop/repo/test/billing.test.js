import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatWon, isBusinessNumber } from '../src/billing/invoices.js'
import { errorCode, placePaid, setup } from './helpers.js'

const manual = (shop, customerId = 'u-1', amount = 110000) =>
  shop.billing.issueManualInvoice({ customerId, lines: [{ name: '납품', amount }] })

test('결제하면 송장을 내고 입금 처리한다', () => {
  const shop = setup()
  const order = placePaid(shop, 'u-1', [['MUG', 1], ['RICE', 1]], { coupon: 'WELCOME' })
  const invoice = shop.billing.invoiceForOrder(order.id)
  assert.equal(invoice.number, 'INV-2026-00001')
  assert.equal(invoice.total, order.total)
  assert.deepEqual(
    invoice.lines.map((l) => [l.name, l.amount, l.vat]),
    [['머그컵', 12000, 1090], ['쌀 10kg', 33000, 0], ['배송비', 3000, 272], ['할인(WELCOME)', -3000, 0]],
  )
  assert.equal(invoice.status, 'paid')
  assert.equal(shop.billing.receiptsFor(invoice.id)[0].method, 'card')
})

test('송장 번호는 차례로 붙는다', () => {
  const shop = setup()
  placePaid(shop, 'u-1', [['MUG', 1]])
  manual(shop)
  placePaid(shop, 'u-2', [['TEA', 1]])
  assert.deepEqual(shop.billing.listInvoices().map((i) => i.number), ['INV-2026-00001', 'INV-2026-00002', 'INV-2026-00003'])
})

test('주문 취소는 반품 전표가 된다', () => {
  const shop = setup()
  const order = placePaid(shop, 'u-1', [['TEA', 1]])
  shop.orders.cancelOrder(order.id)
  const invoice = shop.billing.invoiceForOrder(order.id)
  const [note] = shop.billing.creditNotesFor(invoice.id)
  assert.equal(note.amount, 33000)
  assert.equal(note.vat, 3000)
  assert.equal(note.number, 'CN-00001')
  assert.equal(shop.billing.balance(invoice.id), -33000)
})

test('후불 송장과 일부 입금', () => {
  const shop = setup()
  const invoice = manual(shop)
  assert.equal(invoice.vat, 10000)
  assert.equal(invoice.dueAt, '2026-03-16T01:00:00.000Z')
  shop.billing.recordReceipt(invoice.id, 60000)
  assert.equal(shop.billing.getInvoice(invoice.id).status, 'partial')
  assert.throws(() => shop.billing.recordReceipt(invoice.id, 60000), errorCode('OVERPAID'))
  shop.billing.recordReceipt(invoice.id, 50000)
  assert.equal(shop.billing.getInvoice(invoice.id).status, 'paid')
})

test('무효와 대손', () => {
  const shop = setup()
  const a = manual(shop)
  const b = manual(shop)
  assert.throws(() => shop.billing.voidInvoice(a.id), errorCode('BAD_REQUEST'))
  assert.equal(shop.billing.voidInvoice(a.id, '중복 발행').status, 'void')
  assert.equal(shop.billing.findInvoice(a.number).status, 'void')
  assert.equal(shop.billing.listInvoices().length, 1)
  shop.billing.recordReceipt(b.id, 10000)
  assert.throws(() => shop.billing.voidInvoice(b.id, 'x'), errorCode('HAS_RECEIPTS'))
  assert.equal(shop.billing.writeOff(b.id, '폐업').writtenOff.amount, 100000)
})

test('연체와 연체 현황', () => {
  const shop = setup()
  const a = manual(shop, 'u-1', 50000)
  shop.clock.set('2026-03-10T01:00:00Z')
  const b = manual(shop, 'u-2', 20000)
  const asOf = '2026-04-20T02:00:00Z'
  const overdue = shop.billing.overdueInvoices(asOf)
  assert.deepEqual(overdue.map((x) => [x.invoice.number, x.daysOverdue]), [[a.number, 35], [b.number, 27]])
  const report = shop.billing.agingReport(asOf)
  assert.deepEqual(report.buckets.map((x) => x.amount), [20000, 50000, 0, 0])
  assert.match(shop.billing.renderAging(report), /합계 {2}70,000원/)
})

test('독촉은 단계마다 한 번', () => {
  const shop = setup()
  const invoice = manual(shop)
  assert.deepEqual(shop.billing.sendReminders('2026-03-24T02:00:00Z').map((r) => r.step), [7])
  assert.deepEqual(shop.billing.sendReminders('2026-03-25T02:00:00Z'), [])
  assert.deepEqual(shop.billing.sendReminders('2026-04-20T02:00:00Z').map((r) => r.step), [30])
  assert.equal(shop.billing.remindersFor(invoice.id).length, 2)
})

test('명세서', () => {
  const shop = setup()
  const a = manual(shop, 'u-1', 50000)
  shop.clock.set('2026-04-02T01:00:00Z')
  shop.billing.recordReceipt(a.id, 20000)
  placePaid(shop, 'u-1', [['MUG', 1]])
  shop.billing.issueCreditNote({ invoiceId: a.id, amount: 5000, reason: '불량 1개' })
  const st = shop.billing.statementFor('u-1', { from: '2026-03-31T15:00:00Z', to: '2026-04-30T15:00:00Z' })
  assert.equal(st.opening, 50000)
  assert.equal(st.closing, 25000)
  const text = shop.billing.renderStatement(st)
  assert.match(text, /최유나 님 명세서 \(2026-04-01 ~ 2026-04-30\)/)
  assert.match(text, /전표 CN-00001 {2}-5,000원/)
})

test('송장 글과 전표 글', () => {
  const shop = setup()
  const order = placePaid(shop, 'u-1', [['TEA', 1]])
  shop.orders.cancelOrder(order.id)
  const invoice = shop.billing.invoiceForOrder(order.id)
  assert.match(shop.billing.renderInvoice(invoice.id), /전표 {2}-33,000원/)
  const [note] = shop.billing.creditNotesFor(invoice.id)
  assert.match(shop.billing.renderCreditNote(note.id), /금액 {2}-33,000원\n부가세 {2}-3,000원/)
})

test('송장 CSV', () => {
  const shop = setup()
  shop.customers.register({ id: 'b-1', name: '한빛, 주식회사', email: 'acct@hanbit.example' })
  manual(shop, 'b-1', 22000)
  const csv = shop.billing.invoicesCsv('2026-03')
  assert.equal(csv, 'number,issued,customer,total,vat,paid,status\nINV-2026-00001,2026-03-02,"한빛, 주식회사",22000,2000,0,issued\n')
  assert.throws(() => shop.billing.invoicesCsv('2026-3'), errorCode('BAD_REQUEST'))
})

test('세금계산서 자료', () => {
  const shop = setup()
  const invoice = manual(shop, 'u-1', 110000)
  assert.equal(isBusinessNumber('220-81-62517'), true)
  assert.equal(isBusinessNumber('220-81-62518'), false)
  const data = shop.billing.taxInvoiceData(invoice.id, { businessNumber: '220-81-62517', companyName: '한빛' })
  assert.equal(data.supplyAmount, 100000)
  assert.equal(data.taxAmount, 10000)
  assert.throws(
    () => shop.billing.taxInvoiceData(invoice.id, { businessNumber: '220-81-62517', companyName: '한빛' }),
    errorCode('ALREADY_ISSUED'),
  )
})

test('송장 고치기, 찾기, 나눠 내기', () => {
  const shop = setup()
  const invoice = manual(shop, 'u-1', 110000)
  const fixed = shop.billing.adjustInvoice(invoice.id, { lines: [{ name: '납품', amount: 99000 }] })
  assert.equal(fixed.total, 99000)
  assert.equal(shop.billing.searchInvoices({ text: '유나' }).length, 1)
  assert.equal(shop.billing.searchInvoices({ minTotal: 100000 }).length, 0)
  const plan = shop.billing.installmentPlan(invoice.id, 4)
  assert.deepEqual(plan.map((p) => p.amount), [24750, 24750, 24750, 24750])
  assert.equal(plan[1].dueAt, '2026-04-15T01:00:00.000Z')
})

test('금액 표시와 고객 합계', () => {
  assert.equal(formatWon(1234567), '1,234,567원')
  const shop = setup()
  const order = placePaid(shop, 'u-1', [['TEA', 2]])
  shop.orders.cancelOrder(order.id)
  placePaid(shop, 'u-1', [['MUG', 1]])
  assert.deepEqual(shop.billing.customerTotals('u-1'), { invoices: 2, paid: 75000, credited: 60000, net: 15000, open: 0 })
})

test('나눠 내기의 검사와 나머지', () => {
  const shop = setup()
  const invoice = manual(shop, 'u-1', 100001)
  assert.deepEqual(shop.billing.installmentPlan(invoice.id, 3).map((p) => p.amount), [33335, 33333, 33333])
  assert.throws(() => shop.billing.installmentPlan(invoice.id, 1), errorCode('BAD_REQUEST'))
  shop.billing.recordReceipt(invoice.id, 100001)
  assert.throws(() => shop.billing.installmentPlan(invoice.id, 2), errorCode('ALREADY_PAID'))
})

test('입금 CSV와 닫힌 송장', () => {
  const shop = setup()
  const a = manual(shop, 'u-1', 30000)
  shop.billing.recordReceipt(a.id, 30000, { method: 'transfer' })
  assert.equal(shop.billing.receiptsCsv('2026-03'), `receipt,at,invoice,amount,method\nrcp-1,2026-03-02,${a.number},30000,transfer\n`)
  const b = manual(shop, 'u-1', 30000)
  shop.billing.writeOff(b.id, '연락 안 됨')
  assert.throws(() => shop.billing.recordReceipt(b.id, 1000), errorCode('CLOSED_INVOICE'))
})

test('면세 줄이 있는 세금계산서 자료', () => {
  const shop = setup()
  const invoice = shop.billing.issueManualInvoice({
    customerId: 'u-1',
    lines: [{ name: '납품', amount: 55000 }, { name: '쌀', amount: 33000, taxClass: 'exempt' }],
  })
  const data = shop.billing.taxInvoiceData(invoice.id, { businessNumber: '2208162517', companyName: '한빛' })
  assert.equal(data.supplyAmount, 50000)
  assert.equal(data.taxAmount, 5000)
  assert.equal(data.exemptAmount, 33000)
  assert.equal(data.items.length, 1)
})

test('주문 송장은 고칠 수 없고, 전표는 송장 금액을 넘지 못한다', () => {
  const shop = setup()
  const order = placePaid(shop, 'u-1', [['MUG', 1]])
  const invoice = shop.billing.invoiceForOrder(order.id)
  assert.throws(() => shop.billing.adjustInvoice(invoice.id, { lines: [{ name: 'x', amount: 1 }] }), errorCode('ORDER_INVOICE'))
  assert.throws(() => shop.billing.issueCreditNote({ invoiceId: invoice.id, amount: 15001, reason: 'x' }), errorCode('BAD_AMOUNT'))
})
