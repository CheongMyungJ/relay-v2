import { POINT_EXPIRY_DAYS } from '../config.js'

// 포인트 내역. 항목은 { type: 'earn' | 'use' | 'recover' | 'expire', points, at, ref }이고 저장된 값을 그대로 쓴다.
// 적립 항목은 적립일부터 POINT_EXPIRY_DAYS일 뒤에 사라진다(먼저 적립한 것부터 쓴다)

const DAY = 24 * 60 * 60 * 1000
const day = (s) => Date.parse(`${s.slice(0, 10)}T00:00:00Z`)

export function expiryOf(entry) {
  return new Date(day(entry.at) + POINT_EXPIRY_DAYS * DAY).toISOString().slice(0, 10)
}

/** date(YYYY-MM-DD) 시점의 잔액. 사라진 적립분은 빼고, 쓴 포인트는 먼저 적립한 것부터 깎는다 */
export function balanceOn(entries, date) {
  const sorted = [...entries].filter((e) => e.at.slice(0, 10) <= date).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  const lots = []
  for (const e of sorted) {
    if (e.type === 'earn') lots.push({ left: e.points, expires: expiryOf(e) })
    else if (e.type === 'use' || e.type === 'recover' || e.type === 'expire') {
      let need = e.points
      for (const lot of lots) {
        if (need === 0) break
        if (lot.expires <= e.at.slice(0, 10)) continue
        const take = Math.min(lot.left, need)
        lot.left -= take
        need -= take
      }
    }
  }
  return lots.filter((l) => l.expires > date).reduce((a, l) => a + l.left, 0)
}
