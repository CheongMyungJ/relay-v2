import { test } from 'node:test'
import assert from 'node:assert'
import { handle } from '../src/server.js'
import { seed, user } from './helpers.js'

test('상품 목록은 숨긴 상품을 빼고 보인다', () => {
  const r = handle({ method: 'GET', path: '/products', user }, { db: seed() })
  assert.strictEqual(r.status, 200)
  assert.deepStrictEqual(r.body.data.map((p) => p.id), ['P-100', 'P-200'])
})

test('주문 상세', () => {
  const r = handle({ method: 'GET', path: '/orders/O-1', user }, { db: seed() })
  assert.deepStrictEqual(r, { status: 200, body: { ok: true, data: { id: 'O-1', status: 'paid', items: [{ productId: 'P-100', price: 18000, qty: 2 }], total: 36000 } } })
})

test('장바구니에 담으면 같은 상품은 수량을 더한다', () => {
  const ctx = { db: seed() }
  handle({ method: 'POST', path: '/cart/items', user, body: { productId: 'P-100', qty: 1 } }, ctx)
  const r = handle({ method: 'POST', path: '/cart/items', user, body: { productId: 'P-100', qty: 2 } }, ctx)
  assert.deepStrictEqual(r.body.data, [{ productId: 'P-100', name: '텀블러', price: 18000, qty: 3 }])
})
