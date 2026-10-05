// 장바구니 화면의 미리보기 금액

export function previewTotal(items, { member = false, coupon = 0 } = {}) {
  let total = 0
  for (const item of items) total += item.price * item.qty
  if (member) total = Math.round(total * 0.95)
  total -= coupon
  return Math.max(total, 0)
}
