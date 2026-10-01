import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'

const read = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')

test('orders.js는 메일과 적립 모듈에 직접 기대지 않고, 메일 구독은 notifications.js에 있다', () => {
  const orders = read('orders.js')
  assert.doesNotMatch(orders, /from '\.\/email\.js'/)
  assert.doesNotMatch(orders, /from '\.\/points\.js'/)
  assert.match(read('notifications.js'), /sendEmail/)
})
