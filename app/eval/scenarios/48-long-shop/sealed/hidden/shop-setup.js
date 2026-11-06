// 숨긴 시험의 상점. 기준 레포의 공개 API(createShop과 그 서비스)만 쓴다.
import { createShop } from '../src/index.js'

/** 2026-03-03(화) 10:00 한국 시간에서 시작 */
export function shop(now = '2026-03-03T01:00:00Z') {
  const s = createShop({ now })
  s.catalog.add({ sku: 'MUG', name: '머그컵', price: 12000, stock: 50, weightG: 400 })
  s.catalog.add({ sku: 'TEA', name: '녹차 세트', price: 30000, stock: 50, weightG: 800 })
  s.catalog.add({ sku: 'RICE', name: '쌀 5kg', price: 20000, taxClass: 'exempt', stock: 50, weightG: 5000 })
  s.catalog.add({ sku: 'BAG', name: '에코백', price: 8000, stock: 5, weightG: 200 })
  s.catalog.add({ sku: 'PEN', name: '볼펜', price: 2000, stock: 50, weightG: 50 })
  s.catalog.add({ sku: 'SOAP', name: '비누', price: 12345, stock: 50, weightG: 100 })
  s.coupons.add({ code: 'SPRING5', kind: 'fixed', value: 5000 })
  s.coupons.add({ code: 'TEN', kind: 'percent', value: 10 })
  s.customers.register({ id: 'c-1', name: '김하나', email: 'hana@example.com', phone: '010-1234-5678' })
  s.customers.register({ id: 'c-2', name: 'Alex Kim', email: 'alex@example.com', phone: '010-9876-4321', locale: 'en' })
  s.customers.register({ id: 'c-3', name: '박제주', email: 'jeju@example.com', phone: '010-5555-0303', region: 'jeju' })
  s.customers.register({ id: 'c-4', name: '이보라', email: 'bora@example.com', phone: '010-3030-4040', tier: 'vip' })
  return s
}

export function cart(s, items) {
  const c = s.newCart()
  for (const [sku, qty] of items) c.add(sku, qty)
  return c
}

export function placed(s, customerId, items, { coupon = null } = {}) {
  return s.orders.placeOrder({ customerId, cart: cart(s, items), couponCode: coupon })
}

export function paidOrder(s, customerId, items, { coupon = null, card = 'tok-ok' } = {}) {
  const o = placed(s, customerId, items, { coupon })
  s.orders.pay(o.id, { cardToken: card })
  return s.orders.getOrder(o.id)
}

/** 한국 시간 'YYYY-MM-DD HH:mm'으로 시계를 옮긴다 */
export function atKst(s, text) {
  const [d, t = '00:00'] = text.split(' ')
  s.clock.set(`${d}T${t}:00+09:00`)
}

/** 채널(또는 보낸 것의 목록)에서 그 주소로 간 것 */
export const to = (channel, address) => (Array.isArray(channel) ? channel : channel.sent).filter((m) => m.to === address)
export const hasCode = (code) => (e) => e?.code === code
export const isDomainError = (e) => typeof e?.code === 'string' && e.code.length > 0
export const won = (n) => `${n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('en-US')}원`
