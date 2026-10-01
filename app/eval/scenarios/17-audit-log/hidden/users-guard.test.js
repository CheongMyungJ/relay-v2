import { test } from 'node:test'
import assert from 'node:assert'
import { createStore } from '../src/store.js'
import { createUserService } from '../src/users.js'
import { NotFoundError, ValidationError } from '../src/errors.js'

const fixed = () => new Date('2026-10-01T00:00:00Z')

test('기존 함수의 반환값과 오류는 그대로다', () => {
  const s = createUserService(createStore(), { now: fixed })
  assert.deepStrictEqual(s.createUser({ name: '김', email: 'A@x.com' }), {
    id: 1,
    name: '김',
    email: 'a@x.com',
    createdAt: '2026-10-01T00:00:00.000Z',
  })
  assert.deepStrictEqual(s.updateEmail(1, 'b@x.com'), {
    id: 1,
    name: '김',
    email: 'b@x.com',
    createdAt: '2026-10-01T00:00:00.000Z',
  })
  assert.strictEqual(s.deleteUser(1), true)
  assert.throws(() => s.getUser(1), NotFoundError)
  assert.throws(() => s.deleteUser(1), NotFoundError)
  assert.throws(() => s.createUser({ name: '', email: 'a@x.com' }), ValidationError)
})
