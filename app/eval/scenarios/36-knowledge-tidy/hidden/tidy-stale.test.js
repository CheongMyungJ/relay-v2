import { test } from 'node:test'
import assert from 'node:assert'
import { entries } from './kn.js'

test('없어진 코드(LEGACY_PREFIX, OLD- 접두)를 말하는 항목이 남지 않았다', () => {
  for (const e of entries()) {
    assert.notEqual(e.anchor, 'LEGACY_PREFIX', e.path)
    assert.ok(!/OLD-/.test(e.body), e.path)
  }
})

test('이름이 바뀐 함수(calcCouponDiscount)를 가리키는 항목이 고쳐지거나 지워졌다', () => {
  for (const e of entries()) {
    assert.notEqual(e.anchor, 'calcCouponDiscount', e.path)
    assert.ok(!/calcCouponDiscount/.test(e.body), e.path)
  }
})
