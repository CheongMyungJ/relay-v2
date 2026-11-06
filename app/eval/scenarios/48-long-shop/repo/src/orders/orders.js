// 주문의 생애: 접수(placed) → 결제(paid) → 배송(shipped) → 배송 완료(delivered). 접수나 결제 뒤에는 취소(cancelled)할 수 있다.
// 이벤트: order.placed, order.paid, payment.failed, order.shipped, order.delivered, order.cancelled
import { fail } from '../shared/errors.js'
import { estimateDelivery } from './delivery.js'
import { quote } from './pricing.js'

export function createOrders({ store, catalog, coupons, customers, payments, bus, clock, ids }) {
  let number = 1000

  const snapshot = (order) => structuredClone(order)

  function load(orderId) {
    const order = store.orders.get(orderId)
    if (!order) fail('NOT_FOUND', `주문이 없습니다: ${orderId}`)
    return order
  }

  /**
   * 장바구니로 주문을 받는다. 재고를 잡고 금액을 정한다(결제는 pay로 따로).
   * @param {{ customerId: string, cart: ReturnType<import('./cart.js').createCart>, couponCode?: string }} o
   */
  function placeOrder({ customerId, cart, couponCode = null }) {
    const customer = customers.get(customerId)
    const lines = cart.lines()
    if (lines.length === 0) fail('EMPTY_CART', '장바구니가 비었습니다')
    for (const line of lines) {
      const p = catalog.get(line.sku)
      if (!p.active) fail('DISCONTINUED', `판매 중지된 상품: ${line.sku}`)
    }
    const itemsTotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0)
    const coupon = couponCode ? coupons.discountFor(couponCode, itemsTotal) : null
    const q = quote(lines, { coupon, region: customer.region })

    const reserved = []
    try {
      for (const line of lines) {
        catalog.reserve(line.sku, line.qty)
        reserved.push(line)
      }
    } catch (e) {
      for (const line of reserved) catalog.release(line.sku, line.qty)
      throw e
    }

    const at = clock.now().toISOString()
    number += 1
    const order = {
      id: ids.next('ord'),
      number: `A-${number}`,
      customerId,
      status: 'placed',
      lines: q.lines.map((l) => ({ ...l, cancelledQty: 0 })),
      itemsTotal: q.itemsTotal,
      discount: q.discount,
      couponCode: q.couponCode,
      shipping: q.shipping,
      total: q.total,
      vat: q.vat,
      paymentRef: null,
      paidAmount: 0,
      refunded: 0,
      createdAt: at,
      history: [{ status: 'placed', at }],
    }
    store.orders.set(order.id, order)
    bus.emit('order.placed', { order: snapshot(order) })
    return snapshot(order)
  }

  /** 카드로 결제한다. 실패하면 payment.failed를 내고 PAYMENT_FAILED 오류 */
  function pay(orderId, { cardToken } = {}) {
    const order = load(orderId)
    const r = payments.charge({ amount: order.total, cardToken, reference: order.number })
    if (!r.ok) {
      bus.emit('payment.failed', { order: snapshot(order), reason: r.reason })
      fail('PAYMENT_FAILED', `결제 실패: ${order.number} (${r.reason})`, { reason: r.reason })
    }
    order.paymentRef = r.ref
    order.paidAmount = order.total
    order.eta = estimateDelivery(customers.get(order.customerId).region, clock.now())
    order.status = 'paid'
    order.history.push({ status: 'paid', at: clock.now().toISOString() })
    bus.emit('order.paid', { order: snapshot(order) })
    return snapshot(order)
  }

  function ship(orderId, { carrier = 'cj', trackingNo = null } = {}) {
    const order = load(orderId)
    if (order.status !== 'paid') fail('NOT_PAID', `결제되지 않은 주문은 보낼 수 없습니다: ${order.number}`)
    order.status = 'shipped'
    order.shipment = { carrier, trackingNo, shippedAt: clock.now().toISOString() }
    order.history.push({ status: 'shipped', at: order.shipment.shippedAt })
    bus.emit('order.shipped', { order: snapshot(order) })
    return snapshot(order)
  }

  function deliver(orderId) {
    const order = load(orderId)
    if (order.status !== 'shipped') fail('NOT_SHIPPED', `배송 중이 아닌 주문: ${order.number}`)
    order.status = 'delivered'
    order.history.push({ status: 'delivered', at: clock.now().toISOString() })
    bus.emit('order.delivered', { order: snapshot(order) })
    return snapshot(order)
  }

  /**
   * 주문 전체를 취소한다. 잡아 둔 재고를 풀고, 결제했으면 아직 환불하지 않은 금액을 모두 환불한다.
   * @returns {{ order: object, refund: number }}
   */
  function cancelOrder(orderId, { reason = 'customer' } = {}) {
    const order = load(orderId)
    if (order.status !== 'placed' && order.status !== 'paid') {
      fail('CANNOT_CANCEL', `취소할 수 없는 주문: ${order.number} (${order.status})`)
    }
    for (const line of order.lines) {
      const left = line.qty - line.cancelledQty
      if (left > 0) catalog.release(line.sku, left)
      line.cancelledQty = line.qty
    }
    let refund = 0
    if (order.status === 'paid') {
      refund = order.paidAmount - order.refunded
      if (refund > 0) payments.refund(order.paymentRef, refund)
      order.refunded += refund
    }
    order.status = 'cancelled'
    order.history.push({ status: 'cancelled', at: clock.now().toISOString(), reason })
    bus.emit('order.cancelled', { order: snapshot(order), refund, reason })
    return { order: snapshot(order), refund }
  }

  function getOrder(orderId) {
    return snapshot(load(orderId))
  }

  function findByNumber(orderNumber) {
    for (const order of store.orders.values()) if (order.number === orderNumber) return snapshot(order)
    return null
  }

  function listOrders({ customerId, status } = {}) {
    return [...store.orders.values()]
      .filter((o) => (!customerId || o.customerId === customerId) && (!status || o.status === status))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(snapshot)
  }

  return { placeOrder, pay, ship, deliver, cancelOrder, getOrder, findByNumber, listOrders }
}
