// s3 guard: 연장이 생겨도 대출(s1)과 반납·연체료(s2)는 그대로다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkout, getBook, getLoan, returnBook } from '../src/index.js'
import { book, loan, manyBooks, rejects, setup } from './helpers.js'

test('대출: 기한, 휴관일, 제한', () => {
  setup({ books: manyBooks(3) })
  assert.equal(checkout('M-1', 'B-1', '2026-10-06').dueOn, '2026-10-20')
  const shifted = checkout('M-1', 'B-2', '2026-09-25')
  assert.equal(shifted.baseDueOn, '2026-10-09')
  assert.equal(shifted.dueOn, '2026-10-10')
  rejects(() => checkout('M-1', 'B-1', '2026-10-07'), 'DUPLICATE')
  assert.equal(getBook('B-3').available, 2)
})

test('대출: 다섯 권과 연체 차단', () => {
  const loans = [1, 2, 3, 4, 5].map((n) => loan({ id: `L-000${n}`, bookId: `B-${n}` }))
  setup({ books: manyBooks(6), loans })
  rejects(() => checkout('M-1', 'B-6', '2026-10-07'), 'LIMIT')
  setup({ books: manyBooks(2), loans: [loan({ dueOn: '2026-10-06', baseDueOn: '2026-10-06' })] })
  rejects(() => checkout('M-1', 'B-2', '2026-10-07'), 'OVERDUE_BLOCK')
})

test('반납: 재고와 연체료', () => {
  setup({ books: [book({ available: 0 })], loans: [loan()] })
  const done = returnBook('L-0001', '2026-10-26') // 휴관일 월요일은 세지 않는다
  assert.equal(done.feeWon, 500)
  assert.equal(getBook('B-1').available, 1)
  rejects(() => returnBook('L-0001', '2026-10-27'), 'ALREADY_RETURNED')
  assert.equal(getLoan('L-0001').feeWon, 500)
})

test('반납: 상한', () => {
  setup({ books: [book({ available: 0 })], loans: [loan()] })
  assert.equal(returnBook('L-0001', '2026-12-30').feeWon, 3000)
})
