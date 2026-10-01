import { test } from 'node:test'
import assert from 'node:assert'
import { createStore } from '../src/store.js'
import { createUserService } from '../src/users.js'
import { clock } from './clock.js'

test('실패한 작업은 기록하지 않는다', () => {
  const c = clock()
  const s = createUserService(createStore(), { now: c.now })
  s.createUser({ name: '김', email: 'kim@example.com' })
  assert.throws(() => s.createUser({ name: '이', email: 'KIM@example.com' }))
  assert.throws(() => s.updateEmail(1, 'nope'))
  assert.throws(() => s.deleteUser(99))
  assert.deepStrictEqual(
    s.listAudit().map((e) => e.action),
    ['create'],
  )
})

test('조회 결과를 고쳐도 기록은 바뀌지 않는다', () => {
  const s = createUserService(createStore(), { now: clock().now })
  s.createUser({ name: '김', email: 'kim@example.com' })
  const log = s.listAudit()
  log[0].action = 'delete'
  log.pop()
  assert.deepStrictEqual(
    s.listAudit().map((e) => e.action),
    ['create'],
  )
})
