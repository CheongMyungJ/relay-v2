import { test } from 'node:test'
import assert from 'node:assert'
import { byId } from '../src/members.js'

test('id로 찾기', () => {
  assert.strictEqual(byId([{ id: 1, name: '김', email: 'kim@a.com' }], 1)?.name, '김')
  assert.strictEqual(byId([], 1), null)
})
