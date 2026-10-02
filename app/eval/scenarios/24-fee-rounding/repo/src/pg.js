import { orderAmounts } from './order.js'
import { installmentQuote } from './installment.js'

/** PG사 결제 요청 */
export function buildPgRequest(order, payment = {}) {
  const months = payment.months ?? 1
  const { paid } = orderAmounts(order)
  const quote = installmentQuote(paid, months)
  return {
    merchantOrderId: order.id,
    amount: quote.total,
    installment: months,
    cardToken: payment.cardToken ?? null,
  }
}

/** 가짜 PG: 실제 PG사의 검사와 같게 금액은 1원 이상의 정수여야 한다 */
export function sendToPg(request) {
  if (!Number.isInteger(request.amount) || request.amount <= 0) {
    return { ok: false, code: 'E201', reason: '금액 형식 오류(소수점 또는 0 이하)' }
  }
  return { ok: true, approvalNo: `A-${request.merchantOrderId}` }
}
