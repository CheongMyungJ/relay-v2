// 시험용 상점: 상품 넷, 쿠폰 둘, 고객 셋(한국어, 영어, 제주).
import { createShop } from '../src/index.js'

export function setup(now = '2026-03-02T01:00:00Z') {
  const shop = createShop({ now })
  shop.catalog.add({ sku: 'MUG', name: '머그컵', price: 12000, stock: 20, weightG: 400, category: 'kitchen' })
  shop.catalog.add({ sku: 'TEA', name: '녹차 세트', price: 30000, stock: 20, weightG: 800, category: 'food' })
  shop.catalog.add({ sku: 'RICE', name: '쌀 10kg', price: 33000, taxClass: 'exempt', stock: 20, weightG: 10000, category: 'food' })
  shop.catalog.add({ sku: 'BAG', name: '에코백', price: 8000, stock: 3, weightG: 200 })
  shop.coupons.add({ code: 'WELCOME', kind: 'fixed', value: 3000 })
  shop.coupons.add({ code: 'PCT10', kind: 'percent', value: 10, minSubtotal: 20000 })
  shop.customers.register({ id: 'u-1', name: '최유나', email: 'yuna@example.com', phone: '010-2222-3333' })
  shop.customers.register({ id: 'u-2', name: 'Sam Lee', email: 'sam@example.com', phone: '01044445555', locale: 'en' })
  shop.customers.register({ id: 'u-3', name: '고한라', email: 'halla@example.com', region: 'jeju' })
  return shop
}

/** items: [[sku, qty], ...] */
export function cartOf(shop, items) {
  const cart = shop.newCart()
  for (const [sku, qty] of items) cart.add(sku, qty)
  return cart
}

export function placePaid(shop, customerId, items, { coupon = null, card = 'tok-visa' } = {}) {
  const order = shop.orders.placeOrder({ customerId, cart: cartOf(shop, items), couponCode: coupon })
  return shop.orders.pay(order.id, { cardToken: card })
}

/** 한국 시간 'YYYY-MM-DD HH:mm'으로 시계를 옮긴다 */
export function atKst(shop, text) {
  const [d, t = '00:00'] = text.split(' ')
  shop.clock.set(`${d}T${t}:00+09:00`)
}

export const errorCode = (code) => (e) => e?.code === code
