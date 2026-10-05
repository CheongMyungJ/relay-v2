import { NotFoundError } from '../util/errors.js'

// 대여 기록. 메모리에 둔다
let rentals = new Map()
let seq = 1000

export function resetStore(list = []) {
  rentals = new Map(list.map((r) => [r.id, structuredClone(r)]))
  seq = 1000 + list.length
}

export function nextRentalId() {
  seq += 1
  while (rentals.has(`R-${seq}`)) seq += 1
  return `R-${seq}`
}

export function getRental(id) {
  const r = rentals.get(id)
  if (!r) throw new NotFoundError('대여', id)
  return r
}

export function saveRental(r) {
  rentals.set(r.id, r)
  return r
}

export function listRentals() {
  return [...rentals.values()]
}
