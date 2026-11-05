import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isTransient, SendError, SendTimeoutError } from '../src/adapters/errors.js'
import { createFakeMailTransport, createFakePushTransport } from '../src/adapters/fake-transports.js'
import { createMailAdapter, toSendError } from '../src/adapters/mail.js'
import { createPushAdapter } from '../src/adapters/push.js'
import { createVirtualClock } from '../src/clock.js'

const message = { to: 'mina@example.com', subject: '제목', body: '본문' }

test('메일 발송 성공', async () => {
  const clock = createVirtualClock(0)
  const transport = createFakeMailTransport({ clock, latencyMs: 250 })
  const adapter = createMailAdapter({ transport, from: 'no-reply@notify.example' })
  const receipt = await adapter.send(message)
  assert.match(receipt.id, /^<fake-1@/)
  assert.equal(clock.now(), 250)
  assert.equal(transport.sent[0].from, 'no-reply@notify.example')
})

test('SMTP 오류 분류', () => {
  assert.equal(isTransient(toSendError({ responseCode: 421, message: 'busy' })), true)
  assert.equal(isTransient(toSendError({ responseCode: 550, message: 'no such user' })), false)
  assert.ok(toSendError({ code: 'ETIMEDOUT' }) instanceof SendTimeoutError)
  assert.equal(isTransient(new Error('socket hang up')), true)
})

test('메일 전송 실패는 SendError로', async () => {
  const clock = createVirtualClock(0)
  const transport = createFakeMailTransport({ clock, outcomes: [{ fail: 'permanent' }] })
  const adapter = createMailAdapter({ transport, from: 'a@b.c' })
  await assert.rejects(adapter.send(message), (err) => err instanceof SendError && err.code === 'smtp-550')
  assert.equal(transport.sent.length, 0)
})

test('푸시: 일부 토큰만 성공해도 성공', async () => {
  const clock = createVirtualClock(0)
  const transport = createFakePushTransport({ clock })
  const invalid = []
  const adapter = createPushAdapter({ transport, onInvalidToken: (t) => invalid.push(t) })
  const receipt = await adapter.send({ tokens: ['a', 'b'], title: 't', body: 'b' })
  assert.equal(receipt.delivered, 2)
  transport.script({ fail: 'invalid-token' })
  await assert.rejects(adapter.send({ tokens: ['c'], title: 't', body: 'b' }), /거절/)
  assert.deepEqual(invalid, ['c'])
})

test('푸시 게이트웨이 503은 다시 보내 볼 만하다', async () => {
  const clock = createVirtualClock(0)
  const transport = createFakePushTransport({ clock, outcomes: [{ fail: 'transient' }] })
  const adapter = createPushAdapter({ transport })
  await assert.rejects(adapter.send({ tokens: ['a'], title: 't', body: 'b' }), (err) => isTransient(err))
})

test('푸시 문구는 잠금 화면 길이에 맞춰 자른다', async () => {
  const clock = createVirtualClock(0)
  const transport = createFakePushTransport({ clock })
  const adapter = createPushAdapter({ transport })
  await adapter.send({ tokens: ['a'], title: '제목'.repeat(30), body: '본문'.repeat(100) })
  assert.equal([...transport.sent[0].title].length, 40)
  assert.equal([...transport.sent[0].body].length, 120)
})

test('메일 제목의 줄바꿈은 없앤다', async () => {
  const clock = createVirtualClock(0)
  const transport = createFakeMailTransport({ clock })
  const adapter = createMailAdapter({ transport, from: 'a@b.c' })
  await adapter.send({ ...message, subject: '첫 줄\r\nBcc: evil@example.com' })
  assert.equal(transport.sent[0].subject, '첫 줄 Bcc: evil@example.com')
})
