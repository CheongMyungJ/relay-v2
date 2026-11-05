// 요약 발송 한 건의 제한 시간.
// 요약은 아침에 한꺼번에 수천 통을 보내므로, 한 사람에게 오래 걸리면 뒤 사람들의 요약이 모두 밀린다.
import { SendTimeoutError } from '../adapters/errors.js'

/**
 * fn을 부르고 걸린 시간을 잰다. 제한 시간을 넘기면 시간 초과로 본다.
 * @template T
 * @param {{ now(): number }} clock
 * @param {number} timeoutMs
 * @param {() => Promise<T>} fn
 * @returns {Promise<{ value: T, elapsedMs: number }>}
 */
export async function withDeadline(clock, timeoutMs, fn) {
  const started = clock.now()
  const value = await fn()
  const elapsedMs = clock.now() - started
  if (elapsedMs > timeoutMs) {
    throw new SendTimeoutError(`요약 발송이 제한 시간 ${timeoutMs}ms를 넘김 (${elapsedMs}ms)`)
  }
  return { value, elapsedMs }
}
