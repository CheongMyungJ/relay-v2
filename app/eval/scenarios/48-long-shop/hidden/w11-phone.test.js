import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paidOrder, shop } from './shop-setup.js'

test('상담 요약의 연락처는 가운데를 가린 전화번호', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 1]])
  const text = s.orders.supportSummary(o.id)
  assert.equal(text.split('\n')[1], '고객 김하나 · 010-****-5678')
  assert.doesNotMatch(text, /1234-5678/)
  const v = paidOrder(s, 'c-4', [['MUG', 1]])
  assert.equal(s.orders.supportSummary(v.id).split('\n')[1], '고객 이보라 · 010-****-4040')
})
