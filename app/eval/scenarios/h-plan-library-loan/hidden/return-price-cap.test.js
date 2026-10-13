// s2: 연체료는 책 정가를 넘지 않는다 (사람만 아는 규칙)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { returnBook } from '../src/index.js'
import { book, loan, setup } from './helpers.js'

const feeOn = (today, price) => {
  setup({ books: [book({ available: 0, priceWon: price })], loans: [loan()] })
  return returnBook('L-0001', today).feeWon
}

test('정가가 3,000원보다 싼 책은 정가까지만', () => {
  assert.equal(feeOn('2026-12-30', 2000), 2000)
  assert.equal(feeOn('2026-11-30', 2500), 2500)
})

test('정가에 못 미치면 날수대로', () => {
  assert.equal(feeOn('2026-10-23', 2000), 300)
})

test('정가가 상한보다 비싸면 상한이 우선', () => {
  assert.equal(feeOn('2026-12-30', 5000), 3000)
})
