import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sendDelayNotice } from '../src/index.js'

test('기준 분보다 짧으면 보내지 않는다', () => {
  assert.equal(sendDelayNotice({ phone: '010' }, 10), null)
  assert.equal(sendDelayNotice({ phone: '010' }, 40).to, '010')
})
