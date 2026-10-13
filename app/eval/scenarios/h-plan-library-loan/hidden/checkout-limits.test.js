// s1: 대출 제한 (D3, D4, D5, D10)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkout, getBook, listLoans } from '../src/index.js'
import { book, loan, manyBooks, member, rejects, setup } from './helpers.js'

const five = (over = {}) =>
  [1, 2, 3, 4, 5].map((n) =>
    loan({ id: `L-000${n}`, bookId: `B-${n}`, borrowedOn: '2026-10-06', baseDueOn: '2026-10-20', dueOn: '2026-10-20', ...over }),
  )

test('다섯 권을 빌린 회원은 여섯 번째를 못 빌린다', () => {
  setup({ books: manyBooks(6), loans: five() })
  rejects(() => checkout('M-1', 'B-6', '2026-10-07'), 'LIMIT')
  assert.equal(getBook('B-6').available, 2)
  assert.equal(listLoans().length, 5)
})

test('반납한 대출은 권수에 세지 않는다', () => {
  const loans = five()
  loans[0] = { ...loans[0], returnedOn: '2026-10-08', feeWon: 0 }
  setup({ books: manyBooks(6), loans })
  const l = checkout('M-1', 'B-6', '2026-10-10')
  assert.equal(l.bookId, 'B-6')
})

test('다른 회원의 대출은 권수에 세지 않는다', () => {
  setup({ books: manyBooks(6), members: [member(), member({ id: 'M-2', name: '나래' })], loans: five() })
  const l = checkout('M-2', 'B-6', '2026-10-07')
  assert.equal(l.memberId, 'M-2')
})

test('같은 책을 두 권 빌릴 수 없다', () => {
  setup({ books: [book({ available: 3 })], loans: [loan()] })
  rejects(() => checkout('M-1', 'B-1', '2026-10-07'), 'DUPLICATE')
  assert.equal(getBook('B-1').available, 3)
})

test('연체 중인 대출이 있으면 새로 빌릴 수 없다', () => {
  setup({
    books: manyBooks(2),
    loans: [loan({ baseDueOn: '2026-10-06', dueOn: '2026-10-06', borrowedOn: '2026-09-22' })],
  })
  rejects(() => checkout('M-1', 'B-2', '2026-10-07'), 'OVERDUE_BLOCK')
  assert.equal(getBook('B-2').available, 2)
})

test('기한 당일까지는 연체가 아니다', () => {
  setup({
    books: manyBooks(2),
    loans: [loan({ baseDueOn: '2026-10-06', dueOn: '2026-10-06', borrowedOn: '2026-09-22' })],
  })
  const l = checkout('M-1', 'B-2', '2026-10-06')
  assert.equal(l.bookId, 'B-2')
})

test('이미 반납한 연체 대출은 막지 않는다', () => {
  setup({
    books: manyBooks(2),
    loans: [loan({ dueOn: '2026-10-06', baseDueOn: '2026-10-06', returnedOn: '2026-10-08', feeWon: 200 })],
  })
  assert.equal(checkout('M-1', 'B-2', '2026-10-10').bookId, 'B-2')
})

test('재고가 없으면 거절하고 아무것도 바꾸지 않는다', () => {
  setup({ books: [book({ available: 0 })] })
  rejects(() => checkout('M-1', 'B-1', '2026-10-06'), 'NO_COPIES')
  assert.equal(getBook('B-1').available, 0)
  assert.equal(listLoans().length, 0)
})

test('마지막 한 권을 빌리면 0이 된다', () => {
  setup({ books: [book({ available: 1 })] })
  checkout('M-1', 'B-1', '2026-10-06')
  assert.equal(getBook('B-1').available, 0)
})

test('없는 회원과 없는 책', () => {
  setup()
  rejects(() => checkout('M-9', 'B-1', '2026-10-06'), 'NOT_FOUND')
  rejects(() => checkout('M-1', 'B-9', '2026-10-06'), 'NOT_FOUND')
  assert.equal(getBook('B-1').available, 2)
})
