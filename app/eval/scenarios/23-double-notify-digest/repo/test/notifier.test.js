import assert from 'node:assert/strict'
import { test } from 'node:test'
import { IntakeError } from '../src/intake/receive.js'
import { setup, shippedEvent } from './helpers.js'

test('배송 시작 이벤트는 메일과 푸시로 간다', async () => {
  const { notifier, mail, push } = setup()
  const res = await notifier.handle(shippedEvent())
  assert.equal(res.status, 'accepted')
  assert.deepEqual(res.results.map((r) => [r.channel, r.status]), [['mail', 'sent'], ['push', 'sent']])
  assert.equal(mail.sent[0].subject, '주문 A-1001 상품이 출발했어요')
  assert.equal(mail.sent[0].headers['X-Notify-Event'], 'orders/ord-1001-shipped')
  assert.equal(push.sent[0].body, '주문 A-1001 상품이 출발했어요')
})

test('영어 사용자와 기기 여러 대', async () => {
  const { notifier, mail, push } = setup()
  await notifier.handle(shippedEvent({ id: 'ord-2001-shipped', userId: 'u-2' }))
  assert.equal(mail.sent[0].subject, 'Your order A-1001 has shipped')
  assert.deepEqual(push.sent[0].tokens, ['tok-b', 'tok-c'])
})

test('기기가 없거나 수신 거부한 채널은 건너뛴다', async () => {
  const { notifier, push } = setup()
  const res = await notifier.handle(shippedEvent({ userId: 'u-3' }))
  assert.deepEqual(res.results.find((r) => r.channel === 'push'), { channel: 'push', status: 'skipped', reason: 'no-device' })

  notifier.preferences.optOut('u-1', 'push')
  const res2 = await notifier.handle(shippedEvent({ id: 'ord-1002-shipped' }))
  assert.equal(res2.results.find((r) => r.channel === 'push').reason, 'opted-out')
  assert.equal(push.sent.length, 0)
})

test('결제 실패는 수신 거부와 관계없이 보낸다', async () => {
  const { notifier, mail } = setup()
  notifier.preferences.optOut('u-1', 'mail')
  await notifier.handle({ id: 'pay-77', source: 'billing', type: 'payment.failed', userId: 'u-1', occurredAt: '2026-09-21T00:59:00Z', data: { amount: 39000 } })
  assert.equal(mail.sent.length, 1)
  assert.match(mail.sent[0].text, /39,000원/)
})

test('방해 금지 시간에는 푸시를 보내지 않는다', async () => {
  const { notifier, push, mail } = setup()
  notifier.preferences.set('u-1', { quietHours: { start: '09:00', end: '12:00' } })
  const res = await notifier.handle(shippedEvent())
  assert.equal(res.results.find((r) => r.channel === 'push').reason, 'quiet-hours')
  assert.equal(push.sent.length, 0)
  assert.equal(mail.sent.length, 1)
})

test('같은 이벤트를 한꺼번에 두 번 받으면 한 번만 보낸다', async () => {
  const { notifier, mail, push } = setup({ mail: { latencyMs: 0 }, push: { latencyMs: 0 } })
  const [a, b] = await Promise.all([notifier.handle(shippedEvent()), notifier.handle(shippedEvent())])
  assert.deepEqual([a.status, b.status].sort(), ['accepted', 'duplicate'])
  assert.equal(mail.sent.length, 1)
  assert.equal(push.sent.length, 1)
  assert.equal(notifier.metrics.counter('intake.duplicate'), 1)
})

test('템플릿 값이 없으면 그 채널은 실패로 기록', async () => {
  const { notifier, mail } = setup()
  const res = await notifier.handle(shippedEvent({ data: { orderNo: 'A-1' } }))
  assert.deepEqual(res.results.find((r) => r.channel === 'mail'), { channel: 'mail', status: 'failed', attempt: 1, reason: 'template' })
  assert.equal(mail.calls.length, 0)
})

test('잘못된 이벤트는 거절한다', async () => {
  const { notifier } = setup()
  await assert.rejects(notifier.handle({ id: 'x' }), IntakeError)
})

test('일시적 오류는 대기열을 거쳐 다시 보낸다', async () => {
  const { notifier, clock, mail } = setup({ mail: { outcomes: [{ fail: 'transient' }] } })
  const res = await notifier.handle(shippedEvent())
  assert.equal(res.results[0].status, 'retry-scheduled')
  assert.equal(notifier.retryQueue.size(), 1)

  assert.equal(await notifier.retryWorker.runDue(), 0)
  clock.advance(notifier.config.retry.baseDelayMs)
  assert.equal(await notifier.retryWorker.runDue(), 1)
  assert.equal(mail.sent.length, 1)
  assert.deepEqual(notifier.deliveryLog.latest('ord-1001-shipped'), { mail: 'sent', push: 'sent' })
})

test('영구 오류는 다시 보내지 않는다', async () => {
  const { notifier, mail } = setup({ mail: { outcomes: [{ fail: 'permanent' }] } })
  const res = await notifier.handle(shippedEvent())
  assert.equal(res.results[0].status, 'failed')
  assert.equal(notifier.retryQueue.size(), 0)
  assert.equal(mail.calls.length, 1)
})

test('발송 기록', async () => {
  const { notifier } = setup()
  await notifier.handle(shippedEvent())
  const log = notifier.deliveryLog.forEvent('ord-1001-shipped')
  assert.deepEqual(log.map((e) => [e.channel, e.status, e.attempt]), [['mail', 'sent', 1], ['push', 'sent', 1]])
  assert.equal(log[0].elapsedMs, 400)
})

test('여러 이벤트를 한 번에 받으면 잘못된 것만 거절한다', async () => {
  const { notifier, mail } = setup()
  const out = await notifier.handleBatch([
    shippedEvent(),
    { id: 'bad', source: 'orders', type: 'order.shipped', userId: 'u-1', occurredAt: '2026-09-21T00:00:00Z' },
    shippedEvent({ id: 'ord-1003-shipped' }),
  ])
  assert.deepEqual(out.map((r) => r.status), ['accepted', 'rejected', 'accepted'])
  assert.deepEqual(out[1].problems, ['data.orderNo이 없다'])
  assert.equal(mail.sent.length, 2)
})

test('탈퇴한 사용자의 재시도는 버린다', async () => {
  const { notifier } = setup({ mail: { outcomes: [{ fail: 'transient' }] } })
  await notifier.handle(shippedEvent())
  assert.equal(notifier.health().retryQueue.byChannel.mail, 1)
  assert.equal(notifier.forgetUser('u-1'), 1)
  assert.equal(notifier.health().retryQueue.size, 0)
  assert.equal(notifier.preferences.get('u-1').email, null)
})
