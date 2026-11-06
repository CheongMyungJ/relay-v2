import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paidOrder, shop } from './shop-setup.js'

const issue = (s, customerId, amount) => s.billing.issueManualInvoice({ customerId, lines: [{ name: '납품', amount }] })
const rows = (csv) => csv.trim().split('\n').map((l) => l.split(','))
const ASOF = '2026-04-10T02:00:00Z'

test('연체 송장 CSV: 머리글, 미납 금액, 연체 일수가 긴 차례', () => {
  const s = shop()
  const a = issue(s, 'c-1', 55000) // 기한 3월 17일
  s.clock.set('2026-03-10T01:00:00Z')
  const b = issue(s, 'c-3', 22000) // 기한 3월 24일
  s.billing.recordReceipt(a.id, 10000)
  const csv = s.billing.overdueCsv(ASOF)
  const [head, ...body] = rows(csv)
  assert.deepEqual(head, ['invoice', 'name', 'phone', 'amount', 'days_overdue'])
  assert.deepEqual(
    body.map((r) => [r[0], r[1], r[3], r[4]]),
    [
      [a.number, '김하나', '45000', '24'],
      [b.number, '박제주', '22000', '17'],
    ],
  )
})

test('입금이 끝났거나 무효이거나 기한 전인 송장은 빠진다', () => {
  const s = shop()
  const a = issue(s, 'c-1', 11000)
  const b = issue(s, 'c-1', 11000)
  issue(s, 'c-3', 11000)
  paidOrder(s, 'c-1', [['MUG', 1]])
  s.billing.recordReceipt(a.id, 11000)
  s.billing.voidInvoice(b.id, '중복')
  s.clock.set('2026-04-05T01:00:00Z')
  issue(s, 'c-1', 11000)
  const body = rows(s.billing.overdueCsv(ASOF)).slice(1)
  assert.deepEqual(body.map((r) => r[1]), ['박제주'])
})

test('이름의 쉼표와 전화번호 없는 고객', () => {
  const s = shop()
  s.customers.register({ id: 'b-1', name: '한빛, 주식회사', email: 'acct@hanbit.example' })
  issue(s, 'b-1', 33000)
  const lines = s.billing.overdueCsv(ASOF).trim().split('\n')
  assert.equal(lines.length, 2)
  assert.match(lines[1], /^INV-2026-00001,"한빛, 주식회사",,33000,24$/)
})
