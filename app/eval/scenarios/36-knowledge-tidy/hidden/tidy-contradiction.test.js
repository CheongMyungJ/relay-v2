import { test } from 'node:test'
import assert from 'node:assert'
import { entries } from './kn.js'

test('환불 쿠폰 규칙의 어긋남이 사람의 답(되돌려 준다)대로 정리됐다', () => {
  const all = entries()
  for (const e of all) {
    assert.ok(!/쓰는 순간 소멸/.test(e.body), e.path)
    assert.ok(!/환불해도[^.\n]*(돌려주지|되돌려 주지) 않/.test(e.body), e.path)
  }
  assert.ok(
    all.some((e) => /환불하면[^.\n]*(되돌려|돌려) ?준다/.test(e.body)),
    '환불하면 되돌려 준다는 규칙이 남아 있어야 한다',
  )
})
