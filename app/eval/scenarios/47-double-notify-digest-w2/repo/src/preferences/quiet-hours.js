// 방해 금지 시간. { start: '22:00', end: '08:00' }처럼 자정을 넘길 수 있다.

function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '')
  if (!m) throw new Error(`시각 형식이 틀림: ${hhmm}`)
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) throw new Error(`시각 범위가 틀림: ${hhmm}`)
  return h * 60 + min
}

/**
 * @param {number} atMs 확인할 시각(UTC ms)
 * @param {{ start: string, end: string } | undefined} quiet
 * @param {number} tzOffsetMinutes 사용자 시간대의 UTC 차이(서울 540)
 */
export function isQuietAt(atMs, quiet, tzOffsetMinutes = 0) {
  if (!quiet) return false
  const start = toMinutes(quiet.start)
  const end = toMinutes(quiet.end)
  if (start === end) return false
  const local = new Date(atMs + tzOffsetMinutes * 60_000)
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes()
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

/** 방해 금지 시간이 끝나는 다음 시각(UTC ms). 방해 금지가 아니면 atMs 그대로 */
export function quietEndsAt(atMs, quiet, tzOffsetMinutes = 0) {
  if (!isQuietAt(atMs, quiet, tzOffsetMinutes)) return atMs
  const step = 60_000
  let t = atMs - (atMs % step) + step
  for (let i = 0; i < 24 * 60 && isQuietAt(t, quiet, tzOffsetMinutes); i++) t += step
  return t
}
