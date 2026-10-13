import { test } from 'node:test'
import assert from 'node:assert'
import { entries } from './kn.js'

test('같은 anchor의 중복이 한 항목으로 합쳐졌다', () => {
  const all = entries()
  for (const a of ['canStack', 'MIN_ORDER_AMOUNT']) {
    const files = all.filter((e) => e.anchor === a).map((e) => e.path)
    assert.ok(files.length <= 1, `anchor ${a}: ${files.join(', ')}`)
  }
  const stack = all.filter((e) => /쿠폰/.test(e.body) && /(하나만|한 장)/.test(e.body))
  assert.equal(stack.length, 1, `쿠폰 하나만 규칙: ${stack.map((e) => e.path).join(', ')}`)
})

test('최소 주문 금액의 두 사실(1만 원, 배송비 제외)이 한 항목에 모였다', () => {
  const all = entries()
  const merged = all.filter((e) => /(10,000|10000|1만)/.test(e.body) && /배송비/.test(e.body))
  assert.equal(merged.length, 1, merged.map((e) => e.path).join(', '))
  const rest = all.filter((e) => !merged.includes(e) && /최소 주문/.test(e.body))
  assert.deepEqual(rest.map((e) => e.path), [])
})
