// 성공 뒤 재시도 없음: 느리더라도 발송에 성공했으면 다시 보내지 않는다.
// 걸린 시간이 제한 시간을 얼마나 넘었는지와 관계없이 성공은 성공이다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFakeMailTransport, createFakePushTransport } from '../src/adapters/fake-transports.js'
import { createVirtualClock } from '../src/clock.js'
import { createNotifier } from '../src/notifier.js'

function setup({ mailLatencyMs = 300, pushLatencyMs = 60 } = {}) {
  const clock = createVirtualClock('2026-09-21T01:00:00Z')
  const mail = createFakeMailTransport({ clock, latencyMs: mailLatencyMs })
  const push = createFakePushTransport({ clock, latencyMs: pushLatencyMs })
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

for (const latencyMs of [2_600, 120_000]) {
  test(`메일이 ${latencyMs}ms 걸려 성공하면 한 번만 보낸다`, async () => {
    const s = setup({ mailLatencyMs: latencyMs })
    await s.notifier.handle(event)
    await drain(s)

    assert.equal(s.mail.sent.length, 1, '메일은 한 번')
    assert.equal(s.mail.calls.length, 1, '메일 서버를 다시 부르지 않는다')
    assert.equal(s.push.sent.length, 1)
    assert.equal(s.notifier.retryQueue.size(), 0)
  })
}

test('푸시가 느리게 성공해도 한 번만 보낸다', async () => {
  const s = setup({ pushLatencyMs: 45_000 })
  await s.notifier.handle(event)
  await drain(s)

  assert.equal(s.push.calls.length, 1)
  assert.equal(s.push.sent.length, 1)
  assert.equal(s.mail.sent.length, 1)
})
