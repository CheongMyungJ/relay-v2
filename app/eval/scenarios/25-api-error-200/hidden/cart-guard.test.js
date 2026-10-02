import { test } from 'node:test'
import assert from 'node:assert'
import { handle } from '../src/server.js'
import { seed, user } from './helpers.js'

// 지키기: 정상 담기와 같은 상품의 수량 더하기는 그대로
test('정상 담기는 그대로', () => {
  const ctx = { db: seed() }
  handle({ method: 'POST', path: '/cart/items', user, body: { productId: 'P-100', qty: 1 } }, ctx)
  const r = handle({ method: 'POST', path: '/cart/items', user, body: { productId: 'P-100', qty: 2 } }, ctx)
  assert.deepStrictEqual(r, { status: 200, body: { ok: true, data: [{ productId: 'P-100', name: '텀블러', price: 18000, qty: 3 }] } })
})
