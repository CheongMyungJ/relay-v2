// 하루치 요약 메일 보내기. 일정(scheduler.js)이 아침마다 전날 기간으로 run()을 부른다.
//
// 한 번의 실행:
//   1. 기간에 알림이 모인 사용자마다 받을 주소를 정한다(주소가 없거나 메일을 거부했으면 건너뛴다)
//   2. 이미 보낸 요약(발송 기록의 키)이면 건너뛰고, 아니면 보낸다
//   3. 일시적 오류로 못 보낸 사람은 retryDelayMs 뒤에 다시 보낸다(첫 발송 포함 maxAttempts번까지)
import { errorCode, isTransient } from '../adapters/errors.js'
import { withDeadline } from './deadline.js'
import { digestKey } from './key.js'
import { buildDigestMessage } from './message.js'

export function createDigestRunner({ clock, config, adapter, inbox, ledger, preferences, templates, metrics, logger }) {
  const opts = () => config.digest

  /**
   * @param {{ period: string, runId?: string }} args period는 요약할 날짜('YYYY-MM-DD')
   */
  async function run({ period, runId = `${period}@${new Date(clock.now()).toISOString()}` }) {
    const summary = { runId, period, users: 0, sent: 0, already: 0, skipped: 0, failed: 0 }
    let pending = []

    for (const userId of inbox.users(period)) {
      summary.users++
      const prefs = preferences.get(userId)
      const skip = !prefs.email ? 'no-email' : prefs.optOut.includes('mail') ? 'opted-out' : null
      if (skip) {
        summary.skipped++
        ledger.record({ runId, period, userId, status: 'skipped', reason: skip })
        continue
      }
      pending.push({ userId, to: prefs.email, locale: prefs.locale, attempt: 1 })
    }

    logger.info('요약 발송 시작', { runId, period, users: pending.length })

    while (pending.length) {
      const again = []
      for (const job of pending) {
        const key = digestKey({ userId: job.userId, period, runId })
        if (ledger.has(key)) {
          summary.already++
          continue
        }

        const items = inbox.itemsFor(period, job.userId)
        const message = buildDigestMessage({ ...job, period, items }, { templates, config })
        const base = { runId, period, userId: job.userId, attempt: job.attempt, items: items.length }

        try {
          const { value, elapsedMs } = await withDeadline(clock, opts().sendTimeoutMs, () => adapter.send(message))
          metrics.observe('digest.send.ms', elapsedMs)
          ledger.markSent(key, { ...base, providerId: value?.id })
          metrics.increment('digest.sent')
          summary.sent++
        } catch (error) {
          const reason = errorCode(error)
          if (isTransient(error) && job.attempt < opts().maxAttempts) {
            ledger.record({ ...base, status: 'retry', reason })
            metrics.increment('digest.retry')
            logger.warn('요약 다시 보낼 예정', { ...base, reason })
            again.push({ ...job, attempt: job.attempt + 1 })
          } else {
            ledger.record({ ...base, status: 'failed', reason })
            metrics.increment('digest.failed')
            logger.error('요약 발송 포기', { ...base, reason, error })
            summary.failed++
          }
        }
      }
      if (again.length) await clock.sleep(opts().retryDelayMs)
      pending = again
    }

    logger.info('요약 발송 끝', summary)
    return summary
  }

  return { run }
}
