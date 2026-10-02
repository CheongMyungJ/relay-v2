// 재시도 정책. 다시 해 볼 만한 오류만 간격을 늘려 가며 다시 한다.
import { sleep } from '../clock.js'
import { spreadAround } from '../util/jitter.js'

const RETRYABLE_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'EBUSY'])

/** 다시 시도해도 되는 오류 */
export class RetryableError extends Error {
  constructor(message, options) {
    super(message, options)
    this.name = 'RetryableError'
    this.retryable = true
  }
}

export function isRetryable(error) {
  if (!error) return false
  if (error.retryable === true) return true
  if (error.retryable === false) return false
  return RETRYABLE_CODES.has(error.code)
}

/** attempt번째 실패 뒤에 기다릴 시간(ms). 여러 작업이 한꺼번에 다시 몰리지 않게 조금 흩뜨린다 */
export function backoffFor(attempt, policy) {
  const raw = policy.backoffMs * policy.factor ** (attempt - 1)
  return Math.min(policy.maxBackoffMs ?? Number.POSITIVE_INFINITY, spreadAround(raw))
}

/**
 * fn을 정책에 따라 다시 시도한다.
 * @param {(attempt: number) => Promise<any>} fn
 * @param {{ attempts: number, backoffMs: number, factor: number, maxBackoffMs?: number }} policy
 * @param {{ onRetry?: (info: { attempt: number, error: Error, wait: number }) => void }} [hooks]
 * @returns {Promise<{ value: any, attempts: number }>}
 */
export async function withRetry(fn, policy, hooks = {}) {
  let attempt = 0
  for (;;) {
    attempt++
    try {
      const value = await fn(attempt)
      return { value, attempts: attempt }
    } catch (error) {
      if (attempt >= policy.attempts || !isRetryable(error)) {
        if (error && typeof error === 'object') error.attempts = attempt
        throw error
      }
      const wait = backoffFor(attempt, policy)
      hooks.onRetry?.({ attempt, error, wait })
      await sleep(wait)
    }
  }
}
