// s2: 반납 처리 (D5, D7, D10)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getBook, getLoan, returnBook } from '../src/index.js'
import { book, loan, rejects, setup } from './helpers.js'

test('제때 반납하면 기록과 재고가 갱신되고 연체료는 0', () => {
  setup({ books: [book({ available: 0 })], loans: [loan()] })
  const done = returnBook('L-0001', '2026-10-15')
  assert.equal(done.returnedOn, '2026-10-15')
  assert.equal(done.feeWon, 0)
  assert.equal(done.id, 'L-0001')
  assert.equal(done.borrowedOn, '2026-10-06')
  assert.deepEqual(getLoan('L-0001'), done)
  assert.equal(getBook('B-1').available, 1)
})

test('기한 당일 반납은 연체가 아니다', () => {
  setup({ books: [book({ available: 0 })], loans: [loan()] })
  assert.equal(returnBook('L-0001', '2026-10-20').feeWon, 0)
})

test('이미 반납한 대출을 다시 반납하면 거절하고 아무것도 바꾸지 않는다', () => {
  setup({ books: [book({ available: 0 })], loans: [loan()] })
  const first = returnBook('L-0001', '2026-10-22')
  rejects(() => returnBook('L-0001', '2026-10-23'), 'ALREADY_RETURNED')
  assert.equal(getBook('B-1').available, 1)
  assert.deepEqual(getLoan('L-0001'), first)
})

test('없는 대출', () => {
  setup()
  rejects(() => returnBook('L-0099', '2026-10-15'), 'NOT_FOUND')
})

test('연체 중에도 반납은 받는다', () => {
  setup({ books: [book({ available: 0 })], loans: [loan()] })
  const done = returnBook('L-0001', '2026-11-30')
  assert.equal(done.returnedOn, '2026-11-30')
  assert.equal(getBook('B-1').available, 1)
})
