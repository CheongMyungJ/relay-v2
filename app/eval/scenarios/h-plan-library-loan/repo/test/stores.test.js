import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getBook, getLoan, nextLoanId, resetBooks, resetLoans, saveBook, saveLoan } from '../src/index.js'

test('책은 복사본으로 읽고 saveBook으로 저장한다', () => {
  resetBooks([{ id: 'B-1', title: '책', available: 2, priceWon: 10000, holds: 0 }])
  const b = getBook('B-1')
  b.available = 1
  assert.equal(getBook('B-1').available, 2)
  saveBook(b)
  assert.equal(getBook('B-1').available, 1)
  assert.equal(getBook('B-9'), null)
})

test('대출 번호는 이어서 붙는다', () => {
  resetLoans([])
  assert.equal(nextLoanId(), 'L-0001')
  saveLoan({ id: 'L-0001', memberId: 'M-1', bookId: 'B-1' })
  assert.equal(nextLoanId(), 'L-0002')
  assert.equal(getLoan('L-0001').memberId, 'M-1')
})
