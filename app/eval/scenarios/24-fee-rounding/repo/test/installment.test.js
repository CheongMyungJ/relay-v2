import { test } from 'node:test'
import assert from 'node:assert'
import { installmentQuote } from '../src/installment.js'

test('일시불은 수수료가 없다', () => {
  assert.deepStrictEqual(installmentQuote(15234, 1), { amount: 15234, months: 1, fee: 0, total: 15234 })
})

test('지원하지 않는 개월은 오류', () => {
  assert.throws(() => installmentQuote(10000, 5), /지원하지 않는 할부 개월/)
})
