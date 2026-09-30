import { test } from 'node:test'
import assert from 'node:assert'
import { discountRate, formatKRW, parseKRW } from '../src/util/money.js'
import { clamp, round, toPositiveInt } from '../src/util/number.js'

test('금액 표시', () => {
  assert.strictEqual(formatKRW(12900), '12,900원')
  assert.strictEqual(formatKRW(1890000), '1,890,000원')
  assert.strictEqual(formatKRW(-500), '-500원')
  assert.strictEqual(formatKRW(NaN), '-')
})

test('금액 읽기', () => {
  assert.strictEqual(parseKRW('12,900원'), 12900)
  assert.strictEqual(parseKRW('₩ 3000'), 3000)
  assert.strictEqual(parseKRW('3만'), 30000)
  assert.strictEqual(parseKRW('2.5만'), 25000)
  assert.ok(Number.isNaN(parseKRW('abc')))
  assert.ok(Number.isNaN(parseKRW('')))
})

test('할인율', () => {
  assert.strictEqual(discountRate(45000, 52000), 13)
  assert.strictEqual(discountRate(10000, 10000), 0)
  assert.strictEqual(discountRate(10000, 0), 0)
})

test('숫자 도우미', () => {
  assert.strictEqual(clamp(5, 1, 3), 3)
  assert.strictEqual(toPositiveInt('4', 1), 4)
  assert.strictEqual(toPositiveInt(0, 7), 7)
  assert.strictEqual(toPositiveInt(2.5, 7), 7)
  assert.strictEqual(round(1.23456), 1.2346)
})
