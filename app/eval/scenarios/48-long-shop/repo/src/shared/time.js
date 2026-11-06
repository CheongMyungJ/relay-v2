// 한국 시간(KST, UTC+9) 도움 함수. 서버 시각은 UTC다. 한국은 서머타임이 없다.

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000

const pad = (n, w = 2) => String(n).padStart(w, '0')

/** 한국 시간의 연, 월(1~12), 일, 시, 분, 요일(0=일) */
export function kstParts(date) {
  const d = new Date(new Date(date).getTime() + KST_OFFSET_MS)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  }
}

/** 'YYYY-MM-DD' (한국 날짜) */
export function kstDate(date) {
  const p = kstParts(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** 'YYYY-MM-DD HH:mm' (한국 시각) */
export function kstDateTime(date) {
  const p = kstParts(date)
  return `${kstDate(date)} ${pad(p.hour)}:${pad(p.minute)}`
}

/** 한국 시간의 그 시각을 UTC Date로 */
export function fromKst(year, month, day, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - KST_OFFSET_MS)
}

/** a에서 b까지 지난 온전한 날 수(음수면 0) */
export function daysBetween(a, b) {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  return ms <= 0 ? 0 : Math.floor(ms / DAY_MS)
}

export function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * DAY_MS)
}
