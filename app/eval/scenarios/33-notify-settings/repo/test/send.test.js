import { test } from 'node:test'
import assert from 'node:assert'
import { notify, outbox } from '../src/notify/send.js'

test('댓글 알림을 이메일로 보낸다', () => {
  outbox.length = 0
  assert.strictEqual(notify(1, { kind: 'comment', author: '박두리', text: '좋아요' }), true)
  assert.strictEqual(outbox[0].to, 'hana@example.com')
  assert.match(outbox[0].subject, /댓글/)
})

test('없는 사용자에게는 보내지 않는다', () => {
  assert.strictEqual(notify(99, { kind: 'mention', author: 'x', text: 'y' }), false)
})
