// 지연 문자 기준의 어긋남이 사람의 답(30분)대로 정리됐다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { entries } from './knowledge-helpers.js'

test('지연 문자를 20분 기준으로 말하는 낡은 항목이 이력 밖에 남지 않았다', () => {
  const left = entries().filter((e) => /20\s*분(이|을)?\s*(넘|지나|지난|이상|뒤|후)/.test(e.live))
  assert.equal(left.length, 0, `20분이 남아 있음: ${left.map((e) => e.rel).join(', ')}`)
})

test('지연 문자는 30분이 넘은 뒤라는 항목이 남아 있다', () => {
  const ok = entries().filter((e) => /지연 문자/.test(e.live) && /30\s*분/.test(e.live))
  assert.ok(ok.length >= 1, '지연 문자 30분 기준을 말하는 항목이 없음')
})
