import { test } from 'node:test'
import assert from 'node:assert'
import { createStore } from '../src/store.js'
import { createUserService } from '../src/users.js'
import { clock } from './clock.js'

test('생성, 이메일 변경, 삭제를 기록한다', () => {
  const c = clock()
  const s = createUserService(createStore(), { now: c.now })
  s.createUser({ name: '김', email: 'kim@example.com' })
  const t1 = c.at()
  c.tick()
  s.updateEmail(1, 'k2@example.com')
  const t2 = c.at()
  c.tick()
  s.deleteUser(1)
  const t3 = c.at()
  const log = s.listAudit({ userId: 1 })
  assert.deepStrictEqual(
    log.map((e) => [e.action, e.userId, e.at]),
    [
      ['delete', 1, t3],
      ['update_email', 1, t2],
      ['create', 1, t1],
    ],
  )
})
