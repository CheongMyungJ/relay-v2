import { test } from 'node:test'
import assert from 'node:assert'
import { formatDate } from '../src/format.js'

test('없으면 N/A', () => {
  assert.strictEqual(formatDate(null), 'N/A')
})
