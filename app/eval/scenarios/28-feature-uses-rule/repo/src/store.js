export function createStore(bookings = []) {
  return { bookings: bookings.map((b) => ({ ...b })), nextId: bookings.length + 1 }
}
