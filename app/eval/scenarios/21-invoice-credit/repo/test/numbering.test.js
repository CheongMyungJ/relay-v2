import { test } from 'node:test'
import assert from 'node:assert'
import { daysOverdue, dueDateFor, isOverdue } from '../src/invoice/due.js'
import {
  createNumberer,
  formatInvoiceNumber,
  lastInvoiceNumber,
  parseInvoiceNumber,
} from '../src/invoice/numbering.js'

test('청구서 번호', () => {
  assert.strictEqual(formatInvoiceNumber(7), 'INV-0007')
  assert.strictEqual(formatInvoiceNumber(2031), 'INV-2031')
  assert.strictEqual(parseInvoiceNumber('INV-2031'), 2031)
  assert.strictEqual(parseInvoiceNumber('ORD-2031'), null)
  assert.strictEqual(parseInvoiceNumber('INV-20a1'), null)
})

test('다음 번호', () => {
  const n = createNumberer('INV-2030')
  assert.strictEqual(n.peek(), 'INV-2031')
  assert.strictEqual(n.next(), 'INV-2031')
  assert.strictEqual(n.next(), 'INV-2032')
  assert.strictEqual(createNumberer().next(), 'INV-0001')
  assert.strictEqual(lastInvoiceNumber([{ number: 'INV-0998' }, { number: null }, { number: 'INV-1002' }]), 'INV-1002')
})

test('납부 기한', () => {
  assert.strictEqual(dueDateFor('2026-09-14'), '2026-10-14')
  assert.strictEqual(dueDateFor('2026-12-20', 15), '2027-01-04')
  assert.strictEqual(dueDateFor('2028-02-14', 15), '2028-02-29')
})

test('연체', () => {
  const inv = { status: 'issued', dueDate: '2026-10-14' }
  assert.strictEqual(isOverdue(inv, '2026-10-14'), false)
  assert.strictEqual(isOverdue(inv, '2026-10-15'), true)
  assert.strictEqual(daysOverdue(inv, '2026-10-24'), 10)
  assert.strictEqual(isOverdue({ ...inv, status: 'paid' }, '2026-11-01'), false)
})
