// 날짜는 모두 'YYYY-MM-DD' 문자열(도서관이 있는 곳의 달력 날짜)이다. 시각은 다루지 않는다.
const DAY = 86400000

function toMs(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`날짜 형식이 아님: ${date}`)
  const ms = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(ms)) throw new Error(`없는 날짜: ${date}`)
  return ms
}

const toDate = (ms) => new Date(ms).toISOString().slice(0, 10)

export function addDays(date, n) {
  return toDate(toMs(date) + n * DAY)
}

/** a - b (일) */
export function diffDays(a, b) {
  return Math.round((toMs(a) - toMs(b)) / DAY)
}

/** 0=일요일 … 6=토요일 */
export function weekday(date) {
  return new Date(toMs(date)).getUTCDay()
}
