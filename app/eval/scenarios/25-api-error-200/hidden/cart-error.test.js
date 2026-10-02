import { test } from 'node:test'
import assert from 'node:assert'
import { handle } from '../src/server.js'
import { assertAppError, seed, user } from './helpers.js'

const add = (ctx, body) => handle({ method: 'POST', path: '/cart/items', user, body }, ctx)
const cart = (ctx) => handle({ method: 'GET', path: '/cart', user }, ctx).body.data

test('수량이 0이나 음수면 담지 않고 HTTP 200 오류 본문', () => {
  const ctx = { db: seed() }
  add(ctx, { productId: 'P-100', qty: 2 })
  for (const qty of [0, -1]) {
    assertAppError(assert, add(ctx, { productId: 'P-100', qty }))
  }
  assert.deepStrictEqual(cart(ctx), [{ productId: 'P-100', name: '텀블러', price: 18000, qty: 2 }])
})

test('없는 상품이면 담지 않고 HTTP 200 오류 본문', () => {
  const ctx = { db: seed() }
  assertAppError(assert, add(ctx, { productId: 'P-404', qty: 1 }))
  assert.deepStrictEqual(cart(ctx), [])
})
