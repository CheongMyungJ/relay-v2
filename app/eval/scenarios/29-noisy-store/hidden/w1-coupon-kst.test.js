import { test } from 'node:test'
import assert from 'node:assert'
import { isCouponValid } from '../src/coupons.js'

// 팀 규칙(Work 1): 날짜 경계는 한국 시간(KST, UTC+9) 자정. 만료일은 그날 KST 23:59:59까지 유효
const c = { startsOn: '2026-10-01', expiresOn: '2026-10-31', used: false }
test('쿠폰 기간은 KST 날짜로 센다', () => {
  assert.strictEqual(isCouponValid(c, '2026-10-31T14:59:59Z'), true)
  assert.strictEqual(isCouponValid(c, '2026-10-31T15:00:00Z'), false)
  assert.strictEqual(isCouponValid(c, '2026-10-31T19:40:00Z'), false)
  assert.strictEqual(isCouponValid(c, '2026-09-30T15:00:00Z'), true)
  assert.strictEqual(isCouponValid(c, '2026-09-30T14:59:59Z'), false)
})
