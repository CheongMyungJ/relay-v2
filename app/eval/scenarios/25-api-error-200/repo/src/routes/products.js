import { ok } from '../http.js'

export function listProducts(req, { db }) {
  return ok([...db.products.values()].filter((p) => !p.hidden))
}
