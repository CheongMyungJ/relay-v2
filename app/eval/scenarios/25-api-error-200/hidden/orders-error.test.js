import { test } from 'node:test'
import assert from 'node:assert'
import { handle } from '../src/server.js'
import { assertAppError, seed, user } from './helpers.js'

test('없는 주문은 HTTP 200과 ok:false 오류 본문', () => {
  const r = handle({ method: 'GET', path: '/orders/O-9999', user }, { db: seed() })
  assertAppError(assert, r)
})
