// s2: 연체료 (D6)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { returnBook } from '../src/index.js'
import { book, loan, setup } from './helpers.js'

const feeOn = (today, over = {}, bookOver = {}) => {
  setup({ books: [book({ available: 0, ...bookOver })], loans: [loan(over)] })
  return returnBook('L-0001', today).feeWon
}

test('하루 100원', () => {
  assert.equal(feeOn('2026-10-21'), 100)
  assert.equal(feeOn('2026-10-22'), 200)
  assert.equal(feeOn('2026-10-24'), 400)
})

test('휴관일은 연체일수에 세지 않는다', () => {
  // 10-21(수)~10-25(일)은 개관, 10-26(월)은 휴관
  assert.equal(feeOn('2026-10-25'), 500)
  assert.equal(feeOn('2026-10-26'), 500)
  assert.equal(feeOn('2026-10-27'), 600)
})

test('공휴일도 세지 않는다', () => {
  // 기한 10-06(화) 뒤: 10-07, 10-08 개관, 10-09 공휴일, 10-10, 10-11 개관, 10-12 월요일
  const over = { borrowedOn: '2026-09-22', baseDueOn: '2026-10-06', dueOn: '2026-10-06' }
  assert.equal(feeOn('2026-10-08', over), 200)
  assert.equal(feeOn('2026-10-09', over), 200)
  assert.equal(feeOn('2026-10-11', over), 400)
  assert.equal(feeOn('2026-10-13', over), 500)
})

test('한 건에 3,000원을 넘지 않는다', () => {
  assert.equal(feeOn('2026-12-30'), 3000)
  assert.equal(feeOn('2026-11-30'), 3000)
})

test('연체료는 feeWon에 저장된다', () => {
  setup({ books: [book({ available: 0 })], loans: [loan()] })
  const done = returnBook('L-0001', '2026-10-23')
  assert.equal(done.feeWon, 300)
})

test('실제 기한(dueOn)을 기준으로 센다', () => {
  // 기준 기한 10-09(공휴일) → 실제 기한 10-10(토). 10-11(일)이 연체 하루째
  const over = { borrowedOn: '2026-09-25', baseDueOn: '2026-10-09', dueOn: '2026-10-10' }
  assert.equal(feeOn('2026-10-10', over), 0)
  assert.equal(feeOn('2026-10-11', over), 100)
})
