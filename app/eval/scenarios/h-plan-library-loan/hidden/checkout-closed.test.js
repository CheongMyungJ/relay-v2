// s1: 휴관일에는 대출 창구가 닫혀 빌릴 수 없다 (사람만 아는 규칙, 코드 CLOSED)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkout, getBook, listLoans } from '../src/index.js'
import { rejects, setup } from './helpers.js'

test('월요일에는 빌릴 수 없다', () => {
  setup()
  rejects(() => checkout('M-1', 'B-1', '2026-10-12'), 'CLOSED')
  assert.equal(getBook('B-1').available, 2)
  assert.equal(listLoans().length, 0)
})

test('공휴일에도 빌릴 수 없다', () => {
  setup()
  rejects(() => checkout('M-1', 'B-1', '2026-10-09'), 'CLOSED')
})

test('개관일이면 빌릴 수 있다', () => {
  setup()
  assert.equal(checkout('M-1', 'B-1', '2026-10-13').borrowedOn, '2026-10-13')
})
