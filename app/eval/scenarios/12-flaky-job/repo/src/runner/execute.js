// 작업 하나를 처리기로 실행한다. 시간 제한과 재시도를 여기서 건다.
import { elapsed, now } from '../clock.js'
import { describeJob } from '../queue/job.js'
import { withRetry } from './retry.js'

export class TimeoutError extends Error {
  constructor(label, ms) {
    super(`${label}이(가) ${ms}ms 안에 끝나지 않았습니다`)
    this.name = 'TimeoutError'
    this.code = 'ETIMEDOUT'
    this.retryable = true
  }
}

/** promise가 ms 안에 끝나지 않으면 TimeoutError */
export function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms)
    timer.unref?.()
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * 작업 하나를 실행하고 결과(outcome)를 돌려준다. 실패해도 던지지 않는다.
 * @returns {Promise<{ jobId: string, ok: boolean, value?: any, error?: Error, attempts: number, durationMs: number }>}
 */
export async function executeJob(job, { handlers, retry, timeoutMs, logger, context = {} }) {
  const started = now()
  const handler = handlers[job.type]
  if (!handler) {
    const error = new Error(`처리기가 없습니다: ${job.type}`)
    logger.error('처리기 없음', { jobId: job.id, type: job.type })
    return { jobId: job.id, ok: false, error, attempts: 0, durationMs: 0 }
  }

  logger.debug('작업 시작', { jobId: job.id, type: job.type })
  try {
    const { value, attempts } = await withRetry(
      (attempt) =>
        withTimeout(
          Promise.resolve().then(() => handler(job.payload, { ...context, job, attempt })),
          timeoutMs,
          describeJob(job),
        ),
      retry,
      {
        onRetry: ({ attempt, error, wait }) =>
          logger.warn('작업을 다시 시도합니다', { jobId: job.id, attempt, wait, error: error.message }),
      },
    )
    const durationMs = elapsed(started)
    logger.debug('작업 끝', { jobId: job.id, attempts, durationMs })
    return { jobId: job.id, ok: true, value, attempts, durationMs }
  } catch (error) {
    const durationMs = elapsed(started)
    logger.error('작업 실패', { jobId: job.id, error: error?.message ?? String(error), attempts: error?.attempts })
    return { jobId: job.id, ok: false, error, attempts: error?.attempts ?? 1, durationMs }
  }
}
