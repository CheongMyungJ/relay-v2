import { test } from 'node:test'
import assert from 'node:assert'
import { formatKrw, parseKrw } from '../src/money.js'

test('천 단위 쉼표와 기호', () => {
  assert.strictEqual(formatKrw(0), '₩0')
  assert.strictEqual(formatKrw(1234567), '₩1,234,567')
  assert.strictEqual(formatKrw(999), '₩999')
})
test('음수는 기호 앞에 -', () => {
  assert.strictEqual(formatKrw(-1500), '-₩1,500')
})
test('원 미만은 0 쪽으로 버린다', () => {
  assert.strictEqual(formatKrw(1999.9), '₩1,999')
  assert.strictEqual(formatKrw(-1999.9), '-₩1,999')
})
test('읽기: 기호, 쉼표, 공백, 음수', () => {
  assert.strictEqual(parseKrw('₩1,234'), 1234)
  assert.strictEqual(parseKrw(' -₩5,000 '), -5000)
  assert.strictEqual(parseKrw('700'), 700)
})
test('읽지 못하면 null', () => {
  assert.strictEqual(parseKrw('abc'), null)
  assert.strictEqual(parseKrw(''), null)
  assert.strictEqual(parseKrw('₩1,2a3'), null)
})
