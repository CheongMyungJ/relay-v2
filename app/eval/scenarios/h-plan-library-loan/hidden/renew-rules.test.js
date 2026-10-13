// s3: 연장 규칙 (D8, D9, D10)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getBook, getLoan, listLoans, renewLoan } from '../src/index.js'
import { book, loan, rejects, setup } from './helpers.js'

test('연장하면 기한이 14일 늘고 횟수가 1이 된다', () => {
  setup({ books: [book({ available: 0 })], loans: [loan()] })
  const r = renewLoan('L-0001', '2026-10-15')
  assert.equal(r.renewals, 1)
  assert.equal(r.baseDueOn, '2026-11-03')
  assert.equal(r.dueOn, '2026-11-03')
  assert.deepEqual(getLoan('L-0001'), r)
})

test('연장해도 대출 번호와 대출일, 재고, 대출 수는 그대로다', () => {
  setup({ books: [book({ available: 0 })], loans: [loan()] })
  const r = renewLoan('L-0001', '2026-10-15')
  assert.equal(r.id, 'L-0001')
  assert.equal(r.borrowedOn, '2026-10-06')
  assert.equal(r.memberId, 'M-1')
  assert.equal(r.returnedOn, null)
  assert.equal(r.feeWon, null)
  assert.equal(getBook('B-1').available, 0)
  assert.equal(listLoans().length, 1)
})

test('언제 연장하든 같은 날까지다 (연장하는 날 + 14일이 아니다)', () => {
  setup({ books: [book({ available: 0 })], loans: [loan()] })
  assert.equal(renewLoan('L-0001', '2026-10-07').dueOn, '2026-11-03')
  setup({ books: [book({ available: 0 })], loans: [loan()] })
  assert.equal(renewLoan('L-0001', '2026-10-20').dueOn, '2026-11-03')
})

test('연장은 한 번만', () => {
  setup({ books: [book({ available: 0 })], loans: [loan()] })
  const r = renewLoan('L-0001', '2026-10-15')
  rejects(() => renewLoan('L-0001', '2026-10-16'), 'RENEW_LIMIT')
  assert.deepEqual(getLoan('L-0001'), r)
})

test('기한 당일까지는 연장할 수 있고 다음 날부터는 연체라 못 한다', () => {
  setup({ books: [book({ available: 0 })], loans: [loan()] })
  assert.equal(renewLoan('L-0001', '2026-10-20').renewals, 1)
  setup({ books: [book({ available: 0 })], loans: [loan()] })
  rejects(() => renewLoan('L-0001', '2026-10-21'), 'OVERDUE')
  assert.equal(getLoan('L-0001').renewals, 0)
  assert.equal(getLoan('L-0001').dueOn, '2026-10-20')
})

test('이미 반납한 대출과 없는 대출', () => {
  setup({ books: [book({ available: 1 })], loans: [loan({ returnedOn: '2026-10-10', feeWon: 0 })] })
  rejects(() => renewLoan('L-0001', '2026-10-11'), 'ALREADY_RETURNED')
  rejects(() => renewLoan('L-0099', '2026-10-11'), 'NOT_FOUND')
})
