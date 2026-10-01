import { test } from 'node:test'
import assert from 'node:assert'
import { createStore } from '../src/store.js'
import { createUserService } from '../src/users.js'
import { clock } from './clock.js'

test('기록의 이메일은 앞 한 글자만 두고 가린다', () => {
  const c = clock()
  const s = createUserService(createStore(), { now: c.now })
  s.createUser({ name: '김', email: 'kim@example.com' })
  c.tick()
  s.updateEmail(1, 'park@example.com')
  const [update, create] = s.listAudit({ userId: 1 })
  assert.deepStrictEqual(create.detail, { email: 'k***@example.com' })
  assert.deepStrictEqual(update.detail, { from: 'k***@example.com', to: 'p***@example.com' })
  assert.ok(!JSON.stringify(s.listAudit()).includes('kim@'))
  assert.ok(!JSON.stringify(s.listAudit()).includes('park@'))
})
