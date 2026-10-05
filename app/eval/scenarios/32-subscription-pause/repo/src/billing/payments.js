import { getMember } from '../members/members.js'

// 결제 대행사 대신 쓰는 장부. 카드가 유효하지 않으면 실패한다
export const ledger = []

export function charge(memberId, amount, memo) {
  const m = getMember(memberId)
  const ok = m.cardValid
  ledger.push({ memberId, amount, memo, ok })
  return ok
}

export function clearLedger() {
  ledger.length = 0
}
