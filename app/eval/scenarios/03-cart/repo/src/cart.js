import { applyCoupon } from './discount.js'
import { parsePrice } from './parse.js'

// 장바구니 총액. items: [{ price: '1200', qty: 2 }]
export function cartTotal(items, coupon) {
  const sum = items.reduce((acc, item) => acc + parsePrice(item.price) * item.qty, 0)
  return applyCoupon(sum, coupon)
}
