// 다시 보내기 전 기다리는 시간. attempt는 방금 실패한 시도 번호(1부터).

export function backoffDelay(attempt, { baseDelayMs, factor = 2, maxDelayMs = Infinity }) {
  if (!(attempt >= 1)) throw new RangeError(`attempt는 1 이상: ${attempt}`)
  return Math.min(maxDelayMs, Math.round(baseDelayMs * factor ** (attempt - 1)))
}

/** 시도 횟수 전체에 걸쳐 기다리는 시간의 합. 운영 대시보드의 "최악의 지연" 계산용 */
export function totalBackoff(maxAttempts, options) {
  let total = 0
  for (let a = 1; a < maxAttempts; a++) total += backoffDelay(a, options)
  return total
}
