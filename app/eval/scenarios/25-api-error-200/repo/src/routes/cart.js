import { ok } from '../http.js'

function cartOf(db, userId) {
  if (!db.carts.has(userId)) db.carts.set(userId, [])
  return db.carts.get(userId)
}

export function getCart(req, { db }) {
  return ok(cartOf(db, req.user.id))
}

/** 장바구니 담기: { productId, qty }. 같은 상품이면 수량을 더한다 */
export function addCartItem(req, { db }) {
  const { productId, qty } = req.body
  const product = db.products.get(productId)
  const cart = cartOf(db, req.user.id)
  const line = cart.find((l) => l.productId === productId)
  if (line) line.qty += qty
  else cart.push({ productId, name: product.name, price: product.price, qty })
  return ok(cart)
}
