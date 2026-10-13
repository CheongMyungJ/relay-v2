// s2 guard: 반납이 생겨도 대출 규칙(s1)은 그대로다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkout, getBook, getLoan, listLoans } from '../src/index.js'
import { loan, manyBooks, rejects, setup } from './helpers.js'

test('기한 계산과 휴관일 보정', () => {
  setup({ books: manyBooks(3) })
  assert.equal(checkout('M-1', 'B-1', '2026-10-06').dueOn, '2026-10-20')
  const shifted = checkout('M-1', 'B-2', '2026-09-25')
  assert.equal(shifted.baseDueOn, '2026-10-09')
  assert.equal(shifted.dueOn, '2026-10-10')
})

test('다섯 권 제한과 같은 책 제한', () => {
  const loans = [1, 2, 3, 4, 5].map((n) => loan({ id: `L-000${n}`, bookId: `B-${n}` }))
  setup({ books: manyBooks(6), loans })
  rejects(() => checkout('M-1', 'B-6', '2026-10-07'), 'LIMIT')
  assert.equal(getBook('B-6').available, 2)
})

test('연체 중에는 못 빌리고 기한 당일까지는 빌린다', () => {
  setup({ books: manyBooks(2), loans: [loan({ dueOn: '2026-10-06', baseDueOn: '2026-10-06' })] })
  assert.equal(checkout('M-1', 'B-2', '2026-10-06').bookId, 'B-2')
  setup({ books: manyBooks(2), loans: [loan({ dueOn: '2026-10-06', baseDueOn: '2026-10-06' })] })
  rejects(() => checkout('M-1', 'B-2', '2026-10-07'), 'OVERDUE_BLOCK')
})

test('재고와 거절', () => {
  setup({ books: manyBooks(1, { available: 0 }) })
  rejects(() => checkout('M-1', 'B-1', '2026-10-06'), 'NO_COPIES')
  rejects(() => checkout('M-9', 'B-1', '2026-10-06'), 'NOT_FOUND')
  assert.equal(listLoans().length, 0)
  assert.equal(getLoan('L-0001'), null)
})
