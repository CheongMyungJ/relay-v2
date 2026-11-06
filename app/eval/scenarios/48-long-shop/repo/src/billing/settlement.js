// 카드 정산. 결제 대행사가 떼는 수수료(2.9%, 원 미만 올림)와 정산일(결제 다음 달 10일, 한국 날짜)을 미리 본다.
import { fromKst, kstDate, kstParts } from '../shared/time.js'

export const FEE_RATE = 0.029

export function feeOf(amount) {
  return Math.ceil(amount * FEE_RATE)
}

export function settlementDate(at) {
  const p = kstParts(at)
  return kstDate(fromKst(p.year, p.month + 1, 10, 12))
}

/**
 * 결제와 환불을 정산일마다 묶는다. 환불은 그 정산에서 빠지고 수수료는 돌려받지 못한다.
 * @param {{ kind: string, amount: number, at: string, ok: boolean }[]} payments
 */
export function settlementSchedule(payments) {
  const byDate = new Map()
  for (const p of payments.filter((x) => x.ok)) {
    const date = settlementDate(p.at)
    const row = byDate.get(date) ?? { date, charged: 0, refunded: 0, fees: 0, payout: 0 }
    if (p.kind === 'charge') {
      row.charged += p.amount
      row.fees += feeOf(p.amount)
    } else if (p.kind === 'refund') {
      row.refunded += p.amount
    }
    row.payout = row.charged - row.refunded - row.fees
    byDate.set(date, row)
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}
