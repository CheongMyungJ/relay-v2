import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paidOrder, shop } from './shop-setup.js'

const issue = (s, amount = 11000) => s.billing.issueManualInvoice({ customerId: 'c-1', lines: [{ name: '납품', amount }] })

test('무효로 한 송장이 있어도 번호가 겹치지 않는다', () => {
  const s = shop()
  const a = issue(s)
  const b = issue(s)
  const c = issue(s)
  s.billing.voidInvoice(b.id, '중복 발행')
  const d = issue(s)
  assert.deepEqual([a.number, c.number, d.number], ['INV-2026-00001', 'INV-2026-00003', 'INV-2026-00004'])
  assert.equal(s.billing.findInvoice('INV-2026-00002').status, 'void')
})

test('무효가 여럿이고 주문 송장이 섞여도 번호는 한 번씩만', () => {
  const s = shop()
  const numbers = []
  for (let i = 0; i < 3; i++) numbers.push(issue(s).number)
  s.billing.voidInvoice(s.billing.findInvoice(numbers[0]).id, 'x')
  s.billing.voidInvoice(s.billing.findInvoice(numbers[2]).id, 'x')
  const o = paidOrder(s, 'c-1', [['MUG', 1]])
  numbers.push(s.billing.invoiceForOrder(o.id).number)
  numbers.push(issue(s).number)
  assert.equal(new Set(numbers).size, 5)
  assert.deepEqual(numbers.slice(3), ['INV-2026-00004', 'INV-2026-00005'])
})
