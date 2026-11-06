import assert from 'node:assert/strict'
import { test } from 'node:test'
import { errorCode, setup } from './helpers.js'

test('결제와 환불', () => {
  const { payments } = setup()
  const r = payments.charge({ amount: 10000, cardToken: 'tok-visa', reference: 'A-1' })
  assert.equal(r.ok, true)
  payments.refund(r.ref, 4000)
  payments.refund(r.ref, 6000)
  assert.throws(() => payments.refund(r.ref, 1), errorCode('BAD_AMOUNT'))
  assert.deepEqual(payments.listFor('A-1').map((p) => [p.kind, p.amount]), [['charge', 10000], ['refund', 4000], ['refund', 6000]])
})

test('시험용 실패 카드', () => {
  const { payments } = setup()
  assert.deepEqual(payments.charge({ amount: 1000, cardToken: 'tok-declined', reference: 'A-2' }), { ok: false, reason: 'declined' })
  assert.deepEqual(payments.charge({ amount: 1000, cardToken: 'tok-expired', reference: 'A-2' }), { ok: false, reason: 'expired' })
  assert.deepEqual(payments.charge({ amount: 1000, reference: 'A-2' }), { ok: false, reason: 'no-card' })
  assert.throws(() => payments.charge({ amount: 0, cardToken: 'tok-visa' }), errorCode('BAD_AMOUNT'))
})
