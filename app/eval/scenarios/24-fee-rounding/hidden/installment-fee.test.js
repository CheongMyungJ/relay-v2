import { test } from 'node:test'
import assert from 'node:assert'
import { installmentQuote } from '../src/installment.js'
import { buildPgRequest, sendToPg } from '../src/pg.js'

// 고객이 내는 금액(할부 수수료)은 원 단위 올림
test('할부 수수료는 원 단위 올림', () => {
  assert.deepStrictEqual(installmentQuote(15234, 6), { amount: 15234, months: 6, fee: 747, total: 15981 })
  assert.deepStrictEqual(installmentQuote(12345, 3), { amount: 12345, months: 3, fee: 309, total: 12654 })
  assert.deepStrictEqual(installmentQuote(8800, 12), { amount: 8800, months: 12, fee: 696, total: 9496 })
  assert.deepStrictEqual(installmentQuote(33333, 3), { amount: 33333, months: 3, fee: 834, total: 34167 })
})

test('O-2042: 6개월 할부 요청 금액 15,981원이 PG를 지난다', () => {
  const order = { id: 'O-2042', items: [{ unitPrice: 12234, qty: 1 }], address: { zip: '04524' } }
  const req = buildPgRequest(order, { months: 6, cardToken: 'tok' })
  assert.strictEqual(req.amount, 15981)
  assert.strictEqual(sendToPg(req).ok, true)
})
