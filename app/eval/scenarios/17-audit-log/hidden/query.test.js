import { test } from 'node:test'
import assert from 'node:assert'
import { createStore } from '../src/store.js'
import { createUserService } from '../src/users.js'
import { clock } from './clock.js'

function setup() {
  const c = clock()
  const s = createUserService(createStore(), { now: c.now })
  s.createUser({ name: '김', email: 'kim@example.com' }) // 09:00
  c.tick()
  s.createUser({ name: '이', email: 'lee@example.com' }) // 09:01
  c.tick()
  s.updateEmail(1, 'kim2@example.com') // 09:02
  s.updateEmail(2, 'lee2@example.com') // 09:02, 같은 시각
  c.tick()
  s.deleteUser(2) // 09:03
  return s
}

const brief = (log) => log.map((e) => `${e.userId}:${e.action}`)

test('조건 없이 부르면 모두, 최신순. 같은 시각이면 나중에 기록된 것이 먼저', () => {
  assert.deepStrictEqual(brief(setup().listAudit()), [
    '2:delete',
    '2:update_email',
    '1:update_email',
    '2:create',
    '1:create',
  ])
})

test('userId로 거른다. 지운 사용자의 기록도 남는다', () => {
  assert.deepStrictEqual(brief(setup().listAudit({ userId: 2 })), [
    '2:delete',
    '2:update_email',
    '2:create',
  ])
})

test('since는 그 시각을 포함한다', () => {
  const s = setup()
  assert.deepStrictEqual(brief(s.listAudit({ since: '2026-10-01T09:02:00.000Z' })), [
    '2:delete',
    '2:update_email',
    '1:update_email',
  ])
  assert.deepStrictEqual(brief(s.listAudit({ userId: 1, since: new Date('2026-10-01T09:01:00Z') })), [
    '1:update_email',
  ])
})
