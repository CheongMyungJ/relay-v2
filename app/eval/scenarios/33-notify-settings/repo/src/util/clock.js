// 서버 시계. 서버는 UTC로 돈다
export function now() {
  return new Date()
}

/** UTC 기준 시(0~23) */
export function hourUtc(date = now()) {
  return date.getUTCHours()
}
