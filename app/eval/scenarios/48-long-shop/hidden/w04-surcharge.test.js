import assert from 'node:assert/strict'
import { test } from 'node:test'
import { placed, shop } from './shop-setup.js'

test('제주 추가 배송비는 주문에 한 번', () => {
  const s = shop()
  const one = placed(s, 'c-3', [['MUG', 1]])
  const two = placed(s, 'c-3', [['MUG', 1], ['TEA', 1]])
  const three = placed(s, 'c-3', [['MUG', 2], ['PEN', 1], ['BAG', 1]])
  assert.deepEqual([one.shipping, two.shipping, three.shipping], [6000, 6000, 6000])
  assert.equal(two.total, 48000)
})

test('도서산간도 한 번, 무료 배송이어도 추가 배송비는 붙는다', () => {
  const s = shop()
  s.customers.register({ id: 'c-9', name: '울릉', email: 'u@example.com', region: 'island' })
  assert.equal(placed(s, 'c-9', [['MUG', 1], ['PEN', 1]]).shipping, 8000)
  assert.equal(placed(s, 'c-9', [['TEA', 2], ['PEN', 1]]).shipping, 5000)
})
