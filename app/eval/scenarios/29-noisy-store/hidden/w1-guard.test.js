import { test } from 'node:test'
import assert from 'node:assert'
import { isCouponValid } from '../src/coupons.js'

// 지키기: 기간 한가운데, 쓴 쿠폰
test('기간 한가운데와 쓴 쿠폰은 그대로', () => {
  const c = { startsOn: '2026-10-01', expiresOn: '2026-10-31', used: false }
  assert.strictEqual(isCouponValid(c, '2026-10-15T03:00:00Z'), true)
  assert.strictEqual(isCouponValid({ ...c, used: true }, '2026-10-15T03:00:00Z'), false)
})
