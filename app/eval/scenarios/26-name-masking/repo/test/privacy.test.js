import { test } from 'node:test'
import assert from 'node:assert'
import { maskPhone } from '../src/privacy.js'

test('휴대전화 가운데를 가린다', () => {
  assert.strictEqual(maskPhone('010-1234-5678'), '010-****-5678')
  assert.strictEqual(maskPhone('010-987-6543'), '010-***-6543')
})
