import { test } from 'node:test'
import assert from 'node:assert'
import { pageCount } from '../src/page.js'

test('딱 나누어떨어지는 쪽 수', () => {
  assert.strictEqual(pageCount(20, 10), 2)
})
