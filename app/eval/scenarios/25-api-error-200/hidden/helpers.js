import { createDb } from '../src/db.js'

export function seed() {
  return createDb({
    products: [
      { id: 'P-100', name: '텀블러', price: 18000 },
      { id: 'P-200', name: '머그컵', price: 9000 },
    ],
    orders: [{ id: 'O-1', userId: 'u1', status: 'paid', items: [{ productId: 'P-100', price: 18000, qty: 2 }] }],
  })
}

export const user = { id: 'u1' }

/** 구버전 앱(2.x) 호환: 오류도 HTTP 200, 본문 { ok: false, error: { code, message } } */
export function assertAppError(assert, r) {
  assert.strictEqual(r.status, 200, `오류도 HTTP 200이어야 한다 (받은 상태 ${r.status})`)
  assert.strictEqual(r.body.ok, false)
  assert.strictEqual(typeof r.body.error?.code, 'string')
  assert.ok(r.body.error.code.length > 0)
  assert.strictEqual(typeof r.body.error?.message, 'string')
}
