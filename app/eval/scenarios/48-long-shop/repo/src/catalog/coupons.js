// 쿠폰. 주문 하나에 한 장만 쓴다. fixed는 정액, percent는 상품 금액의 몇 %.
import { fail } from '../shared/errors.js'

export function createCoupons(store, clock) {
  function add({ code, kind, value, minSubtotal = 0, expiresAt = null }) {
    if (!code) fail('BAD_COUPON', '쿠폰 코드가 없습니다')
    if (!['fixed', 'percent'].includes(kind)) fail('BAD_COUPON', `쿠폰 종류: ${kind}`)
    if (!Number.isInteger(value) || value <= 0) fail('BAD_COUPON', `쿠폰 값: ${value}`)
    if (kind === 'percent' && value > 100) fail('BAD_COUPON', `할인율: ${value}`)
    const coupon = { code, kind, value, minSubtotal, expiresAt }
    store.coupons.set(code, coupon)
    return { ...coupon }
  }

  function find(code) {
    const c = store.coupons.get(code)
    return c ? { ...c } : null
  }

  /** 상품 금액(subtotal)에 쓸 할인. 쓸 수 없으면 오류 */
  function discountFor(code, subtotal) {
    const c = store.coupons.get(code)
    if (!c) fail('COUPON_NOT_FOUND', `없는 쿠폰: ${code}`)
    if (c.expiresAt && clock.now() >= new Date(c.expiresAt)) fail('COUPON_EXPIRED', `기한이 지난 쿠폰: ${code}`)
    if (subtotal < c.minSubtotal) {
      fail('COUPON_MIN', `${c.minSubtotal}원 이상 사야 쓰는 쿠폰: ${code}`, { minSubtotal: c.minSubtotal })
    }
    const discount = c.kind === 'fixed' ? Math.min(c.value, subtotal) : Math.floor((subtotal * c.value) / 100)
    return { code, discount }
  }

  return { add, find, discountFor }
}
