import { CAPACITY, CLOSE, OPEN, SLOT_MINUTES, toHHMM, toMinutes } from './hours.js'

/** 영업시간 안의 시간대 */
export function allSlots() {
  const out = []
  for (let t = toMinutes(OPEN); t < toMinutes(CLOSE); t += SLOT_MINUTES) out.push(toHHMM(t))
  return out
}

/** 그 날짜에 예약이 찬 수 */
export function bookedCount(store, date, time) {
  return store.bookings.filter((b) => b.date === date && b.time === time && b.status === 'booked').length
}

/** 그 날짜에 예약 가능한 시간대 (꽉 찬 시간대 제외) */
export function availableSlots(store, date) {
  return allSlots().filter((t) => bookedCount(store, date, t) < CAPACITY)
}
