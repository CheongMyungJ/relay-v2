import assert from 'node:assert/strict'
import { test } from 'node:test'
import { placed, shop } from './shop-setup.js'

test('VIP는 3만원부터 무료 배송', () => {
  const s = shop()
  assert.equal(placed(s, 'c-4', [['TEA', 1], ['PEN', 1]]).shipping, 0) // 32,000원
  assert.equal(placed(s, 'c-4', [['TEA', 1]]).shipping, 0) // 30,000원
  assert.equal(placed(s, 'c-4', [['MUG', 2], ['PEN', 1]]).shipping, 3000) // 26,000원
})

test('일반 고객은 그대로 5만원', () => {
  const s = shop()
  assert.equal(placed(s, 'c-1', [['TEA', 1], ['PEN', 1]]).shipping, 3000)
  assert.equal(placed(s, 'c-1', [['TEA', 1], ['MUG', 2]]).shipping, 0)
})

test('VIP도 제주 추가 배송비는 붙는다', () => {
  const s = shop()
  s.customers.register({ id: 'c-10', name: '한라 VIP', email: 'v@example.com', region: 'jeju', tier: 'vip' })
  assert.equal(placed(s, 'c-10', [['TEA', 1], ['PEN', 1]]).shipping, 3000)
})
