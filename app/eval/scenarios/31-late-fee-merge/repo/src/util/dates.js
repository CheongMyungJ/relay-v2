// 날짜는 'YYYY-MM-DD' 글자로 다룬다. 시각과 시간대는 쓰지 않는다
const DAY = 24 * 60 * 60 * 1000

export function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? '').trim())
  if (!m) throw new Error(`날짜 형식이 아님: ${s}`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function formatDate(t) {
  return new Date(t).toISOString().slice(0, 10)
}

/** from에서 to까지의 날 수. to가 앞이면 음수 */
export function daysBetween(from, to) {
  return Math.round((parseDate(to) - parseDate(from)) / DAY)
}

export function addDays(s, n) {
  return formatDate(parseDate(s) + n * DAY)
}

export function isWeekend(s) {
  const d = new Date(parseDate(s)).getUTCDay()
  return d === 0 || d === 6
}

export function monthOf(s) {
  return String(s).slice(0, 7)
}

export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}
