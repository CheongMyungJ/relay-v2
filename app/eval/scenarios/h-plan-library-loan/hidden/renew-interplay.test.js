// s3: 연장한 대출이 s1(대출 제한)과 s2(반납, 연체료)의 규칙대로 계속 동작한다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkout, getBook, getLoan, listLoans, renewLoan, returnBook } from '../src/index.js'
import { book, manyBooks, rejects, setup } from './helpers.js'

test('연장한 대출의 연체료는 새 기한으로 센다', () => {
  setup({ books: [book({ available: 1 })] })
  const l = checkout('M-1', 'B-1', '2026-10-06') // 기한 10-20
  renewLoan(l.id, '2026-10-15') // 새 기한 11-03
  const done = returnBook(l.id, '2026-10-30') // 옛 기한은 지났지만 새 기한 전
  assert.equal(done.feeWon, 0)
  assert.equal(done.returnedOn, '2026-10-30')
})

test('새 기한을 넘기면 새 기한 다음 날부터 연체다', () => {
  setup({ books: [book({ available: 1 })] })
  const l = checkout('M-1', 'B-1', '2026-10-06')
  renewLoan(l.id, '2026-10-15')
  assert.equal(returnBook(l.id, '2026-11-03').feeWon, 0)
  setup({ books: [book({ available: 1 })] })
  const m = checkout('M-1', 'B-1', '2026-10-06')
  renewLoan(m.id, '2026-10-15')
  assert.equal(returnBook(m.id, '2026-11-06').feeWon, 300) // 11-04, 11-05, 11-06
})

test('휴관일이 낀 연장 기한의 연체료', () => {
  setup({ books: [book({ available: 1 })] })
  const l = checkout('M-1', 'B-1', '2026-10-20') // 기준 11-03
  renewLoan(l.id, '2026-10-28') // 기준 11-17 → 실제 11-18
  assert.equal(returnBook(l.id, '2026-11-18').feeWon, 0)
  setup({ books: [book({ available: 1 })] })
  const m = checkout('M-1', 'B-1', '2026-10-20')
  renewLoan(m.id, '2026-10-28')
  assert.equal(returnBook(m.id, '2026-11-20').feeWon, 200)
})

test('연장한 대출을 반납하면 재고가 한 번만 늘고 다시 반납할 수 없다', () => {
  setup({ books: [book({ available: 1 })] })
  const l = checkout('M-1', 'B-1', '2026-10-06')
  renewLoan(l.id, '2026-10-15')
  assert.equal(getBook('B-1').available, 0)
  returnBook(l.id, '2026-10-20')
  assert.equal(getBook('B-1').available, 1)
  rejects(() => returnBook(l.id, '2026-10-21'), 'ALREADY_RETURNED')
  assert.equal(getBook('B-1').available, 1)
  rejects(() => renewLoan(l.id, '2026-10-21'), 'ALREADY_RETURNED')
})

test('연장은 새 대출이 아니라서 권수 제한에 더해지지 않는다', () => {
  setup({ books: manyBooks(6) })
  const loans = [1, 2, 3, 4].map((n) => checkout('M-1', `B-${n}`, '2026-10-06'))
  renewLoan(loans[0].id, '2026-10-15')
  renewLoan(loans[1].id, '2026-10-15')
  assert.equal(listLoans().length, 4)
  const fifth = checkout('M-1', 'B-5', '2026-10-16')
  assert.equal(fifth.bookId, 'B-5')
  rejects(() => checkout('M-1', 'B-6', '2026-10-16'), 'LIMIT')
  assert.equal(listLoans().length, 5)
})

test('연체 차단은 연장한 기한으로 판단한다', () => {
  setup({ books: manyBooks(2) })
  const l = checkout('M-1', 'B-1', '2026-10-06') // 기한 10-20
  renewLoan(l.id, '2026-10-15') // 새 기한 11-03
  const other = checkout('M-1', 'B-2', '2026-10-28') // 옛 기한은 지났지만 연체가 아니다
  assert.equal(other.bookId, 'B-2')
})

test('연장한 대출을 반납하면 대출 칸이 비고 같은 책도 다시 빌린다', () => {
  setup({ books: [book({ available: 1 })] })
  const l = checkout('M-1', 'B-1', '2026-10-06')
  renewLoan(l.id, '2026-10-15')
  returnBook(l.id, '2026-10-16')
  const again = checkout('M-1', 'B-1', '2026-10-17')
  assert.notEqual(again.id, l.id)
  assert.equal(getLoan(l.id).renewals, 1)
})
