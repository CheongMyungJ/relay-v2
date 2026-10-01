import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import { linePrice } from '../src/price.js'

test('줄 가격은 src/price.js의 linePrice 한 곳에서 계산한다', () => {
  assert.strictEqual(linePrice({ name: '배', unitPrice: 1999, qty: 1, discountRate: 0.15 }), 1699)
  assert.strictEqual(linePrice({ name: '사과', unitPrice: 1000, qty: 3 }), 3000)
  const cart = fs.readFileSync(new URL('../src/cart.js', import.meta.url), 'utf8')
  assert.match(cart, /from '\.\/price\.js'/)
  assert.doesNotMatch(cart, /Math\.round/, 'cart.js에 가격 계산이 남아 있음')
})
