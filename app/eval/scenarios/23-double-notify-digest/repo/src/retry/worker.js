// 재시도 대기열을 돌며 때가 된 발송을 다시 시도한다.
import { describeEvent } from '../intake/normalize.js'

export function createRetryWorker({ clock, queue, dispatcher, logger, pollMs = 500 }) {
  let timer = null
  let busy = false

  /** 지금 보낼 때가 된 일을 처리하고 처리한 수를 돌려준다 */
  async function runDue() {
    const jobs = queue.takeDue(clock.now())
    for (const job of jobs) {
      logger.info('재시도', {
        job: job.id,
        event: describeEvent(job.event),
        channel: job.delivery.channel,
        attempt: job.attempt,
        reason: job.reason,
      })
      try {
        await dispatcher.deliver(job.event, job.delivery, job.attempt)
      } catch (err) {
        logger.error('재시도 처리 중 오류', { job: job.id, error: err })
      }
    }
    return jobs.length
  }

  function start() {
    if (timer) return
    timer = setInterval(() => {
      if (busy) return
      busy = true
      runDue().finally(() => {
        busy = false
      })
    }, pollMs)
    timer.unref?.()
  }

  function stop() {
    clearInterval(timer)
    timer = null
  }

  return { runDue, start, stop, get running() { return timer !== null } }
}
