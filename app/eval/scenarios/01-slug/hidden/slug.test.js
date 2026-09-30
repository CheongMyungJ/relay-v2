import { test } from 'node:test'
import assert from 'node:assert'
import { slugify } from '../src/slug.js'

test('공백이 여럿인 제목', () => {
  assert.strictEqual(slugify('Hello Big World'), 'hello-big-world')
  assert.strictEqual(slugify('a b c d'), 'a-b-c-d')
})

test('기존 동작 유지', () => {
  assert.strictEqual(slugify('Hello'), 'hello')
  assert.strictEqual(slugify('  Trim Me  '), 'trim-me')
})
