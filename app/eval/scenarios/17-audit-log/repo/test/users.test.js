import { test } from 'node:test'
import assert from 'node:assert'
import { createStore } from '../src/store.js'
import { createUserService } from '../src/users.js'
import { NotFoundError, ValidationError } from '../src/errors.js'

const fixed = () => new Date('2026-10-01T00:00:00Z')

test('사용자를 만들고 읽는다', () => {
  const s = createUserService(createStore(), { now: fixed })
  const u = s.createUser({ name: ' 김철수 ', email: 'Kim@Example.com' })
  assert.deepStrictEqual(u, {
    id: 1,
    name: '김철수',
    email: 'kim@example.com',
    createdAt: '2026-10-01T00:00:00.000Z',
  })
  assert.deepStrictEqual(s.getUser(1), u)
})

test('이메일을 바꾸고 지운다', () => {
  const s = createUserService(createStore(), { now: fixed })
  s.createUser({ name: '김', email: 'a@x.com' })
  assert.strictEqual(s.updateEmail(1, 'b@x.com').email, 'b@x.com')
  assert.strictEqual(s.deleteUser(1), true)
  assert.throws(() => s.getUser(1), NotFoundError)
})

test('잘못된 입력', () => {
  const s = createUserService(createStore(), { now: fixed })
  assert.throws(() => s.createUser({ name: '', email: 'a@x.com' }), ValidationError)
  assert.throws(() => s.createUser({ name: '김', email: 'nope' }), ValidationError)
  s.createUser({ name: '김', email: 'a@x.com' })
  assert.throws(() => s.createUser({ name: '이', email: 'A@x.com' }), ValidationError)
})
