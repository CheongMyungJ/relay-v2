// 원장의 날짜는 '2026-03-02', '2026.03.02', '2026/3/2' 가운데 하나로 온다
const DATE = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/

export function parseDate(text) {
  const m = DATE.exec(String(text ?? '').trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null
  return { y, m: mo, d }
}

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

const two = (n) => String(n).padStart(2, '0')

export function toIso(date) {
  const p = typeof date === 'string' ? parseDate(date) : date
  return p ? `${p.y}-${two(p.m)}-${two(p.d)}` : null
}

export function monthKey(date) {
  const p = typeof date === 'string' ? parseDate(date) : date
  return p ? `${p.y}-${two(p.m)}` : null
}

export function quarterOf(date) {
  const p = typeof date === 'string' ? parseDate(date) : date
  return p ? Math.floor((p.m - 1) / 3) + 1 : null
}

// 회계연도. 시작 달이 4월이면 2026-03-31은 2025 회계연도다
export function fiscalYear(date, startMonth = 1) {
  const p = typeof date === 'string' ? parseDate(date) : date
  if (!p) return null
  return p.m >= startMonth ? p.y : p.y - 1
}

export function compareDates(a, b) {
  const x = toIso(a)
  const y = toIso(b)
  if (x === y) return 0
  return x < y ? -1 : 1
}

// from, to가 없으면 그쪽은 열려 있다. 양 끝을 포함한다
export function inRange(date, from, to) {
  const iso = toIso(date)
  if (!iso) return false
  if (from && iso < toIso(from)) return false
  if (to && iso > toIso(to)) return false
  return true
}

export function quarterRange(year, quarter) {
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = startMonth + 2
  return {
    from: `${year}-${two(startMonth)}-01`,
    to: `${year}-${two(endMonth)}-${two(daysInMonth(year, endMonth))}`,
  }
}

export function addMonths(date, n) {
  const p = typeof date === 'string' ? parseDate(date) : date
  if (!p) return null
  const index = p.y * 12 + (p.m - 1) + n
  const y = Math.floor(index / 12)
  const m = (index % 12) + 1
  return { y, m, d: Math.min(p.d, daysInMonth(y, m)) }
}

// a에서 b까지 몇 달인지 (같은 달이면 0)
export function monthsBetween(a, b) {
  const x = typeof a === 'string' ? parseDate(a) : a
  const y = typeof b === 'string' ? parseDate(b) : b
  if (!x || !y) return null
  return (y.y - x.y) * 12 + (y.m - x.m)
}

export function formatKoreanDate(date) {
  const p = typeof date === 'string' ? parseDate(date) : date
  return p ? `${p.y}년 ${p.m}월 ${p.d}일` : ''
}
