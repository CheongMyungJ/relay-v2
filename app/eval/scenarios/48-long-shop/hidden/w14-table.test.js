import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canTransition } from '../src/orders/status.js'

const STATUSES = ['placed', 'paid', 'shipped', 'delivered', 'cancelled']
const ALLOWED = new Set(['placed>paid', 'placed>cancelled', 'paid>shipped', 'paid>cancelled', 'shipped>delivered'])

test('허용한 상태 바꾸기만 된다', () => {
  for (const from of STATUSES) {
    for (const to of STATUSES) {
      assert.equal(canTransition(from, to), ALLOWED.has(`${from}>${to}`), `${from} → ${to}`)
    }
  }
  assert.equal(canTransition('placed', 'refunded'), false)
  assert.equal(canTransition('nope', 'paid'), false)
})
