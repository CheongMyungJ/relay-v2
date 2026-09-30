import { test } from 'node:test'
import assert from 'node:assert'
import { parseAmount, roundWon, sumAmounts } from '../src/lib/money.js'
import { formatWon } from '../src/format/number.js'

test('쉼표, ₩, 공백이 든 금액', () => {
  assert.strictEqual(parseAmount('1,200'), 1200)
  assert.strictEqual(parseAmount('₩3,000'), 3000)
  assert.strictEqual(parseAmount(' ₩ 1,000,000 '), 1000000)
  assert.strictEqual(parseAmount(500), 500)
})

test('소수점, 음수, 빈 칸', () => {
  assert.strictEqual(parseAmount('12.50'), 12.5)
  assert.strictEqual(parseAmount('-1,200'), -1200)
  assert.strictEqual(parseAmount(''), 0)
  assert.strictEqual(parseAmount(undefined), 0)
  assert.throws(() => parseAmount('abc'))
})

test('합계와 반올림', () => {
  assert.strictEqual(sumAmounts(['1,000', '₩2,500', '-500']), 3000)
  assert.strictEqual(roundWon(2.5), 3)
  assert.strictEqual(roundWon(-2.5), -3)
})

test('금액 글자로', () => {
  assert.strictEqual(formatWon(1200), '₩1,200')
  assert.strictEqual(formatWon(-1200), '-₩1,200')
  assert.strictEqual(formatWon(-1200, { sign: 'paren' }), '(₩1,200)')
  assert.strictEqual(formatWon(12.5), '₩12.50')
})
