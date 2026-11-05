import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDigestInbox, periodOf, previousPeriod } from '../src/digest/inbox.js'
import { setup } from './helpers.js'

// 서울 9월 21일 오전 10시에 받은 알림은 9월 21일 요약에 들어가고, 22일 오전 8시가 지나면 나간다
const DIGEST_USERS = {
  'u-1': { email: 'mina@example.com', pushTokens: ['tok-a'], locale: 'ko', digest: true },
  'u-2': { email: 'sam@example.com', pushTokens: ['tok-b'], locale: 'en', digest: true },
  'u-3': { email: 'jun@example.com', pushTokens: ['tok-c'], locale: 'ko' },
}
const NEXT_MORNING = Date.parse('2026-09-21T23:05:00Z')

function delivered(id, userId, orderNo) {
  return { id, source: 'orders', type: 'order.delivered', userId, occurredAt: '2026-09-21T00:59:00Z', data: { orderNo } }
}

function digestSetup(opts = {}) {
  return setup({ users: DIGEST_USERS, mail: { latencyMs: 300 }, push: { latencyMs: 60 }, ...opts })
}

test('날짜 가르기는 한국 시간 기준', () => {
  assert.equal(periodOf(Date.parse('2026-09-21T14:59:59Z'), 540), '2026-09-21')
  assert.equal(periodOf(Date.parse('2026-09-21T15:00:00Z'), 540), '2026-09-22')
  assert.equal(previousPeriod('2026-10-01'), '2026-09-30')
})

test('요약함은 같은 이벤트를 한 번만 담는다', () => {
  const inbox = createDigestInbox({ tzOffsetMinutes: 540 })
  const event = { id: 'e-1', source: 'orders', type: 'order.delivered', userId: 'u-1', occurredAt: 1, receivedAt: Date.parse('2026-09-21T01:00:00Z'), data: { orderNo: 'A-1' } }
  assert.equal(inbox.add(event), true)
  assert.equal(inbox.add({ ...event, receivedAt: event.receivedAt + 5000 }), false)
  assert.equal(inbox.itemsFor('2026-09-21', 'u-1').length, 1)
})

test('요약을 고른 사용자의 알림은 바로 보내지 않고 모은다', async () => {
  const { notifier, mail, push } = digestSetup()
  const res = await notifier.handle(delivered('ord-1001-delivered', 'u-1', 'A-1001'))
  assert.equal(res.status, 'digest')
  assert.equal(push.sent.length, 0)
  assert.equal(mail.sent.length, 0)
  assert.deepEqual(notifier.digest.inbox.users('2026-09-21'), ['u-1'])
})

test('요약을 고르지 않은 사용자와 필수 알림은 바로 보낸다', async () => {
  const { notifier, mail, push } = digestSetup()
  assert.equal((await notifier.handle(delivered('ord-3001-delivered', 'u-3', 'C-3001'))).status, 'accepted')
  await notifier.handle({ id: 'pay-9', source: 'billing', type: 'payment.failed', userId: 'u-1', occurredAt: '2026-09-21T00:59:00Z', data: { amount: 12000 } })
  assert.equal(push.sent.length, 2)
  assert.equal(mail.sent.length, 1)
  assert.equal(notifier.digest.inbox.size(), 0)
})

test('다음 날 아침 사용자마다 요약 한 통으로 보낸다', async () => {
  const { notifier, clock, mail } = digestSetup()
  await notifier.handle(delivered('ord-1001-delivered', 'u-1', 'A-1001'))
  await notifier.handle(delivered('ord-1002-delivered', 'u-1', 'A-1002'))
  await notifier.handle(delivered('ord-2001-delivered', 'u-2', 'B-2001'))

  clock.set(NEXT_MORNING)
  const summary = await notifier.digest.tick()
  assert.equal(summary.period, '2026-09-21')
  assert.equal(summary.sent, 2)
  assert.equal(mail.sent.length, 2)

  const mina = mail.sent.find((m) => m.to === 'mina@example.com')
  assert.equal(mina.subject, '2026-09-21 알림 요약 (2건)')
  assert.match(mina.text, /주문 A-1001 상품이 도착했어요/)
  assert.match(mina.text, /주문 A-1002 상품이 도착했어요/)
  assert.equal(mina.headers['X-Notify-Digest'], '2026-09-21/u-1')
  const sam = mail.sent.find((m) => m.to === 'sam@example.com')
  assert.equal(sam.subject, 'Your notifications for 2026-09-21 (1)')
})

test('일정은 아침 8시 전에는 보내지 않고, 하루 한 번만 돈다', async () => {
  const { notifier, clock, mail } = digestSetup()
  await notifier.handle(delivered('ord-1001-delivered', 'u-1', 'A-1001'))

  clock.set(Date.parse('2026-09-21T22:30:00Z')) // 서울 7시 30분
  assert.equal(await notifier.digest.tick(), null)
  clock.set(NEXT_MORNING)
  assert.equal((await notifier.digest.tick()).sent, 1)
  clock.advance(60_000)
  assert.equal(await notifier.digest.tick(), null)
  assert.equal(mail.sent.length, 1)
})

test('메일 주소가 없거나 메일을 거부한 사용자는 건너뛴다', async () => {
  const { notifier, clock, mail } = digestSetup()
  notifier.preferences.set('u-4', { pushTokens: ['tok-d'], digest: true })
  notifier.preferences.optOut('u-2', 'mail')
  await notifier.handle(delivered('ord-4001-delivered', 'u-4', 'D-4001'))
  await notifier.handle(delivered('ord-2001-delivered', 'u-2', 'B-2001'))
  clock.set(NEXT_MORNING)
  const summary = await notifier.digest.tick()
  assert.equal(summary.skipped, 2)
  assert.equal(mail.calls.length, 0)
  assert.deepEqual(notifier.digest.ledger.forUser('u-4').map((e) => e.reason), ['no-email'])
})

test('일시적 오류는 잠시 뒤 다시 보낸다', async () => {
  const { notifier, clock, mail } = digestSetup({ mail: { latencyMs: 300, outcomes: [{ fail: 'transient' }] } })
  await notifier.handle(delivered('ord-1001-delivered', 'u-1', 'A-1001'))
  clock.set(NEXT_MORNING)
  const summary = await notifier.digest.tick()
  assert.equal(summary.sent, 1)
  assert.equal(mail.calls.length, 2)
  assert.equal(mail.calls[1].at - mail.calls[0].at >= notifier.config.digest.retryDelayMs, true)
  assert.deepEqual(notifier.digest.ledger.forUser('u-1').map((e) => e.status), ['retry', 'sent'])
})

test('영구 오류는 다시 보내지 않는다', async () => {
  const { notifier, clock, mail } = digestSetup({ mail: { latencyMs: 300, outcomes: [{ fail: 'permanent' }] } })
  await notifier.handle(delivered('ord-1001-delivered', 'u-1', 'A-1001'))
  clock.set(NEXT_MORNING)
  const summary = await notifier.digest.tick()
  assert.equal(summary.failed, 1)
  assert.equal(mail.calls.length, 1)
  assert.equal(notifier.digest.ledger.runSummary(summary.runId).failed, 1)
})
