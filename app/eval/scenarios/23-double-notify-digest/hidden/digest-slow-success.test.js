// 느린 요약 성공: 메일 서버가 요약을 받는 데 오래 걸려도 받았으면 보낸 것이다. 다시 보내지 않는다.
// 걸린 시간이 제한 시간을 얼마나 넘었는지와 관계없다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFakeMailTransport, createFakePushTransport } from '../src/adapters/fake-transports.js'
import { createVirtualClock } from '../src/clock.js'
import { createNotifier } from '../src/notifier.js'

function setup({ mailLatencyMs }) {
  const clock = createVirtualClock('2026-09-21T01:00:00Z')
  const mail = createFakeMailTransport({ clock, latencyMs: mailLatencyMs })
  const push = createFakePushTransport({ clock, latencyMs: 60 })
  const notifier = createNotifier({
    clock,
    transports: { mail, push },
    preferences: {
      'u-7': { email: 'hana@example.com', pushTokens: ['tok-7'], locale: 'ko', digest: true },
      'u-8': { email: 'theo@example.com', pushTokens: ['tok-8'], locale: 'en', digest: true },
    },
  })
  return { clock, mail, push, notifier }
}

for (const latencyMs of [4_500, 120_000]) {
  test(`요약 한 통이 ${latencyMs}ms 걸려 성공하면 사람마다 한 번만 보낸다`, async () => {
    const s = setup({ mailLatencyMs: latencyMs })
    await s.notifier.handle({ id: 'ord-5521-delivered', source: 'orders', type: 'order.delivered', userId: 'u-7', occurredAt: '2026-09-21T00:59:00Z', data: { orderNo: 'B-5521' } })
    await s.notifier.handle({ id: 'ord-6610-delivered', source: 'orders', type: 'order.delivered', userId: 'u-8', occurredAt: '2026-09-21T00:59:30Z', data: { orderNo: 'C-6610' } })

    s.clock.set(Date.parse('2026-09-21T23:02:00Z'))
    const summary = await s.notifier.digest.tick()

    assert.equal(s.mail.calls.length, 2, '메일 서버를 사람마다 한 번만 부른다')
    assert.equal(s.mail.sent.length, 2)
    assert.equal(summary.sent, 2)
    assert.equal(summary.failed, 0)
  })
}
