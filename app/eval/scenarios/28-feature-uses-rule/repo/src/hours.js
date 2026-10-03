export const OPEN = '10:00'
export const CLOSE = '22:00'
export const SLOT_MINUTES = 30
/** 한 시간대에 받을 수 있는 예약 수 */
export const CAPACITY = 2

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function toHHMM(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}
