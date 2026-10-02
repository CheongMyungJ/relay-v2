// 요약 실패는 재시도(guard): 실제로 못 보낸 요약은 다시 보내서 결국 한 통 전달한다. 다시 보내도 소용없는 오류는 그만둔다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFakeMailTransport, createFakePushTransport } from '../src/adapters/fake-transports.js'
import { createVirtualClock } from '../src/clock.js'
import { createNotifier } from '../src/notifier.js'

function setup(mailOutcomes) {
  const clock = createVirtualClock('2026-09-21T01:00:00Z')
  const mail = createFakeMailTransport({ clock, latencyMs: 300, outcomes: mailOutcomes })
  const push = createFakePushTransport({ clock, latencyMs: 60 })
  const notifier = createNotifier({
    clock,
    transports: { mail, push },
    preferences: { 'u-7': { email: 'hana@example.com', pushTokens: ['tok-7'], locale: 'ko', digest: true } },
  })
  return { clock, mail, push, notifier }
}

async function runDigest(s) {
  await s.notifier.handle({ id: 'ord-5521-delivered', source: 'orders', type: 'order.delivered', userId: 'u-7', occurredAt: '2026-09-21T00:59:00Z', data: { orderNo: 'B-5521' } })
  s.clock.set(Date.parse('2026-09-21T23:02:00Z'))
  return s.notifier.digest.tick()
}

test('메일 서버가 잠시 거절하면 요약을 다시 보낸다', async () => {
  const s = setup([{ fail: 'transient' }])
  const summary = await runDigest(s)
  assert.equal(s.mail.calls.length, 2)
  assert.equal(s.mail.sent.length, 1)
  assert.equal(summary.sent, 1)
})

test('메일 서버가 응답하지 않으면 요약을 다시 보낸다', async () => {
  const s = setup([{ fail: 'timeout', latencyMs: 30_000 }])
  const summary = await runDigest(s)
  assert.equal(s.mail.calls.length, 2)
  assert.equal(s.mail.sent.length, 1)
  assert.equal(summary.sent, 1)
})

test('두 번 거절돼도 결국 한 통 보낸다', async () => {
  const s = setup([{ fail: 'transient' }, { fail: 'timeout', latencyMs: 10_000 }])
  const summary = await runDigest(s)
  assert.equal(s.mail.calls.length, 3)
  assert.equal(s.mail.sent.length, 1)
  assert.equal(summary.sent, 1)
})

test('받는 사람이 없는 주소면 다시 보내지 않는다', async () => {
  const s = setup([{ fail: 'permanent' }])
  const summary = await runDigest(s)
  assert.equal(s.mail.calls.length, 1)
  assert.equal(s.mail.sent.length, 0)
  assert.equal(summary.failed, 1)
})
