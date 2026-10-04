// 요약 일정: 현지 시각으로 config.digest.hour가 지나면 전날 기간의 요약을 한 번 보낸다.
// notifier.start()가 주기적으로 tick()을 부른다.
import { periodOf, previousPeriod } from './inbox.js'

export function createDigestScheduler({ clock, config, runner, inbox, logger }) {
  let lastPeriod = null

  /** 보낼 때가 됐으면 요약을 보내고 그 결과를, 아니면 null을 돌려준다 */
  async function tick() {
    const { tzOffsetMinutes, hour, keepDays } = config.digest
    const now = clock.now()
    const localHour = new Date(now + tzOffsetMinutes * 60_000).getUTCHours()
    if (localHour < hour) return null

    const period = previousPeriod(periodOf(now, tzOffsetMinutes))
    if (period === lastPeriod) return null
    lastPeriod = period

    logger.info('요약 일정', { period })
    const summary = await runner.run({ period })

    // 오래된 기간은 지운다
    let cutoff = period
    for (let i = 0; i < keepDays; i++) cutoff = previousPeriod(cutoff)
    inbox.dropBefore(cutoff)
    return summary
  }

  return { tick, get lastPeriod() { return lastPeriod } }
}
