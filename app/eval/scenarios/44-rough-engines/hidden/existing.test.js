import { test } from 'node:test'
import assert from 'node:assert'
import { escapeHtml } from '../src/markdown.js'
import { FIELDS } from '../src/cron.js'
import { isNumber } from '../src/expr.js'

test('있던 것', () => {
  assert.strictEqual(escapeHtml('<a & "b">'), '&lt;a &amp; &quot;b&quot;&gt;')
  assert.strictEqual(FIELDS.length, 5)
  assert.strictEqual(isNumber('3.5'), true)
})
