// 'YYYY-MM-DD' 날짜 다루기. 시간대의 영향을 받지 않게 UTC로만 계산한다

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 24 * 60 * 60 * 1000

function toUtc(date) {
  const m = DATE_RE.exec(date)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function fromUtc(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

export function isValidDate(date) {
  if (typeof date !== 'string' || !DATE_RE.test(date)) return false
  return fromUtc(toUtc(date)) === date
}

export function assertDate(date) {
  if (!isValidDate(date)) throw new Error(`날짜 형식(YYYY-MM-DD)이 아니다: ${date}`)
  return date
}

export function addDays(date, days) {
  return fromUtc(toUtc(assertDate(date)) + days * DAY_MS)
}

// b - a (일)
export function daysBetween(a, b) {
  return Math.round((toUtc(assertDate(b)) - toUtc(assertDate(a))) / DAY_MS)
}

// '2026-09-14' -> '2026년 9월 14일'
export function formatDateKo(date) {
  const m = DATE_RE.exec(assertDate(date))
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`
}

// '2026-09-14' -> '2026.09.14'
export function formatDateDots(date) {
  return assertDate(date).replaceAll('-', '.')
}

// '2026-09-14' -> '2026-09'
export function monthOf(date) {
  return assertDate(date).slice(0, 7)
}
