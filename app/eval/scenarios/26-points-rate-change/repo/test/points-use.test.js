import { test } from 'node:test'
import assert from 'node:assert'
import { assertPointUse } from '../src/points/use.js'

test('1,000P부터 10P 단위', () => {
  assert.throws(() => assertPointUse(990, 5000, 20000), /1000P부터/)
  assert.throws(() => assertPointUse(1005, 5000, 20000), /10P 단위/)
  assert.doesNotThrow(() => assertPointUse(1010, 5000, 20000))
})

test('가진 포인트와 상품 금액을 넘지 않는다', () => {
  assert.throws(() => assertPointUse(3000, 2000, 20000), /가진 포인트/)
  assert.throws(() => assertPointUse(3000, 9000, 2500), /상품 금액/)
})
