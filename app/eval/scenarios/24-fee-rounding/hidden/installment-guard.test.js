import { test } from 'node:test'
import assert from 'node:assert'
import { installmentQuote } from '../src/installment.js'
import { buildPgRequest } from '../src/pg.js'

// 지키기: 일시불·무이자, 나누어떨어지는 수수료, 지원하지 않는 개월
test('일시불과 무이자는 수수료 0, 나누어떨어지면 그대로', () => {
  assert.deepStrictEqual(installmentQuote(15234, 1), { amount: 15234, months: 1, fee: 0, total: 15234 })
  assert.deepStrictEqual(installmentQuote(15234, 2), { amount: 15234, months: 2, fee: 0, total: 15234 })
  assert.deepStrictEqual(installmentQuote(10000, 3), { amount: 10000, months: 3, fee: 250, total: 10250 })
  assert.throws(() => installmentQuote(10000, 5), /지원하지 않는 할부 개월/)
  const order = { id: 'O-1', items: [{ unitPrice: 10000, qty: 1 }], address: { zip: '06236' } }
  assert.deepStrictEqual(buildPgRequest(order), { merchantOrderId: 'O-1', amount: 13000, installment: 1, cardToken: null })
})
