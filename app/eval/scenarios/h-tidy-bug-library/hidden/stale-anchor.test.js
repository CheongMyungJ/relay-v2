import { test } from 'node:test'
import assert from 'node:assert'
import { entries } from './kn.js'

test('이름이 바뀐 함수(checkoutAllowed)를 가리키는 항목이 지금 이름으로 고쳐졌다(규칙은 남음)', () => {
  const all = entries()
  for (const e of all) {
    assert.notEqual(e.anchor, 'checkoutAllowed', e.path)
    assert.ok(!/checkoutAllowed/.test(e.body), e.path)
  }
  const rule = all.filter((e) => /(5권|다섯 권)/.test(e.body) && /(빌|대출)/.test(e.body))
  assert.ok(rule.length >= 1, '대출 권수 규칙이 없어짐')
})
