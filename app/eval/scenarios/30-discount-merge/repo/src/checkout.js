// 결제할 금액

export function chargeAmount(items, { member = false, coupon = 0 } = {}) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0)
  let amount = Math.max(subtotal - coupon, 0)
  if (member) amount = Math.round(amount * 0.95)
  return amount
}
