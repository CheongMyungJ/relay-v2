// 알림 서비스 조립: 수신 → 중복 제거 → 발송 → (필요하면) 재시도.
// "요약으로 받기"를 고른 사용자의 알림은 발송 대신 요약함에 모았다가 다음 날 아침 메일 한 통으로 보낸다.
import { createFakeMailTransport, createFakePushTransport } from './adapters/fake-transports.js'
import { createMailAdapter } from './adapters/mail.js'
import { createPushAdapter } from './adapters/push.js'
import { createSystemClock } from './clock.js'
import { loadConfig } from './config/load.js'
import { createDeduper } from './dedupe/deduper.js'
import { createDigestInbox } from './digest/inbox.js'
import { createDigestLedger } from './digest/ledger.js'
import { createDigestRunner } from './digest/runner.js'
import { createDigestScheduler } from './digest/scheduler.js'
import { createDeliveryLog } from './dispatch/delivery-log.js'
import { createDispatcher } from './dispatch/dispatcher.js'
import { describeEvent } from './intake/normalize.js'
import { IntakeError, intakeLagMs, receive } from './intake/receive.js'
import { silentLogger } from './logger.js'
import { createMetrics } from './metrics/metrics.js'
import { createPreferenceStore } from './preferences/store.js'
import { createRetryQueue } from './retry/queue.js'
import { createRetryWorker } from './retry/worker.js'
import { createTemplateRegistry } from './templates/registry.js'

/**
 * @param {object} [o]
 * @param {{ now(): number, sleep(ms): Promise<void> }} [o.clock]
 * @param {{ mail?: object, push?: object }} [o.transports] 없으면 가짜 전송(보내지 않고 기록만)
 * @param {object} [o.config] 기본 설정을 덮어쓸 값
 * @param {object} [o.env] 환경 변수(보통 process.env)
 * @param {object} [o.preferences] 사용자별 설정 초기값 또는 만들어 둔 store
 */
export function createNotifier(o = {}) {
  const clock = o.clock ?? createSystemClock()
  const config = loadConfig(o.config, o.env)
  const logger = o.logger ?? silentLogger
  const metrics = o.metrics ?? createMetrics()
  const preferences = o.preferences?.get ? o.preferences : createPreferenceStore(o.preferences ?? {})
  const templates = createTemplateRegistry({ catalog: o.catalog, defaultLocale: config.templates.defaultLocale })

  const transports = {
    mail: o.transports?.mail ?? createFakeMailTransport({ clock }),
    push: o.transports?.push ?? createFakePushTransport({ clock }),
  }
  const adapters = {
    mail: createMailAdapter({ transport: transports.mail, from: config.channels.mail.from }),
    push: createPushAdapter({
      transport: transports.push,
      ttlSeconds: config.channels.push.ttlSeconds,
      onInvalidToken: (token) => logger.warn('만료된 기기 토큰', { token }),
    }),
  }

  const deduper = createDeduper({ clock, windowMs: config.dedupe.windowMs, maxEntries: config.dedupe.maxEntries })
  const deliveryLog = createDeliveryLog({ clock })
  const retryQueue = createRetryQueue({ maxSize: config.retry.maxQueueSize })
  const dispatcher = createDispatcher({
    clock,
    config,
    adapters,
    templates,
    preferences,
    retryQueue,
    deliveryLog,
    metrics,
    logger,
  })
  const retryWorker = createRetryWorker({ clock, queue: retryQueue, dispatcher, logger })

  const digestInbox = createDigestInbox({ tzOffsetMinutes: config.digest.tzOffsetMinutes })
  const digestLedger = createDigestLedger({ clock, ttlMs: config.digest.ledgerTtlMs })
  const digestRunner = createDigestRunner({
    clock,
    config,
    adapter: adapters.mail,
    inbox: digestInbox,
    ledger: digestLedger,
    preferences,
    templates,
    metrics,
    logger,
  })
  const digestScheduler = createDigestScheduler({ clock, config, runner: digestRunner, inbox: digestInbox, logger })
  let digestTimer = null

  /** 바로 보내지 않고 요약에 모을 알림인지. 필수 알림(보안, 결제)은 언제나 바로 보낸다 */
  function wantsDigest(event) {
    if (!config.digest.enabled || !templates.has(event.type) || templates.isRequired(event.type)) return false
    return preferences.get(event.userId).digest === true
  }

  /** 보내는 쪽이 부르는 입구. 같은 이벤트가 여러 번 올 수 있다 */
  async function handle(raw) {
    const event = receive(raw, { clock, config })
    metrics.increment('intake.received')
    metrics.observe('intake.lag.ms', intakeLagMs(event))

    if (deduper.checkAndMark(event)) {
      metrics.increment('intake.duplicate')
      logger.info('중복 이벤트', { event: describeEvent(event) })
      return { status: 'duplicate', eventId: event.id }
    }
    if (wantsDigest(event)) {
      digestInbox.add(event)
      metrics.increment('digest.collected')
      return { status: 'digest', eventId: event.id }
    }
    const results = await dispatcher.dispatch(event)
    return { status: 'accepted', eventId: event.id, results }
  }

  /** 여러 이벤트를 차례로 처리한다. 잘못된 이벤트가 있어도 나머지는 처리한다 */
  async function handleBatch(raws) {
    const out = []
    for (const raw of raws) {
      try {
        out.push(await handle(raw))
      } catch (err) {
        if (!(err instanceof IntakeError)) throw err
        metrics.increment('intake.rejected')
        out.push({ status: 'rejected', eventId: raw?.id ?? null, problems: err.problems })
      }
    }
    return out
  }

  /** 탈퇴한 사용자: 설정을 지우고 대기 중인 재시도도 버린다 */
  function forgetUser(userId) {
    preferences.remove(userId)
    const dropped = retryQueue.removeWhere((job) => job.event.userId === userId)
    logger.info('사용자 삭제', { userId, droppedRetries: dropped })
    return dropped
  }

  /** 상태 점검 */
  function health() {
    const queue = retryQueue.stats(clock.now())
    return {
      ok: queue.size < config.retry.maxQueueSize * 0.8,
      env: config.service.env,
      dedupeEntries: deduper.size(),
      retryQueue: queue,
      nextRetryAt: retryQueue.nextDueAt(),
      workerRunning: retryWorker.running,
      digest: { pending: digestInbox.size(), lastPeriod: digestScheduler.lastPeriod },
    }
  }

  return {
    handle,
    handleBatch,
    forgetUser,
    health,
    config,
    clock,
    metrics,
    preferences,
    deliveryLog,
    retryQueue,
    retryWorker,
    transports,
    digest: {
      inbox: digestInbox,
      ledger: digestLedger,
      run: (args) => digestRunner.run(args),
      tick: () => digestScheduler.tick(),
    },
    start() {
      retryWorker.start()
      if (digestTimer) return
      digestTimer = setInterval(() => {
        digestScheduler.tick().catch((err) => logger.error('요약 일정 오류', { error: err }))
      }, 60_000)
      digestTimer.unref?.()
    },
    stop() {
      retryWorker.stop()
      clearInterval(digestTimer)
      digestTimer = null
    },
  }
}
