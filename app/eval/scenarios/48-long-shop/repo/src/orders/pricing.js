// 주문 금액: 줄 금액, 쿠폰 할인, 배송비, 부가세. 가격은 부가세 포함이다.

export const SHIPPING = {
  baseFee: 3000,
  freeOver: 50000,
  // 제주, 도서산간 추가 배송비
  surcharge: { jeju: 3000, island: 5000 },
  heavyOverG: 20000,
  heavyFee: 2000,
}

/** 12300 → '12,300원', -5000 → '-5,000원' */
export function formatWon(n) {
  const sign = n < 0 ? '-' : ''
  const digits = String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${digits}원`
}

/** 부가세 포함 금액의 부가세(10%). 면세는 0, 원 미만 버림 */
function vatOf(amount, taxClass) {
  if (taxClass === 'exempt') return 0
  return Math.floor(amount / 11)
}

export function lineAmount(line) {
  return line.price * line.qty
}

/**
 * 배송비. 무료 배송 기준 이상이면 기본 배송비가 없다. 제주·도서산간 추가 배송비와 무거운 짐 추가는 무료 배송이어도 붙는다.
 * @param {{ itemsTotal: number, discount: number, region: string, lines: object[] }} o
 */
export function shippingFee({ itemsTotal, discount = 0, region, lines }) {
  if (lines.length === 0) return 0
  const basis = itemsTotal - discount
  let fee = basis >= SHIPPING.freeOver ? 0 : SHIPPING.baseFee
  let weight = 0
  for (const line of lines) {
    weight += (line.weightG ?? 0) * line.qty
    const extra = SHIPPING.surcharge[region]
    if (extra) fee += extra
  }
  if (weight > SHIPPING.heavyOverG) fee += SHIPPING.heavyFee
  return fee
}

/**
 * 장바구니 줄로 주문 금액을 낸다.
 * @param {object[]} lines 장바구니 줄 (sku, name, price, qty, taxClass, weightG)
 * @param {{ coupon?: { code: string, discount: number } | null, region?: string }} options
 */
export function quote(lines, { coupon = null, region = 'seoul' } = {}) {
  const priced = lines.map((l) => {
    const amount = lineAmount(l)
    return {
      sku: l.sku,
      name: l.name,
      qty: l.qty,
      price: l.price,
      taxClass: l.taxClass ?? 'standard',
      weightG: l.weightG ?? 0,
      amount,
      vat: vatOf(amount, l.taxClass ?? 'standard'),
    }
  })
  const itemsTotal = priced.reduce((sum, l) => sum + l.amount, 0)
  const discount = coupon ? Math.min(coupon.discount, itemsTotal) : 0
  const shipping = shippingFee({ itemsTotal, discount, region, lines: priced })
  const total = itemsTotal - discount + shipping
  const vat = priced.reduce((sum, l) => sum + l.vat, 0) + vatOf(shipping, 'standard')
  return { lines: priced, itemsTotal, discount, couponCode: coupon?.code ?? null, shipping, total, vat }
}

/** 장바구니 화면과 주문 확인 메일에 쓰는 금액 요약 */
export function quoteText(q) {
  const rows = q.lines.map((l) => `${l.name} x${l.qty}  ${formatWon(l.amount)}`)
  rows.push(`상품 합계  ${formatWon(q.itemsTotal)}`)
  if (q.discount > 0) rows.push(`할인(${q.couponCode})  ${formatWon(-q.discount)}`)
  rows.push(`배송비  ${formatWon(q.shipping)}`)
  rows.push(`합계  ${formatWon(q.total)}`)
  rows.push(`(부가세 ${formatWon(q.vat)} 포함)`)
  return rows.join('\n')
}
