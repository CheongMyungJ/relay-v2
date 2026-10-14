import { test } from 'node:test'
import assert from 'node:assert'
import { entries } from './kn.js'

test('없어진 대출 연장(RENEWAL_DAYS)을 말하는 항목이 남지 않았다', () => {
  for (const e of entries()) {
    assert.notEqual(e.anchor, 'RENEWAL_DAYS', e.path)
    assert.ok(!/(연장|RENEWAL)/.test(e.body), e.path)
  }
})
