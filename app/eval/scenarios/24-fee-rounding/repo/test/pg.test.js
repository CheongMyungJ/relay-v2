import { test } from 'node:test'
import assert from 'node:assert'
import { buildPgRequest, sendToPg } from '../src/pg.js'

test('일시불 결제 요청', () => {
  const order = { id: 'O-1', items: [{ unitPrice: 10000, qty: 1 }], address: { zip: '06236' } }
  const req = buildPgRequest(order, { cardToken: 'tok' })
  assert.deepStrictEqual(req, { merchantOrderId: 'O-1', amount: 13000, installment: 1, cardToken: 'tok' })
  assert.deepStrictEqual(sendToPg(req), { ok: true, approvalNo: 'A-O-1' })
})
