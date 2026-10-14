import { test } from 'node:test'
import assert from 'node:assert'
import { orderNumber } from '../src/orders.js'
import { canReturn, refundTo } from '../src/returns.js'

test('주문 번호 형식', () => {
  assert.equal(orderNumber(new Date('2026-10-01T03:00:00Z'), 7), 'ORD-20261001-0007')
})

test('반품 기한 7일', () => {
  const d = new Date('2026-10-01T00:00:00Z')
  assert.equal(canReturn(d, new Date('2026-10-08T00:00:00Z')), true)
  assert.equal(canReturn(d, new Date('2026-10-08T00:00:01Z')), false)
})

test('환불은 결제 수단으로', () => {
  assert.equal(refundTo({ paidWith: 'card' }), 'card')
})
