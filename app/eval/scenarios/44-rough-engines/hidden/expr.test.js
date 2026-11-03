import { test } from 'node:test'
import assert from 'node:assert'
import { evaluate } from '../src/expr.js'

test('사칙연산, 나머지, 괄호, 우선순위', () => {
  assert.strictEqual(evaluate('1 + 2 * 3'), 7)
  assert.strictEqual(evaluate('(1 + 2) * 3'), 9)
  assert.strictEqual(evaluate('10 / 4'), 2.5)
  assert.strictEqual(evaluate('10 % 4 + 0.5'), 2.5)
  assert.strictEqual(evaluate('8 - 3 - 2'), 3)
})

test('거듭제곱은 오른쪽부터, 단항 마이너스보다 먼저', () => {
  assert.strictEqual(evaluate('2 ^ 3 ^ 2'), 512)
  assert.strictEqual(evaluate('-2 ^ 2'), -4)
  assert.strictEqual(evaluate('(-2) ^ 2'), 4)
  assert.strictEqual(evaluate('2 * -3'), -6)
})

test('변수', () => {
  assert.strictEqual(evaluate('price * qty - discount', { price: 1200, qty: 3, discount: 600 }), 3000)
  assert.throws(() => evaluate('a + b', { a: 1 }), /unknown variable: b/)
})

test('함수: min, max, abs, round(자릿수), 반올림은 0에서 먼 쪽', () => {
  assert.strictEqual(evaluate('min(3, 1, 2) + max(4, 9)'), 10)
  assert.strictEqual(evaluate('abs(-7)'), 7)
  assert.strictEqual(evaluate('round(2.5)'), 3)
  assert.strictEqual(evaluate('round(-2.5)'), -3)
  assert.strictEqual(evaluate('round(3.14159, 2)'), 3.14)
  assert.throws(() => evaluate('sqrt(4)'), /unknown function: sqrt/)
})

test('오류: 0으로 나눔, 틀린 문법', () => {
  assert.throws(() => evaluate('1 / (2 - 2)'), /division by zero/)
  assert.throws(() => evaluate('1 +'), /syntax/)
  assert.throws(() => evaluate('(1 + 2'), /syntax/)
  assert.throws(() => evaluate('2 3'), /syntax/)
})
