import { test } from 'node:test'
import assert from 'node:assert'
import { isCouponValid } from '../src/coupons.js'

const c = { startsOn: '2026-10-01', expiresOn: '2026-10-31', used: false }

test('기간 안에서만 쓸 수 있다', () => {
  assert.strictEqual(isCouponValid(c, '2026-10-15T03:00:00Z'), true)
  assert.strictEqual(isCouponValid(c, '2026-09-20T03:00:00Z'), false)
  assert.strictEqual(isCouponValid(c, '2026-11-05T03:00:00Z'), false)
  assert.strictEqual(isCouponValid({ ...c, used: true }, '2026-10-15T03:00:00Z'), false)
})
