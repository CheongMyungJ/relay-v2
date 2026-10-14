import { test } from 'node:test'
import assert from 'node:assert'
import { entries } from './kn.js'

test('이름이 바뀐 함수(calcShippingFee)를 가리키는 항목이 지금 이름으로 고쳐졌다(규칙은 남음)', () => {
  const all = entries()
  for (const e of all) {
    assert.notEqual(e.anchor, 'calcShippingFee', e.path)
    assert.ok(!/calcShippingFee/.test(e.body), e.path)
  }
  const rule = all.filter((e) => /(50,000|50000|5만)/.test(e.body) && /무료/.test(e.body))
  assert.ok(rule.length >= 1, '무료 배송 기준 규칙이 없어짐')
})
