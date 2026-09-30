// 발송 결과를 보고 다음에 할 일을 정한다.
//   done     끝
//   retry    delayMs 뒤에 다시 보낸다
//   give-up  포기한다
import { errorCode, isTransient } from '../adapters/errors.js'
import { backoffDelay } from './backoff.js'

/**
 * @param {{ ok: boolean, error?: Error }} outcome 어댑터 호출 결과
 * @param {{ attempt: number, elapsedMs: number }} info
 * @param {{ timeoutMs: number, maxAttempts: number, baseDelayMs: number, factor: number, maxDelayMs: number }} options
 */
export function decide(outcome, { attempt, elapsedMs }, options) {
  let reason
  if (elapsedMs > options.timeoutMs) {
    reason = 'timeout'
  } else if (outcome.ok) {
    return { action: 'done' }
  } else if (isTransient(outcome.error)) {
    reason = errorCode(outcome.error)
  } else {
    return { action: 'give-up', reason: errorCode(outcome.error) }
  }

  if (attempt >= options.maxAttempts) return { action: 'give-up', reason: `${reason} (시도 ${attempt}회)` }
  return { action: 'retry', reason, delayMs: backoffDelay(attempt, options) }
}
