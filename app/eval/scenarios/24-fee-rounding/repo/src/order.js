import { shippingFee } from './shipping.js'

/** 상품 합계 */
export function itemsTotal(order) {
  return order.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0)
}

/** 결제할 금액: 상품 합계 + 배송비 */
export function orderAmounts(order) {
  const items = itemsTotal(order)
  const shipping = shippingFee(items, order.address)
  return { items, shipping, paid: items + shipping }
}
