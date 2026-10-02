// 요약 재실행: 같은 날의 요약 실행이 다시 돌아도(다른 서버, 배포 뒤 재시작, 손으로 다시 돌림) 고객은 요약을 한 통만 받는다.
// 못 받은 사람에게는 다시 돈 실행이 보내야 한다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFakeMailTransport, createFakePushTransport } from '../src/adapters/fake-transports.js'
import { createVirtualClock } from '../src/clock.js'
import { createNotifier } from '../src/notifier.js'

const PERIOD = '2026-09-21'
const NEXT_MORNING = Date.parse('2026-09-21T23:02:00Z')

function setup({ mailOutcomes = [] } = {}) {
  const clock = createVirtualClock('2026-09-21T01:00:00Z')
  const mail = createFakeMailTransport({ clock, latencyMs: 300, outcomes: mailOutcomes })
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

async function collect(notifier) {
  for (const [id, userId, orderNo] of [
    ['ord-5521-delivered', 'u-7', 'B-5521'],
    ['ord-5522-delivered', 'u-7', 'B-5522'],
    ['ord-6610-delivered', 'u-8', 'C-6610'],
  ]) {
    const res = await notifier.handle({ id, source: 'orders', type: 'order.delivered', userId, occurredAt: '2026-09-21T00:59:00Z', data: { orderNo } })
    assert.equal(res.status, 'digest')
  }
}

const count = (mail, to) => mail.sent.filter((m) => m.to === to).length

test('같은 날 요약이 다시 돌아도 한 통만 보낸다', async () => {
  const s = setup()
  await collect(s.notifier)

  s.clock.set(NEXT_MORNING)
  await s.notifier.digest.tick()
  s.clock.advance(25 * 60_000)
  await s.notifier.digest.run({ period: PERIOD })
  s.clock.advance(3 * 60 * 60_000)
  await s.notifier.digest.run({ period: PERIOD, runId: 'manual-1' })

  assert.equal(count(s.mail, 'hana@example.com'), 1, 'u-7은 한 통')
  assert.equal(count(s.mail, 'theo@example.com'), 1, 'u-8은 한 통')
  assert.equal(s.mail.calls.length, 2)
})

test('다시 돈 실행은 앞 실행에서 못 받은 사람에게만 보낸다', async () => {
  // u-7(정렬해서 먼저)의 첫 발송이 영구 오류로 실패한다
  const s = setup({ mailOutcomes: [{ fail: 'permanent' }] })
  await collect(s.notifier)

  s.clock.set(NEXT_MORNING)
  const first = await s.notifier.digest.tick()
  assert.equal(first.failed, 1)
  assert.equal(first.sent, 1)

  s.clock.advance(40 * 60_000)
  const again = await s.notifier.digest.run({ period: PERIOD })
  assert.equal(again.sent, 1)
  assert.equal(count(s.mail, 'hana@example.com'), 1)
  assert.equal(count(s.mail, 'theo@example.com'), 1)
})

test('다른 날 요약은 따로 보낸다', async () => {
  const s = setup()
  await collect(s.notifier)
  s.clock.set(NEXT_MORNING)
  await s.notifier.digest.tick()

  await s.notifier.handle({ id: 'ord-5530-delivered', source: 'orders', type: 'order.delivered', userId: 'u-7', occurredAt: '2026-09-21T23:00:00Z', data: { orderNo: 'B-5530' } })
  s.clock.set(Date.parse('2026-09-22T23:02:00Z'))
  await s.notifier.digest.tick()
  s.clock.advance(10 * 60_000)
  await s.notifier.digest.run({ period: '2026-09-22' })

  assert.deepEqual(
    s.mail.sent.filter((m) => m.to === 'hana@example.com').map((m) => m.subject),
    ['2026-09-21 알림 요약 (2건)', '2026-09-22 알림 요약 (1건)'],
  )
})
