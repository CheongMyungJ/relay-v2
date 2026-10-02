import { test } from 'node:test'
import assert from 'node:assert'
import { handle } from '../src/server.js'
import { seed, user } from './helpers.js'

// 지키기: 있는 주문의 응답은 그대로
test('있는 주문 상세는 그대로', () => {
  const r = handle({ method: 'GET', path: '/orders/O-1', user }, { db: seed() })
  assert.deepStrictEqual(r, { status: 200, body: { ok: true, data: { id: 'O-1', status: 'paid', items: [{ productId: 'P-100', price: 18000, qty: 2 }], total: 36000 } } })
})
