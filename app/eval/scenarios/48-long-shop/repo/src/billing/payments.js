// 결제 대행(가짜). 카드 토큰으로 결제하고, 결제 번호로 환불한다.
// tok-declined는 거절, tok-expired는 기한 지난 카드로 실패한다(시험용 카드).
import { fail } from '../shared/errors.js'

const FAILING = { 'tok-declined': 'declined', 'tok-expired': 'expired' }

export function createPayments(store, ids, clock) {
  function charge({ amount, cardToken, reference }) {
    if (!Number.isInteger(amount) || amount <= 0) fail('BAD_AMOUNT', `결제 금액: ${amount}`)
    if (!cardToken) return { ok: false, reason: 'no-card' }
    const reason = FAILING[cardToken]
    if (reason) {
      store.payments.push({ ref: null, reference, amount, ok: false, reason, at: clock.now().toISOString() })
      return { ok: false, reason }
    }
    const ref = ids.next('pay')
    store.payments.push({ ref, reference, amount, ok: true, kind: 'charge', at: clock.now().toISOString() })
    return { ok: true, ref }
  }

  function refund(ref, amount) {
    const original = store.payments.find((p) => p.ref === ref && p.kind === 'charge')
    if (!original) fail('NOT_FOUND', `결제가 없습니다: ${ref}`)
    const refunded = store.payments
      .filter((p) => p.kind === 'refund' && p.original === ref)
      .reduce((sum, p) => sum + p.amount, 0)
    if (refunded + amount > original.amount) fail('BAD_AMOUNT', `결제 금액보다 많이 환불: ${ref}`)
    const id = ids.next('rfd')
    store.payments.push({ ref: id, original: ref, reference: original.reference, amount, ok: true, kind: 'refund', at: clock.now().toISOString() })
    return { ok: true, ref: id }
  }

  function listFor(reference) {
    return store.payments.filter((p) => p.reference === reference).map((p) => ({ ...p }))
  }

  return { charge, refund, listFor }
}
