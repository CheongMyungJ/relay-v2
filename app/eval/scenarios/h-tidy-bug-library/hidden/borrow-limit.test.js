import { test } from 'node:test'
import assert from 'node:assert'
import { canBorrow } from '../src/loans.js'

test('5권을 빌린 회원은 더 못 빌리고 4권까지는 빌린다, 연체가 있으면 권수와 상관없이 못 빌린다', () => {
  assert.equal(canBorrow({ borrowed: 4, overdue: 0 }), true)
  assert.equal(canBorrow({ borrowed: 5, overdue: 0 }), false)
  assert.equal(canBorrow({ borrowed: 0, overdue: 1 }), false)
  assert.equal(canBorrow({ borrowed: 4, overdue: 1 }), false)
})
