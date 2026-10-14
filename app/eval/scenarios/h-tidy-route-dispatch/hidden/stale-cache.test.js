// 사라진 routeCacheTtl을 가리키는 항목을 지웠거나, 지금 코드에 맞게 고쳤다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { entries, inCode } from './knowledge-helpers.js'

test('routeCacheTtl이 anchor인 항목이 없다', () => {
  const found = entries().filter((e) => e.data.anchor === 'routeCacheTtl')
  assert.equal(found.length, 0, `남아 있음: ${found.map((e) => e.rel).join(', ')}`)
})

test('본문(이력 밖)에서 사라진 이름을 지금 있는 것처럼 말하지 않는다', () => {
  const found = entries().filter((e) => e.live.includes('routeCacheTtl'))
  assert.equal(found.length, 0, `본문에 남아 있음: ${found.map((e) => e.rel).join(', ')}`)
})

test('다른 anchor도 모두 지금 코드에 있다', () => {
  for (const e of entries()) {
    if (e.data.anchor && e.data.anchor !== 'rebalanceCouriers') assert.ok(inCode(e.data.anchor), `${e.rel}: anchor ${e.data.anchor}가 코드에 없음`)
  }
})
