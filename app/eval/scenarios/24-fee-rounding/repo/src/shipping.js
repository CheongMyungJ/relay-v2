export const FREE_SHIPPING_OVER = 50000
export const BASE_FEE = 3000
export const REMOTE_EXTRA = 3000

const REMOTE_PREFIXES = ['63', '40', '52', '59']

/** 배송비: 5만 원 이상 무료, 아니면 3,000원. 도서산간(우편번호 앞자리)은 3,000원 더 */
export function shippingFee(itemsTotal, address) {
  const remote = REMOTE_PREFIXES.some((p) => String(address?.zip ?? '').startsWith(p))
  const base = itemsTotal >= FREE_SHIPPING_OVER ? 0 : BASE_FEE
  return base + (remote ? REMOTE_EXTRA : 0)
}
