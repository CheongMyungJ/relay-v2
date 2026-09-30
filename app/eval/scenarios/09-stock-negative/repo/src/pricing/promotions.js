import { ValidationError } from '../util/errors.js'

/**
 * 프로모션 종류
 * - percent: 분류(category) 상품을 percent% 할인
 * - bundle: sku를 buy개 사면 free개 무료(묶음 단위로 반복)
 * 기간은 [from, to) 이다.
 */
export function validatePromotion(p) {
  if (!p.id) throw new ValidationError('프로모션 id가 없음')
  if (!['percent', 'bundle'].includes(p.kind)) throw new ValidationError(`프로모션 종류가 잘못됨: ${p.kind}`)
  if (p.kind === 'percent' && !(p.percent > 0 && p.percent < 100)) throw new ValidationError(`할인율이 잘못됨: ${p.id}`)
  if (p.kind === 'bundle' && !(p.buy > 0 && p.free > 0)) throw new ValidationError(`묶음 조건이 잘못됨: ${p.id}`)
  if (new Date(p.from) >= new Date(p.to)) throw new ValidationError(`기간이 잘못됨: ${p.id}`)
  return p
}

export function activeAt(promotions, date) {
  const t = new Date(date).getTime()
  return promotions.filter((p) => new Date(p.from).getTime() <= t && t < new Date(p.to).getTime())
}

/** 줄 하나에 붙는 할인액. 여러 프로모션이 맞으면 가장 큰 것 하나만 */
export function lineDiscount({ product, qty }, promotions) {
  let best = 0
  for (const p of promotions) {
    let amount = 0
    if (p.kind === 'percent' && p.category === product.category) {
      amount = Math.floor((product.price * qty * p.percent) / 100)
    } else if (p.kind === 'bundle' && p.sku === product.sku) {
      const sets = Math.floor(qty / (p.buy + p.free))
      amount = sets * p.free * product.price
    }
    if (amount > best) best = amount
  }
  return best
}

/** 쿠폰: { code, percent, minSubtotal } */
export function couponDiscount(coupon, subtotal) {
  if (!coupon) return 0
  if (!(coupon.percent > 0 && coupon.percent <= 50)) throw new ValidationError(`쿠폰 할인율이 잘못됨: ${coupon.code}`)
  if (subtotal < (coupon.minSubtotal ?? 0)) return 0
  return Math.floor((subtotal * coupon.percent) / 100)
}
