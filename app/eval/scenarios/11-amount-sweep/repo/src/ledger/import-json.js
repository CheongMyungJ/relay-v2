import { toIso } from '../lib/dates.js'

// 은행 거래내역 JSON을 원장 행으로 바꾼다.
// 은행 API는 금액을 숫자로, 방향을 'in' | 'out'으로 준다. 원장과 같게 문자열로 바꿔 둔다
export function fromBankJson(records, { account = '1020', category = '은행' } = {}) {
  return records.map((rec) => {
    const value = Math.abs(Number(rec.amount) || 0)
    const text = value.toLocaleString('en-US', { maximumFractionDigits: 2 })
    return {
      date: toIso(String(rec.tradedAt).slice(0, 10)) ?? '',
      account,
      category,
      vendor: rec.counterparty ?? '',
      memo: rec.description ?? '',
      amount: rec.direction === 'out' ? `-${text}` : text,
      vat: '',
    }
  })
}
