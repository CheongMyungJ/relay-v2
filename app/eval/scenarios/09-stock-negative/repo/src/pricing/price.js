import { activeAt, couponDiscount, lineDiscount } from './promotions.js'

export function roundDown(amount, unit) {
  return unit > 1 ? Math.floor(amount / unit) * unit : amount
}

/**
 * 주문 금액을 계산한다.
 * lines: [{ product, qty }]
 * 돌려주는 값: { lines: [{ sku, qty, unitPrice, discount, amount }], subtotal, discount, tax, total }
 */
export function priceOrder(lines, { promotions = [], coupon = null, at, taxRate = 0.1, roundTo = 10 } = {}) {
  const active = activeAt(promotions, at ?? new Date())
  const priced = lines.map(({ product, qty }) => {
    const gross = product.price * qty
    const discount = lineDiscount({ product, qty }, active)
    return { sku: product.sku, qty, unitPrice: product.price, discount, amount: gross - discount }
  })
  const afterLines = priced.reduce((sum, l) => sum + l.amount, 0)
  const extra = couponDiscount(coupon, afterLines)
  const net = afterLines - extra
  const tax = Math.round(net * taxRate)
  return {
    lines: priced,
    subtotal: priced.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
    discount: priced.reduce((sum, l) => sum + l.discount, 0) + extra,
    tax,
    total: roundDown(net + tax, roundTo),
  }
}

export function formatWon(amount) {
  return `${amount.toLocaleString('ko-KR')}원`
}
