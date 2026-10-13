// s1 guard: 달력과 저장소는 그대로
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getBook, getLoan, isOpenDay, nextLoanId, nextOpenDay, resetBooks, resetLoans, saveBook, saveLoan } from '../src/index.js'

test('달력', () => {
  assert.equal(isOpenDay('2026-10-12'), false)
  assert.equal(isOpenDay('2026-10-09'), false)
  assert.equal(isOpenDay('2026-10-13'), true)
  assert.equal(nextOpenDay('2026-10-12'), '2026-10-13')
  assert.equal(nextOpenDay('2026-12-31'), '2027-01-02')
})

test('저장소는 복사본을 주고 save로 저장한다', () => {
  resetBooks([{ id: 'B-1', title: '책', available: 2, priceWon: 1000, holds: 0 }])
  const b = getBook('B-1')
  b.available = 0
  assert.equal(getBook('B-1').available, 2)
  saveBook(b)
  assert.equal(getBook('B-1').available, 0)
  resetLoans([])
  assert.equal(nextLoanId(), 'L-0001')
  saveLoan({ id: 'L-0001', memberId: 'M-1' })
  assert.equal(getLoan('L-0001').memberId, 'M-1')
})
