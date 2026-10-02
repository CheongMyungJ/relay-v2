import { ok } from '../http.js'

export function getOrder(req, { db }) {
  const order = db.orders.get(req.params.id)
  return ok({
    id: order.id,
    status: order.status,
    items: order.items,
    total: order.items.reduce((s, i) => s + i.price * i.qty, 0),
  })
}

export function listOrders(req, { db }) {
  const mine = [...db.orders.values()].filter((o) => o.userId === req.user.id)
  return ok(mine.map((o) => ({ id: o.id, status: o.status })))
}
