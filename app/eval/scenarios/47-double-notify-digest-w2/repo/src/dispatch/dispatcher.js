// 발송: 이벤트 하나를 채널별로 보내고, 결과에 따라 재시도 대기열에 넣는다.
import { describeEvent } from '../intake/normalize.js'
import { decide } from '../retry/policy.js'
import { QueueFullError } from '../retry/queue.js'
import { buildMessage } from './message.js'
import { planDeliveries } from './router.js'

export function createDispatcher({ clock, config, adapters, templates, preferences, retryQueue, deliveryLog, metrics, logger }) {
  const policyOptions = () => ({ timeoutMs: config.send.timeoutMs, ...config.retry })

  /** 새 이벤트를 채널별로 보낸다 */
  async function dispatch(event) {
    const plan = planDeliveries(event, { templates, preferences, config, clock })
    const results = []
    for (const s of plan.skipped) {
      metrics.increment(`dispatch.skipped.${s.reason}`)
      results.push({ channel: s.channel, status: 'skipped', reason: s.reason })
    }
    for (const delivery of plan.deliveries) results.push(await deliver(event, delivery, 1))
    return results
  }

  /** 채널 하나로 한 번 보낸다. 재시도 워커도 이것을 부른다 */
  async function deliver(event, delivery, attempt) {
    const { channel } = delivery
    const adapter = adapters[channel]
    if (!adapter) return finish(event, delivery, attempt, { action: 'give-up', reason: 'no-adapter' }, 0)

    let message
    try {
      message = buildMessage(event, delivery, { templates, config })
    } catch (err) {
      logger.error('메시지를 만들 수 없음', { event: describeEvent(event), channel, error: err })
      return finish(event, delivery, attempt, { action: 'give-up', reason: 'template' }, 0)
    }

    const started = clock.now()
    let outcome
    try {
      const receipt = await adapter.send(message)
      outcome = { ok: true, receipt }
    } catch (error) {
      outcome = { ok: false, error }
    }
    const elapsedMs = clock.now() - started
    metrics.observe(`send.${channel}.ms`, elapsedMs)

    const decision = decide(outcome, { attempt, elapsedMs }, policyOptions())
    return finish(event, delivery, attempt, decision, elapsedMs, outcome)
  }

  function finish(event, delivery, attempt, decision, elapsedMs, outcome = {}) {
    const { channel } = delivery
    const base = { eventId: event.id, source: event.source, channel, attempt, elapsedMs }

    if (decision.action === 'done') {
      deliveryLog.record({ ...base, status: 'sent', providerId: outcome.receipt?.id })
      metrics.increment(`send.${channel}.sent`)
      return { channel, status: 'sent', attempt }
    }

    if (decision.action === 'retry') {
      try {
        const job = retryQueue.enqueue({
          event,
          delivery,
          attempt: attempt + 1,
          notBefore: clock.now() + decision.delayMs,
          reason: decision.reason,
        })
        deliveryLog.record({ ...base, status: 'retry-scheduled', reason: decision.reason, job: job.id })
        metrics.increment(`send.${channel}.retry`)
        logger.warn('재시도 예약', { event: describeEvent(event), channel, attempt, reason: decision.reason, delayMs: decision.delayMs })
        return { channel, status: 'retry-scheduled', attempt, reason: decision.reason }
      } catch (err) {
        if (!(err instanceof QueueFullError)) throw err
        decision = { action: 'give-up', reason: 'retry-queue-full' }
      }
    }

    deliveryLog.record({ ...base, status: 'failed', reason: decision.reason })
    metrics.increment(`send.${channel}.failed`)
    logger.error('발송 포기', { event: describeEvent(event), channel, attempt, reason: decision.reason, error: outcome.error })
    return { channel, status: 'failed', attempt, reason: decision.reason }
  }

  return { dispatch, deliver }
}
