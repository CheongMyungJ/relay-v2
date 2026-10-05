import { NotFoundError } from '../util/errors.js'

// 구독 기록. 메모리에 둔다
let subs = new Map()
let seq = 100

export function resetStore(list = []) {
  subs = new Map(list.map((s) => [s.id, structuredClone(s)]))
  seq = 100 + list.length
}

export function nextSubscriptionId() {
  seq += 1
  while (subs.has(`S-${seq}`)) seq += 1
  return `S-${seq}`
}

export function getSubscription(id) {
  const s = subs.get(id)
  if (!s) throw new NotFoundError('구독', id)
  return s
}

export function saveSubscription(s) {
  subs.set(s.id, s)
  return s
}

export function listSubscriptions() {
  return [...subs.values()]
}
