// 작업 시간의 흔들림. 실제 I/O처럼 걸리는 시간이 조금씩 달라지게 한다.

/** 0 이상 spread 이하의 정수(ms) */
export function jitter(spread) {
  if (!spread || spread <= 0) return 0
  return Math.round(Math.random() * spread)
}

/** value를 중심으로 ±ratio 안에서 흔든다. 재시도 간격을 흩뜨릴 때 쓴다 */
export function spreadAround(value, ratio = 0.2) {
  if (value <= 0) return 0
  const delta = value * ratio
  return Math.max(0, Math.round(value - delta + Math.random() * delta * 2))
}
