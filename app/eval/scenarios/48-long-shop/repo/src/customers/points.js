// 적립금. 결제한 상품 금액(할인 뒤, 배송비 빼고)의 1%를 쌓는다(VIP는 2%). 주문을 취소하면 그 주문의 적립을 거둔다.
// 쌓인 적립금은 1년 뒤 사라진다. 쓰는 것은 아직 없다(다음 분기).
import { fail } from '../shared/errors.js'
import { addDays } from '../shared/time.js'

export const RATE = { normal: 0.01, vip: 0.02 }
export const EXPIRE_DAYS = 365

export function createPoints({ store, bus, clock, customers }) {
  if (!store.points) store.points = []

  bus.on('order.paid', ({ order }) => {
    const customer = customers.get(order.customerId)
    const basis = order.itemsTotal - order.discount
    const amount = Math.floor(basis * (RATE[customer.tier] ?? RATE.normal))
    if (amount <= 0) return
    store.points.push({
      customerId: order.customerId,
      orderId: order.id,
      kind: 'earn',
      amount,
      at: clock.now().toISOString(),
      expiresAt: addDays(clock.now(), EXPIRE_DAYS).toISOString(),
    })
  })

  bus.on('order.cancelled', ({ order }) => {
    const earned = store.points
      .filter((p) => p.orderId === order.id)
      .reduce((sum, p) => sum + (p.kind === 'earn' ? p.amount : -p.amount), 0)
    if (earned <= 0) return
    store.points.push({ customerId: order.customerId, orderId: order.id, kind: 'revoke', amount: earned, at: clock.now().toISOString() })
  })

  function balance(customerId, at = clock.now()) {
    const now = new Date(at).toISOString()
    let sum = 0
    for (const p of store.points.filter((x) => x.customerId === customerId)) {
      if (p.kind === 'earn' && p.expiresAt <= now) continue
      if (p.kind === 'revoke' && revokedExpired(p, now)) continue
      sum += p.kind === 'earn' ? p.amount : -p.amount
    }
    return Math.max(sum, 0)
  }

  // 거둔 적립의 원래 적립이 이미 사라졌으면 거둔 것도 세지 않는다
  function revokedExpired(revoke, now) {
    const earn = store.points.find((p) => p.orderId === revoke.orderId && p.kind === 'earn')
    return earn ? earn.expiresAt <= now : false
  }

  function history(customerId) {
    customers.get(customerId)
    return store.points.filter((p) => p.customerId === customerId).map((p) => ({ ...p }))
  }

  /** 운영자가 손으로 주는 적립(사과, 이벤트) */
  function grant(customerId, amount, reason) {
    customers.get(customerId)
    if (!Number.isInteger(amount) || amount <= 0) fail('BAD_AMOUNT', `적립금: ${amount}`)
    if (!reason) fail('BAD_REQUEST', '까닭이 없습니다')
    const entry = {
      customerId,
      orderId: null,
      kind: 'earn',
      amount,
      reason,
      at: clock.now().toISOString(),
      expiresAt: addDays(clock.now(), EXPIRE_DAYS).toISOString(),
    }
    store.points.push(entry)
    return { ...entry }
  }

  return { balance, history, grant }
}
