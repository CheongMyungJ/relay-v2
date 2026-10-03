import { test } from 'node:test'
import assert from 'node:assert'
import { assertWon, parseWon, percentOf, splitWon, sumWon } from '../src/money.js'

test('금액 글 읽기', () => {
  assert.strictEqual(parseWon('29,082원'), 29082)
  assert.strictEqual(parseWon('₩1,200'), 1200)
  assert.strictEqual(parseWon(' 500 '), 500)
  assert.strictEqual(parseWon('-3,000원'), -3000)
  assert.throws(() => parseWon('12,34'))
  assert.throws(() => parseWon('1.5'))
})

test('정수 원만 받는다', () => {
  assert.strictEqual(sumWon([100, 200, 300]), 600)
  assert.throws(() => sumWon([100, 0.5]))
  assert.throws(() => assertWon('100'))
})

test('비율 금액', () => {
  assert.strictEqual(percentOf(12000, 15), 1800)
  assert.strictEqual(percentOf(5000, 0), 0)
  assert.throws(() => percentOf(1000, 120))
})

test('금액 나누기', () => {
  assert.deepStrictEqual(splitWon(10000, 3), [3334, 3333, 3333])
  assert.deepStrictEqual(splitWon(9, 3), [3, 3, 3])
  assert.strictEqual(sumWon(splitWon(12345, 7)), 12345)
})
