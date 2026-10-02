// 실패는 재시도(guard): 실제로 실패한 발송은 다시 보내서 결국 한 번 전달한다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFakeMailTransport, createFakePushTransport } from '../src/adapters/fake-transports.js'
import { createVirtualClock } from '../src/clock.js'
import { createNotifier } from '../src/notifier.js'

function setup({ mail: mailOutcomes = [], push: pushOutcomes = [] } = {}) {
  const clock = createVirtualClock('2026-09-21T01:00:00Z')
  const mail = createFakeMailTransport({ clock, latencyMs: 300, outcomes: mailOutcomes })
  const push = createFakePushTransport({ clock, latencyMs: 60, outcomes: pushOutcomes })
  const notifier = createNotifier({
    clock,
    transports: { mail, push },
    preferences: { 'u-7': { email: 'hana@example.com', pushTokens: ['tok-7'], locale: 'ko' } },
  })
  return { clock, mail, push, notifier }
}

async function drain({ clock, notifier }) {
  for (let i = 0; i < 30; i++) {
    clock.advance(30_000)
    await notifier.retryWorker.runDue()
  }
}

const event = {
  id: 'ord-5521-shipped',
  source: 'orders',
  type: 'order.shipped',
  userId: 'u-7',
  occurredAt: '2026-09-21T00:59:50Z',
  data: { orderNo: 'B-5521', carrier: '한진택배', trackingNo: '5120-0001' },
}

test('메일 서버가 잠시 거절하면 다시 보낸다', async () => {
  const s = setup({ mail: [{ fail: 'transient' }] })
  await s.notifier.handle(event)
  await drain(s)

  assert.equal(s.mail.calls.length, 2)
  assert.equal(s.mail.sent.length, 1)
})

test('메일 서버가 응답하지 않으면 다시 보낸다', async () => {
  const s = setup({ mail: [{ fail: 'timeout', latencyMs: 30_000 }] })
  await s.notifier.handle(event)
  await drain(s)

  assert.equal(s.mail.calls.length, 2)
  assert.equal(s.mail.sent.length, 1)
})

test('푸시 게이트웨이가 두 번 실패해도 결국 한 번 보낸다', async () => {
  const s = setup({ push: [{ fail: 'transient' }, { fail: 'transient' }] })
  await s.notifier.handle(event)
  await drain(s)

  assert.equal(s.push.calls.length, 3)
  assert.equal(s.push.sent.length, 1)
  assert.equal(s.mail.sent.length, 1)
})
