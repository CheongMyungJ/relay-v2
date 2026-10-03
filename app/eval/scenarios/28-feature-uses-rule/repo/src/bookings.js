import { availableSlots } from './slots.js'

/** 예약 만들기. 예약 가능한 시간대가 아니면 { ok: false, reason: 'unavailable' } */
export function createBooking(store, { date, time, name }) {
  if (!availableSlots(store, date).includes(time)) return { ok: false, reason: 'unavailable' }
  const booking = { id: `B-${store.nextId++}`, date, time, name, status: 'booked' }
  store.bookings.push(booking)
  return { ok: true, booking }
}

/** 예약 취소 */
export function cancelBooking(store, id) {
  const b = store.bookings.find((x) => x.id === id)
  if (!b || b.status !== 'booked') return { ok: false, reason: 'not_found' }
  b.status = 'canceled'
  return { ok: true, booking: b }
}
