import { couponDiscount, itemsTotal } from './cart.js'
import { shippingFee } from './shipping.js'

/** 결제 금액 */
export function checkoutAmounts(cart) {
  const items = itemsTotal(cart)
  const discount = couponDiscount(cart)
  const shipping = shippingFee(cart)
  return { items, discount, shipping, pay: items - discount + shipping }
}
