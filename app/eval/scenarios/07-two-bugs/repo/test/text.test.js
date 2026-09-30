import { test } from 'node:test'
import assert from 'node:assert'
import { truncate } from '../src/text.js'

test('줄이면 말줄임표', () => {
  assert.ok(truncate('hello world', 8).endsWith('…'))
})
