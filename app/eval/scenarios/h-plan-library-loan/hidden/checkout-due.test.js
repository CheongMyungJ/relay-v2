// s1: 대출 기록과 기한 계산 (D1, D2, D5)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkout, getBook, getLoan, listLoans } from '../src/index.js'
import { book, setup } from './helpers.js'

test('빌리면 기록이 저장되고 재고가 하나 준다', () => {
  setup()
  const loan = checkout('M-1', 'B-1', '2026-10-06')
  assert.match(loan.id, /^L-\d{4}$/)
  assert.equal(loan.memberId, 'M-1')
  assert.equal(loan.bookId, 'B-1')
  assert.equal(loan.borrowedOn, '2026-10-06')
  assert.equal(loan.renewals, 0)
  assert.equal(loan.returnedOn, null)
  assert.equal(loan.feeWon, null)
  assert.deepEqual(getLoan(loan.id), loan)
  assert.equal(listLoans().length, 1)
  assert.equal(getBook('B-1').available, 1)
})

test('기한은 대출일 + 14일이고 기준 기한과 같다', () => {
  setup()
  const loan = checkout('M-1', 'B-1', '2026-10-06')
  assert.equal(loan.baseDueOn, '2026-10-20')
  assert.equal(loan.dueOn, '2026-10-20')
})

test('기준 기한이 공휴일이면 실제 기한만 다음 개관일로 미룬다', () => {
  setup()
  const loan = checkout('M-1', 'B-1', '2026-09-25') // 10-09(금)가 공휴일
  assert.equal(loan.baseDueOn, '2026-10-09')
  assert.equal(loan.dueOn, '2026-10-10')
})

test('휴관일이 이어지면 첫 개관일까지 미룬다', () => {
  setup()
  const loan = checkout('M-1', 'B-1', '2026-12-17') // 12-31, 01-01 모두 휴관
  assert.equal(loan.baseDueOn, '2026-12-31')
  assert.equal(loan.dueOn, '2027-01-02')
})

test('대출 번호는 겹치지 않는다', () => {
  setup({ books: [book(), book({ id: 'B-2' })] })
  const a = checkout('M-1', 'B-1', '2026-10-06')
  const b = checkout('M-1', 'B-2', '2026-10-06')
  assert.notEqual(a.id, b.id)
  assert.equal(listLoans().length, 2)
})
