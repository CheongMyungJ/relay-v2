import { respond } from './http.js'
import { addCartItem, getCart } from './routes/cart.js'
import { getOrder, listOrders } from './routes/orders.js'
import { listProducts } from './routes/products.js'

const ROUTES = [
  ['GET', /^\/products$/, listProducts],
  ['GET', /^\/orders$/, listOrders],
  ['GET', /^\/orders\/([\w-]+)$/, getOrder, ['id']],
  ['GET', /^\/cart$/, getCart],
  ['POST', /^\/cart\/items$/, addCartItem],
]

/** 요청 하나: { method, path, body, user } → { status, body } */
export function handle(request, ctx) {
  for (const [method, re, fn, names = []] of ROUTES) {
    const m = request.method === method && re.exec(request.path)
    if (!m) continue
    const params = Object.fromEntries(names.map((n, i) => [n, m[i + 1]]))
    try {
      return fn({ ...request, params }, ctx)
    } catch (e) {
      ctx.log?.(`${request.method} ${request.path} 500 ${e.message}`)
      return respond(500, { ok: false, error: { code: 'INTERNAL', message: '서버 오류' } })
    }
  }
  return respond(404, { ok: false, error: { code: 'NO_ROUTE', message: '없는 경로' } })
}
