// 같은 이벤트 재수신: 보내는 쪽이 같은 이벤트를 다시 보내도 알림은 한 번만 간다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFakeMailTransport, createFakePushTransport } from '../src/adapters/fake-transports.js'
import { createVirtualClock } from '../src/clock.js'
import { createNotifier } from '../src/notifier.js'

function setup() {
  const clock = createVirtualClock('2026-09-21T01:00:00Z')
  const mail = createFakeMailTransport({ clock, latencyMs: 300 })
  const push = createFakePushTransport({ clock, latencyMs: 60 })
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
  traceId: 'tr-1',
  data: { orderNo: 'B-5521', carrier: '한진택배', trackingNo: '5120-0001' },
}

test('보내는 쪽이 다시 보낸 이벤트는 다시 발송하지 않는다', async () => {
  const s = setup()
  await s.notifier.handle(event)
  s.clock.advance(1_500)
  await s.notifier.handle({ ...event, traceId: 'tr-2', deliveryAttempt: 2 })
  s.clock.advance(10 * 60_000)
  await s.notifier.handle({ ...event, traceId: 'tr-3', deliveryAttempt: 3 })
  await drain(s)

  assert.equal(s.mail.sent.length, 1, '메일은 한 번')
  assert.equal(s.push.sent.length, 1, '푸시는 한 번')
})

test('내용이 같아도 다른 이벤트는 따로 보낸다', async () => {
  const s = setup()
  await s.notifier.handle(event)
  s.clock.advance(1_500)
  await s.notifier.handle({ ...event, id: 'ord-5522-shipped' })
  await drain(s)

  assert.equal(s.mail.sent.length, 2)
  assert.equal(s.push.sent.length, 2)
})
