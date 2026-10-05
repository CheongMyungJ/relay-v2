import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'

const read = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')

test('할인 계산은 src/discount.js 한 곳에 있다', () => {
  assert.ok(fs.existsSync(new URL('../src/discount.js', import.meta.url)), 'src/discount.js가 없음')
  for (const f of ['cart.js', 'checkout.js']) {
    const text = read(f)
    assert.match(text, /from '\.\/discount\.js'/, `${f}가 discount.js를 쓰지 않음`)
    assert.doesNotMatch(text, /0\.9\d|0\.0\d|coupon\s*\)|-\s*coupon|-=\s*coupon/, `${f}에 할인 계산이 남아 있음`)
  }
})
