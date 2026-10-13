// 시각은 'YYYY-MM-DDTHH:MM' 글자(회사 현지 시각, 시간대 없음)로 다룬다

const RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

// 시각 글자가 형식에 맞는가
export function isTime(s) {
  return typeof s === 'string' && RE.test(s) && !Number.isNaN(Date.parse(`${s}:00Z`))
}

// 비교용 분 (1970-01-01T00:00부터)
export function toMinutes(s) {
  return Date.parse(`${s}:00Z`) / 60000
}

// 정각이나 30분인가
export function onHalfHour(s) {
  const m = RE.exec(s)
  return !!m && (m[5] === '00' || m[5] === '30')
}

// n일 뒤의 같은 시각
export function addDays(s, n) {
  const d = new Date(Date.parse(`${s}:00Z`) + n * 86400000)
  return d.toISOString().slice(0, 16)
}
