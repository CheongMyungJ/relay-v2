import { test } from 'node:test'
import assert from 'node:assert'
import { truncate } from '../src/text.js'

test('truncate', () => {
  assert.strictEqual(truncate('hello world', 8), 'hello w…')
  assert.strictEqual(truncate('hello world', 8).length, 8)
  assert.strictEqual(truncate('short', 8), 'short')
  assert.strictEqual(truncate('exactly8', 8), 'exactly8')
})
